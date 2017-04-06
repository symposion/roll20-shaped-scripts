'use strict';
const ShapedModule = require('../shaped-module');
const _ = require('underscore');
const ShapedConfig = require('../shaped-config');
const EntityCriteriaCollector = require('../entity-criteria-collector');
const EntityLookup = require('../entity-lookup');
const Utils = require('../utils');

function spellKey(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

function getBooleanCriterion(name) {
  return {
    name,
    transformer: val => !!val,
    displayName: '',
    validator: ShapedConfig.booleanValidator,
    getValueText(value) {
      const upperName = Utils.toTitleCase(name);
      return value ? upperName : `Non-${upperName}`;
    },
    compare(b1, b2) {
      return b1 === b2 ? 0 : (b1 ? -1 : 1);
    },
  };
}

module.exports = class SpellManager extends ShapedModule {

  constructor(dependencies) {
    super(dependencies);
    this.entityLookup = dependencies.entityLookup;
    this.entityLister = dependencies.entityLister;
    this.importer = dependencies.importer;
    this.srdConverter = dependencies.srdConverter;
    const spellListGrouper = SpellManager.getSpellListGrouper();
    const spellCriteria = new EntityCriteriaCollector([
      { name: 'lists', buildListEntry: spellListGrouper.buildListEntry },
      { name: 'level', validator: ShapedConfig.integerValidator },
      { name: 'school' },
      getBooleanCriterion('ritual'),
      getBooleanCriterion('concentration'),
    ], this.logger, this.entityLookup, 'spells');

    this.entityLookup.configureEntity('spells',
      [SpellManager.getSpellListEntityUpdater(), spellCriteria.getEntityProcessor()],
      EntityLookup.getVersionChecker('2.0.0', 'spells'));
    this.entityLookup.configureEntity('classes',
      [SpellManager.getSpellDenormaliser(), spellListGrouper.entityProcessor],
      EntityLookup.getVersionChecker('2.0.0', 'classes'));
    this.entityLister.addEntity('spells', 'spell', spellCriteria, this, false);
  }

  addCommands(commandProc) {
    commandProc
      .addCommand('remove-spell', this.removeSpell.bind(this), false)
      .option('all', ShapedConfig.booleanValidator, false)
      .option('character', ShapedConfig.getCharacterValidator(this.roll20), false)
      .option('relist', ShapedConfig.jsonValidator, false)
      .optionLookup('spells', this.spellLookup.bind(this), false)
      .withSelection({
        character: {
          min: 0,
          max: 1,
        },
      })
      // !shaped-import-spell, !shaped-spell
      .addCommand(['import-spell', 'spell'], this.importSpellsFromJson.bind(this), false)
      .optionLookup('spells', _.partial(this.entityLookup.findEntity.bind(this.entityLookup), 'spells', _, false), true)
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('character', ShapedConfig.getCharacterValidator(this.roll20))
      .option('relist', ShapedConfig.jsonValidator)
      .withSelection({
        character: {
          min: 0,
          max: 1,
        },
      })
      .addCommand('expand-spells', this.expandSpells.bind(this), false)
      .withSelection({
        character: {
          min: 0,
          max: Infinity,
        },
      })
      .option('all', ShapedConfig.booleanValidator);
  }

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', 'spell', 'castAsLevel'], this.handleSpellCast.bind(this));
    chatWatcher.registerChatListener(['title', 'subheader'], this.handleDivineSmite.bind(this));
  }

  handleDivineSmite(options) {
    if (options.title === 'Divine Smite') {
      options.spell = options.title;
      const match = options.subheader.match(/\(as (?:(\(4\))|(\d))\)/);
      options.castAsLevel = match[1] ? 5 : parseInt(match[2], 10);
      return this.handleSpellCast(options);
    }
    return null;
  }

  handleSpellCast(options) {
    const autoSlots = parseInt(this.roll20.getAttrByName(options.character.id,
      'automatically_expend_spell_resources'), 10);
    if (options.ritual || !autoSlots || options.spellLevel === 'CANTRIP' || options.spellRepeat) {
      return;
    }

    const castingLevel = parseInt(options.castAsLevel, 10);
    if (_.isNaN(castingLevel)) {
      this.logger.error('Bad casting level [$$$]', options.castAsLevel);
      this.reportError('An error occured with spell slots, see the log for more details', options.playerId);
      return;
    }

    const spellPointsAttr = this.roll20.getAttrObjectByName(options.character.id, 'spell_points');
    if (spellPointsAttr && spellPointsAttr.get('current')) {
      const spellPointsLimit = parseInt(this.roll20.getAttrByName(options.character.id, 'spell_points_limit'), 10);
      const cost = castingLevel + Math.floor(castingLevel / 3) + 1;
      if (castingLevel <= spellPointsLimit && cost <= spellPointsAttr.get('current')) {
        spellPointsAttr.setWithWorker({ current: spellPointsAttr.get('current') - cost });
        return;
      }
    }


    const spellSlotAttr = this.roll20.getAttrObjectByName(options.character.id, `spell_slots_l${options.castAsLevel}`);
    const warlockSlotsAttr = this.roll20.getAttrObjectByName(options.character.id, 'warlock_spell_slots');
    if (warlockSlotsAttr && warlockSlotsAttr.get('current')) {
      const warlockSlotsLevelString = this.roll20.getAttrByName(options.character.id, 'warlock_spells_max_level');
      this.logger.debug('Warlock slots level: $$$', warlockSlotsLevelString);
      const warlockSlotsLevel = warlockSlotsLevelString ? parseInt(warlockSlotsLevelString.substring(0, 1), 10) : 0;
      this.logger.debug('Parsed warlock slots level: $$$', warlockSlotsLevel);
      if (warlockSlotsLevel === castingLevel) {
        this.logger.debug('Decrementing warlock spell slots attribute $$$', warlockSlotsAttr);
        warlockSlotsAttr.setWithWorker({ current: warlockSlotsAttr.get('current') - 1 });
        return;
      }
    }

    if (spellSlotAttr && spellSlotAttr.get('current')) {
      this.logger.debug('Decrementing normal spell slots attribute $$$', spellSlotAttr);
      spellSlotAttr.setWithWorker({ current: spellSlotAttr.get('current') - 1 });
    }
    else {
      this.reportResult('Slots Police', `${options.characterName} cannot cast ${options.title} at level ` +
        `${options.castAsLevel} because they don't have enough spell slots/points.`, options);
    }
  }

  spellLookup(name, options) {
    const spellCache = this.getSpellCache(options);
    return spellCache[spellKey(name)];
  }


  getSpellCache(options) {
    const character = options.character || options.selected.character;
    if (!character) {
      return {};
    }
    const charId = character.id;
    const spellCache = options.getCache('characterSpells');
    if (!spellCache.initialised) {
      _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
        .filter(attr => attr.get('name').match(/^repeating_spell\d.*/))
        .groupBy(attr => attr.get('name').match(/^repeating_spell\d_([^_]+)/)[1])
        .each((attrs, id) => {
          const name = attrs.find(attr => attr.get('name').match(/^.*_name$/)).get('current');
          if (name) {
            spellCache[spellKey(name)] = { attrs, id, name };
          }
        });
      Object.defineProperty(spellCache, 'initialised', { value: true });
    }
    return spellCache;
  }

  importSpellsFromJson(options) {
    if (!ShapedConfig.checkCharacterSelectedOrSupplied(options, this.reporter)) {
      return null;
    }

    const spellCount = this.roll20
      .findObjs({ type: 'attribute', characterid: options.selected.character.id })
      .filter(attr => attr.get('name').match(/^repeating_spell\d.*_name$/))
      .length;

    if (spellCount > 35) {
      this.reportPlayer('Spell Count Warning', `Character ${options.selected.character.get('name')} ` +
        `already has ${spellCount} spells. Adding more spells will seriously degrade the performance of the sheet ` +
        'and your campaign more generally. ');
    }

    const msg = this.reporter.getMessageStreamer('Import Spells', options.playerId);
    return this.importData(options.selected.character, options.spells, options.overwrite, msg)
      .then(() => {
        const imported = options.spells.filter(spell => !spell.noImport);
        const skipped = options.spells.filter(spell => spell.noImport);
        let message = 'Import Complete<br>';
        if (!_.isEmpty(imported)) {
          message += 'Added the following spells:  <ul><li>' +
            `${_.map(imported, spell => spell.name).join('</li><li>')}</li></ul>`;
        }
        if (!_.isEmpty(skipped)) {
          message += 'Skipped the following spells which were already present (use --overwrite to replace): <ul><li>' +
            `${_.map(skipped, spell => spell.name).join('</li><li>')}</li></ul>`;
        }
        msg.finish(message);
        if (options.relist) {
          _.extend(options, options.relist);
          options.clearCache('characterSpells');
          this.entityLister.listEntity('spells', options);
        }
      });
  }

  importData(character, spells, overwrite, msg) {
    this.logger.debug('Importing new character spells $$$', spells);
    const pronounInfo = this.getPronounInfo(character);
    const spellAttrs = this.getSpellAttributesForImport(character, pronounInfo, spells, overwrite);
    return _.isEmpty(spellAttrs) ? Promise.resolve(character) :
      this.importer.runImportStage(character, spellAttrs, 'Importing spells', msg);
  }

  removeSpell(options) {
    if (!options.all && _.isEmpty(options.spells)) {
      this.reportError('You must supply either --all or a list of individual spells to !shaped-remove-spell');
      return;
    }
    if (!ShapedConfig.checkCharacterSelectedOrSupplied(options, this.reporter)) {
      return;
    }

    const spellCache = this.getSpellCache(options);
    if (options.all) {
      options.spells = _.values(spellCache);
    }

    const removed = options.spells.map((spellDetails) => {
      _.invoke(spellDetails.attrs, 'removeWithWorker');
      return spellDetails.name;
    });

    if (!_.isEmpty(removed)) {
      this.logger.debug('Spells removed: $$$', removed);
      this.reportPlayer('Spells Removed', 'Removed the following spells from character ' +
        `${options.selected.character.get('name')}: <ul><li>${removed.join('</li><li>')}</li></ul>`, options.playerId);
    }
    else {
      this.reportPlayer('No Spells Removed',
        `${options.selected.character.get('name')} has no spells to remove!`, options.playerId);
    }

    if (options.relist) {
      _.extend(options, options.relist);
      options.clearCache('characterSpells');
      this.entityLister.listEntity('spells', options);
    }
  }

  getSpellAttributesForCharacter(char) {
    return _.chain(this.roll20.findObjs({ type: 'attribute', characterid: char.id }))
      .filter(attribute => attribute.get('name').match(/^repeating_spell[\d]_[^_]+_/))
      .groupBy(attribute => attribute.get('name').match(/repeating_spell[\d]_([^_]+)_/)[1])
      .reduce((memo, spellAttrGroup, rowId) => {
        const nameAttr = spellAttrGroup
          .find(attribute => attribute.get('name').match(/^repeating_spell[\d]_[^_]+_name$/));
        if (!nameAttr) {
          return memo;
        }

        const name = nameAttr.get('current').replace(/\*/g, '').trim();
        const level = nameAttr.get('name').match(/^repeating_spell([\d])_[^_]+_name$/)[1];
        const hasContent = _.some(spellAttrGroup,
          attribute => attribute.get('name').match(/^repeating_spell[\d]_[^_]+_content/));
        memo[name.toLowerCase()] = {
          name,
          attributes: spellAttrGroup,
          hasContent,
          rowId,
          level,
        };
        return memo;
      }, {})
      .value();
  }

  getSpellAttributesForImport(char, pronounInfo, newSpells, overwrite) {
    const spells = this.getSpellAttributesForCharacter(char);

    const spellsToHydrate = _.chain(spells)
      .pick(spell => !spell.hasContent)
      .map((spell) => {
        const bareName = spell.name.replace(/\([^)]+\)/g, '').trim();
        const spellObject = this.entityLookup.findEntity('spells', bareName);
        if (spellObject) {
          spellObject.name = spell.name;
          spellObject.rowId = spell.rowId;
        }
        return spellObject;
      })
      .compact()
      .value();

    this.logger.debug('Existing Spells $$$', spells);
    const jsonSpellsToAdd = _.chain(newSpells)
      .map((spell, index) => {
        this.logger.debug('Checking for existing spell $$$', spell.name);
        const existingSpell = spells[spell.name.toLowerCase()];
        if (existingSpell) {
          this.logger.debug('Existing spell $$$', existingSpell);
          let newData = null;
          if (overwrite && existingSpell.hasContent) {
            spell.rowId = existingSpell.rowId;
            _.invoke(existingSpell.attributes, 'remove');
            newData = spell;
          }
          else if (!overwrite) {
            newSpells[index].noImport = true;
          }
          return newData;
        }

        return spell;
      })
      .compact()
      .value();

    const finalSpells = spellsToHydrate.concat(jsonSpellsToAdd);

    if (_.isEmpty(finalSpells)) {
      return {};
    }
    return { import_data: JSON.stringify({ spell_data: this.srdConverter.convertSpells(finalSpells, pronounInfo) }) };
  }

  getPronounInfo(character) {
    const gender = this.roll20.getAttrByName(character.id, 'gender');

    const defaultIndex = Math.min(this.myState.config.defaultGenderIndex, this.myState.config.genderPronouns.length);
    const defaultPronounInfo = this.myState.config.genderPronouns[defaultIndex];
    const pronounInfo = _.clone(_.find(this.myState.config.genderPronouns,
        pronounDetails => new RegExp(pronounDetails.matchPattern, 'i').test(gender)) || defaultPronounInfo);
    _.defaults(pronounInfo, defaultPronounInfo);
    return pronounInfo;
  }

  getButtoniser(options, relistOptions) {
    const spellCache = this.getSpellCache(options);
    const additionalOptions = `${relistOptions} ${this.getListCommandOptions(options)}`;
    return (spell) => {
      const alreadyAdded = !!spellCache[spellKey(spell.name)];
      const command = alreadyAdded ? '!shaped-remove-spell' : '!shaped-import-spell';
      const className = alreadyAdded ? 'remove' : '';
      return `<a href="${command} ${additionalOptions} --${spell.name}" class="${className}">${spell.name}</a>`;
    };
  }

  validateListCommandOptions(options) {
    return ShapedConfig.checkCharacterSelectedOrSupplied(options, this.reporter);
  }

  addOptionsForListCommand(cmd) {
    cmd
      .option('character', ShapedConfig.getCharacterValidator(this.roll20), false)
      .withSelection({
        character: {
          min: 0,
          max: 1,
        },
      });
  }

  getListCommandOptions(options) {
    return options.character ? `--character ${options.character.id}` : '';
  }

  expandSpells(options) {
    if (options.all) {
      options.selected.character = this.roll20.findObjs({ type: 'character' });
    }

    const msg = this.reporter.getMessageStreamer('Expand Spells', options.playerId);
    return options.selected.character.reduce((promise, character) =>
        promise.then(() => this.importData(character, [], false, msg)),
      Promise.resolve())
      .then(() => {
        const finalMessage = ' Spells expanded for characters: <ul><li>' +
          `${options.selected.character.map(char => char.get('name')).join('</li><li>')}</li></ul>`;
        msg.finish(finalMessage);
      });
  }

  static getSpellListEntityUpdater() {
    return (spellEntityInfo) => {
      const spell = spellEntityInfo.entity;
      const nameToLookFor = spellEntityInfo.previousName || spell.name;
      spellEntityInfo.lookup('classes').forEach((clazz) => {
        const newLists = [];
        [clazz].concat(clazz.archetypes)
          .filter(parent => parent && parent.spells)
          .forEach((parent) => {
            const index = parent.spells.findIndex(classSpell => classSpell === nameToLookFor);
            if (index !== -1) {
              newLists.push(parent.name);
              if (spellEntityInfo.previousName !== spell.name) {
                parent.spells[index] = spell.name;
              }
            }
          });
        spell.lists = _.union(spell.lists, newLists);
      });
      if (spellEntityInfo.previousName !== spell.name) {
        const re = new RegExp(spellEntityInfo.previousName, 'ig');
        _.chain(spellEntityInfo.lookup('monsters'))
          .pluck('traits')
          .flatten()
          .filter(trait => trait && trait.name.toLowerCase().includes('spellcasting'))
          .forEach(trait => (trait.text = trait.text.replace(re, spell.name.toLowerCase())));
      }
      return spellEntityInfo;
    };
  }

  static getSpellDenormaliser() {
    return (classEntityInfo) => {
      const classObj = classEntityInfo.entity;
      if (classObj.spells) {
        addSpellListToSpells(classObj.spells, classObj.name, classEntityInfo.lookup);
      }
      if (classObj.archetypes) {
        _.each(classObj.archetypes, (archetype) => {
          if (archetype.spells) {
            addSpellListToSpells(archetype.spells, archetype.name, classEntityInfo.lookup);
          }
        });
      }
      return classEntityInfo;
    };
  }

  static getSpellListGrouper() {
    const classForLists = {};
    return {
      get entityProcessor() {
        return (entityInfo) => {
          const clazz = entityInfo.entity;
          if (clazz.archetypes) {
            clazz.archetypes.forEach(archetype => (classForLists[archetype.name] = clazz.name));
            classForLists[clazz.name] = clazz.name;
          }
          return entityInfo;
        };
      },
      buildListEntry(suppliedCriteria, entitySpecificOptions) {
        const critRows = _.chain(this.values)
          .reduce((rows, list) => {
            const parentClass = classForLists[list];
            if (parentClass) {
              (rows[parentClass] = rows[parentClass] || { values: [] }).values.push(list);
              if (_.contains(suppliedCriteria.lists, list)) {
                rows[parentClass].hasSelectedValues = true;
              }
              if (parentClass === list) {
                rows.top.values.push(list);
              }
            }
            else {
              rows.top.values.push(list);
            }
            return rows;
          }, { top: { values: [] } })
          .omit((row, parentClass) => !(parentClass === 'top' || row.hasSelectedValues))
          .value();

        return _.map(critRows, (row, parentClass) => {
          const mainClassList = parentClass === 'top';
          const name = mainClassList ? 'Classes' : `${Utils.toTitleCase(parentClass)} Archetypes`;


          const valueList = row.values
            .sort((val1, val2) => {
              if (val1 === parentClass) {
                return -1;
              }
              if (val2 === parentClass) {
                return 1;
              }
              return val1.localeCompare(val2);
            })
            .map((value) => {
              const selected = _.contains(suppliedCriteria.lists, value) ||
                (mainClassList && critRows[value] && critRows[value].hasSelectedValues);
              const className = selected ? 'selected' : '';

              let newOpts = '';
              if (parentClass === 'top' && critRows[value] && selected) {
                const newCriteria = Utils.deepClone(suppliedCriteria);
                newCriteria.lists = newCriteria.lists.filter(list => !row.values.includes(list));
                newOpts = makeOptionsString(newCriteria);
              }
              else {
                newOpts = buildNewOptionsString(suppliedCriteria, 'lists', value);
              }
              const displayName = value === parentClass ? 'Class' : value;
              return `<a href="!shaped-list-spells ${newOpts} ${entitySpecificOptions}" class="${className}">` +
                `${displayName}</a>`;
            }).join(', ');
          return `<div class="criterion"><span class="criterion-name">${name}. </span>${valueList}</div>`;
        }).join('');
      },
    };
  }
};

function buildNewOptionsString(suppliedCriteria, criterionToModify, valueToToggle) {
  const newCriteria = Utils.deepClone(suppliedCriteria);
  if (!newCriteria[criterionToModify]) {
    newCriteria[criterionToModify] = [valueToToggle];
  }
  else {
    const valueList = newCriteria[criterionToModify];
    newCriteria[criterionToModify] = _.contains(valueList, valueToToggle) ? _.without(valueList, valueToToggle) :
      valueList.concat(valueToToggle);
  }
  return makeOptionsString(newCriteria);
}

function makeOptionsString(criteria) {
  return _.reduce(criteria, (optionString, valueList, criterion) =>
    (_.isEmpty(valueList) ? optionString : `${optionString} --${criterion} ${valueList.join(',')}`), '');
}

function addSpellListToSpells(spells, spellListName, lookup) {
  lookup('spells').forEach((existingSpell) => {
    if (spells.includes(existingSpell.name)) {
      existingSpell.lists = _.union(existingSpell.lists, [spellListName]);
    }
    else if (existingSpell.lists.includes(spellListName)) {
      existingSpell.lists = _.without(existingSpell.lists, spellListName);
    }
  });
}
