/* globals unescape */
'use strict';
const _ = require('underscore');
const parseModule = require('./parser');
const makeCommandProc = require('./command-parser');
const utils = require('./utils');
const UserError = require('./user-error');
const Migrator = require('./migrations');
const ShapedConfig = require('./shaped-config');
// Modules
const AbilityMaker = require('./ability-maker');
const ConfigUI = require('./config-ui');
const AdvantageTracker = require('./advantage-tracker');
const RestManager = require('./rest-manager');
const UsesManager = require('./uses-manager');
const AmmoManager = require('./ammo-manager');
/**
 * @typedef {Object} ChatMessage
 * @property {string} content
 * @property {string} type
 * @property {SelectedItem[]} selected
 * @property {string} rolltemplate
 */


/**
 *
 * @typedef {Object} SelectedItem
 * @property {string} _id
 * @property (string _type
 */


module.exports = ShapedScripts;

function ShapedScripts(logger, myState, roll20, parser, entityLookup, reporter, srdConverter, sanitise) {
  let addedTokenIds = [];
  const reportPublic = reporter.reportPublic.bind(reporter);
  const reportPlayer = reporter.reportPlayer.bind(reporter);
  const reportError = reporter.reportError.bind(reporter);
  const commandProc = makeCommandProc('shaped', roll20);
  const chatWatchers = [];
  const advantageTracker = new AdvantageTracker();
  const usesManager = new UsesManager();
  const ammoManager = new AmmoManager();
  const abilityMaker = new AbilityMaker();
  const errorHandler = function errorHandler(e) {
    if (typeof e === 'string' || e instanceof parseModule.ParserError || e instanceof UserError) {
      reportError(e);
      logger.error('Error: $$$', e.toString());
    }
    else {
      logger.error(e.toString());
      logger.error(e.stack);
      reportError('An error occurred. Please see the log for more details.');
    }
  };
  const modules = [
    abilityMaker,
    new ConfigUI(),
    advantageTracker,
    usesManager,
    new RestManager(),
    ammoManager,
  ];

  modules.forEach(module => module.configure(roll20, reporter, logger, myState, commandProc));

  /**
   *
   * @param {ChatMessage} msg
   */
  this.handleInput = function handleInput(msg) {
    logger.debug(msg);
    if (msg.playerid === 'API') {
      return;
    }

    reporter.setPlayer(msg.playerid);
    if (msg.type !== 'api') {
      this.triggerChatWatchers(msg);
      return;
    }

    this.oldStyleModulesConfigure(commandProc).processCommand(msg);
  };


  /////////////////////////////////////////
  // Command handlers
  /////////////////////////////////////////
  this.applyTokenDefaults = function applyTokenDefaults(options) {
    _.each(options.selected.graphic, (token) => {
      const represents = token.get('represents');
      const character = roll20.getObj('character', represents);
      if (character) {
        this.applyCharacterDefaults(character);
        this.createTokenActions(character);
        this.getTokenConfigurer(token)(character);
        const isNpc = roll20.getAttrByName(character.id, 'is_npc');
        let sensesString;
        if (isNpc === 1) {
          sensesString = roll20.getAttrByName(character.id, 'senses');
        }
        else {
          sensesString = ['blindsight', 'darkvision', 'tremorsense', 'truesight']
            .map(sense => [sense, roll20.getAttrByName(character.id, sense)])
            .filter(senseInfo => senseInfo[1])
            .map(senseInfo => `${senseInfo[0]} ${senseInfo[1]}`)
            .join(',');
        }
        this.getTokenVisionConfigurer(token, sensesString)(character);
        this.getDefaultTokenPersister(token)(character);
      }
    });
  };

  this.importStatblock = function importStatblock(options) {
    logger.info('Importing statblocks for tokens $$$', options.selected.graphic);
    _.each(options.selected.graphic, (token) => {
      const error = `Could not find GM notes on either selected token ${token.get('name')} or the character ` +
        'it represents. Have you pasted it in correctly?';
      const text = token.get('gmnotes');
      if (!text) {
        const char = roll20.getObj('character', token.get('represents'));
        if (char) {
          char.get('gmnotes', (notes) => {
            if (notes) {
              return this.processGMNotes(options, token, notes);
            }
            return reportError(error);
          });
        }
        else {
          return reportError(error);
        }
      }

      return this.processGMNotes(options, token, text);
    });
  };

  this.processGMNotes = function processGMNotes(options, token, text) {
    text = sanitise(unescape(text), logger);
    const monsters = parser.parse(text).monsters;
    this.importMonsters(monsters, options, token, [
      function gmNotesSetter(character) {
        character.set('gmnotes', text.replace(/\n/g, '<br>'));
      },
    ]);
  };

  this.importMonstersFromJson = function importMonstersFromJson(options) {
    if (options.all) {
      options.monsters = entityLookup.getAll('monsters');
      delete options.all;
    }

    if (_.isEmpty(options.monsters)) {
      this.showEntityPicker('monster', 'monsters');
    }
    else {
      this.importMonsters(options.monsters.slice(0, 20), options, options.selected.graphic, []);
      options.monsters = options.monsters.slice(20);
      if (!_.isEmpty(options.monsters)) {
        setTimeout(() => this.importMonstersFromJson(options), 200);
      }
    }
  };

  this.importMonsters = function importMonsters(monsters, options, token, characterProcessors) {
    const characterRetrievalStrategies = [];

    if (_.size(monsters) === 1 && options.as) {
      monsters[0].name = options.as;
    }

    if (token) {
      characterProcessors.push(this.getAvatarCopier(token).bind(this));
      if (_.size(monsters) === 1) {
        characterProcessors.push(this.getTokenConfigurer(token, true).bind(this));
        characterProcessors.push(this.getTokenVisionConfigurer(token, monsters[0].senses));
        characterProcessors.push(this.getDefaultTokenPersister(token));
        if (options.replace || options.overwrite) {
          characterRetrievalStrategies.push(this.getTokenRetrievalStrategy(token).bind(this));
        }
      }
    }
    if (options.replace) {
      characterRetrievalStrategies.push(this.nameRetrievalStrategy);
    }

    characterRetrievalStrategies.push(this.creationRetrievalStrategy.bind(this));
    characterProcessors.push(this.applyCharacterDefaults.bind(this));
    characterProcessors.push(this.monsterDataPopulator.bind(this));
    characterProcessors.push(this.createTokenActions.bind(this));

    const errors = [];
    const importedPromisesList = _.chain(monsters)
      .map((monsterData) => {
        const character = _.reduce(characterRetrievalStrategies,
          (result, strategy) => result || strategy(monsterData.name, errors), null);

        if (!character) {
          logger.error('Failed to find or create character for monster $$$', monsterData.name);
          return null;
        }

        const oldAttrs = roll20.findObjs({ type: 'attribute', characterid: character.id });
        _.invoke(oldAttrs, 'remove');
        character.set('name', monsterData.name);

        return characterProcessors.reduce((charPromise, proc) =>
            charPromise.then(updatedChar => proc(updatedChar, monsterData))
          , Promise.resolve(character)).catch(errorHandler);
      })
      .compact()
      .value();


    return Promise.all(importedPromisesList).then((importedList) => {
      logger.debug('All monsters imported $$$', importedList);
      if (!_.isEmpty(importedList)) {
        const monsterList = importedList.map(char => char.get('name')).join('</li><li>');
        reportPlayer('Import Success', `Added the following monsters: <ul><li>${monsterList}</li></ul>`);
      }
      if (!_.isEmpty(errors)) {
        const errorList = errors.join('</li><li>');
        reportError(`The following errors occurred on import:  <ul><li>${errorList}</li></ul>`);
      }
      return {
        errors,
        importedList,
      };
    });
  };

  this.importSpellsFromJson = function importSpellsFromJson(options) {
    if (_.isEmpty(options.spells)) {
      this.showEntityPicker('spell', 'spells');
    }
    else {
      this.importData(options.selected.character, _.pick(options, 'spells'))
        .then(() => {
          reportPlayer('Import Success', 'Added the following spells:  <ul><li>' +
            `${_.map(options.spells, spell => spell.name).join('</li><li>')}</li></ul>`);
        });
    }
  };

  this.importSpellListFromJson = function importSpellListFromJson(options) {
    const spells = entityLookup.searchEntities('spells', _.pick(options, _.keys(ShapedConfig.spellSearchOptions)));
    const newOpts = _.omit(options, _.keys(ShapedConfig.spellSearchOptions));
    newOpts.spells = spells;
    this.importSpellsFromJson(newOpts);
  };

  this.getEntityCriteriaAdaptor = function getEntityCriteriaAdaptor(entityType) {
    return function entityCriteriaAdaptor(criterionOption, options) {
      const result = entityLookup.searchEntities(entityType, criterionOption, options[entityType]);
      if (result) {
        // If we get a result, wipe the existing list so that the new one replaces it
        options[entityType] = [];
      }
      return result;
    };
  };

  this.showEntityPicker = function showEntityPicker(entityName, entityNamePlural) {
    const list = entityLookup.getKeys(entityNamePlural, true);

    if (!_.isEmpty(list)) {
      // title case the  names for better display
      list.forEach((part, index) => (list[index] = utils.toTitleCase(part)));

      // create a clickable button with a roll query to select an entity from the loaded json
      reportPlayer(`${utils.toTitleCase(entityName)} Importer`,
        `<a href="!shaped-import-${entityName} --?{Pick a ${entityName}|${list.join('|')}}">Click to select a ` +
        `${entityName}</a>`);
    }
    else {
      reportError(`Could not find any ${entityNamePlural}.<br/>Please ensure you have a properly formatted ` +
        `${entityNamePlural} json file.`);
    }
  };


  this.monsterDataPopulator = function monsterDataPopulator(character, monsterData) {
    const converted = srdConverter.convertMonster(monsterData);
    logger.debug('Converted monster data: $$$', converted);
    return this.importData(character, converted);
  };

  this.importData = function importData(character, data) {
    logger.debug('Importing new character data $$$', data);
    const pronounInfo = this.getPronounInfo(character);
    const coreAttrsNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const coreAttributes = _.pick(data, coreAttrsNames);
    const secondaryAttributes = _.omit(data, coreAttrsNames, 'spells', 'content_srd');
    const contentSrd = _.pick(data, 'content_srd');
    const jsonSpells = data.spells;
    let charPromise = Promise.resolve(character);
    if (!roll20.getAttrByName(character.id, 'version')) {
      charPromise = this.runImportStage(character, { trigger_open: 1 }, 'Creating character');
    }

    return charPromise
      .then(newChar => this.runImportStage(newChar, coreAttributes, 'Importing core attributes'))
      .then(newChar => this.runImportStage(newChar, secondaryAttributes, 'Importing secondary attributes'))
      .then(newChar => this.runImportStage(newChar, contentSrd, 'Importing srd content'))
      .then(newChar =>
        this.runImportStage(newChar, this.getSpellAttributesForImport(newChar, pronounInfo, jsonSpells, false),
          'Importing spells'))
      .then(newChar => this.runImportStage(newChar, { processing: '' }, 'Importing complete'))
      .catch(errorHandler);
  };

  this.getSpellAttributesForCharacter = function getSpellAttributesForCharacter(char) {
    return _.chain(roll20.findObjs({ type: 'attribute', characterid: char.id }))
      .filter(attribute => attribute.get('name').match(/^repeating_spell.*/))
      .groupBy(attribute => attribute.get('name').match(/repeating_spell[\d]_([^_]+)_/)[1])
      .reduce((memo, spellAttrGroup, rowId) => {
        const nameAttr = spellAttrGroup
          .find(attribute => attribute.get('name').match(/^repeating_spell.*/));
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
  };

  this.getSpellAttributesForImport = function getSpellAttributesForImport(char, pronounInfo, newSpells, overwrite) {
    const spells = this.getSpellAttributesForCharacter(char);

    const spellsToHydrate = _.chain(spells)
      .pick(spell => !spell.hasContent)
      .map((spell) => {
        const bareName = spell.name.replace(/\([^)]+\)/g, '').trim();
        const spellObject = entityLookup.findEntity('spells', bareName);
        if (spellObject) {
          spellObject.name = spell.name;
          spellObject.rowId = spell.rowId;
        }
        return spellObject;
      })
      .compact()
      .value();

    logger.debug('Existing Spells $$$', spells);
    const jsonSpellsToAdd = _.chain(newSpells)
      .map((spell, index) => {
        logger.debug('Checking for existing spell $$$', spell.name);
        const existingSpell = spells[spell.name.toLowerCase()];
        if (existingSpell) {
          logger.debug('Existing spell $$$', existingSpell);
          let newData = null;
          if (overwrite && existingSpell.hasContent) {
            spell.rowId = existingSpell.rowId;
            _.invoke(existingSpell.attributes, 'remove');
            newData = spell;
          }
          else if (!overwrite) {
            delete newSpells[index];
          }
          return newData;
        }

        return spell;
      })
      .compact()
      .value();

    return srdConverter.convertSpells(spellsToHydrate.concat(jsonSpellsToAdd), pronounInfo);
  };

  this.runImportStage = function runImportStage(character, attributes, name) {
    const initialPromise = Promise.resolve(character);
    if (!_.isEmpty(attributes)) {
      logger.debug('Importing attributes for stage $$$: $$$', name, attributes);
      roll20.sendChat(`${character.get('name')} Import`, `${name}`);
      logger.debug(`${name} start`);

      return _.chain(attributes)
        .reduce((executionGroups, attrVal, attrName) => {
          const lastGroupSize = _.size(executionGroups[executionGroups.length - 1]);
          if (lastGroupSize >= 50) {
            executionGroups.push({ attrName: attrVal });
          }
          else {
            executionGroups[executionGroups.length - 1][attrName] = attrVal;
          }
          return executionGroups;
        }, [{}])
        .reduce((promise, executionGroup, index) =>
          promise.then((newChar) => {
            const newPromise = new Promise(resolve => roll20.onSheetWorkerCompleted(() => {
              logger.debug(`Sheet worker completed for ${name} ${index}`);
              resolve(newChar);
            }));
            _.each(executionGroup, (attrVal, attrName) => {
              roll20.setAttrWithWorker(character.id, attrName, attrVal);
            });
            return newPromise;
          }), initialPromise)
        .value();
    }
    return initialPromise;
  };

  this.getPronounInfo = function getPronounInfo(character) {
    const gender = roll20.getAttrByName(character.id, 'gender');

    const defaultIndex = Math.min(myState.config.defaultGenderIndex, myState.config.genderPronouns.length);
    const defaultPronounInfo = myState.config.genderPronouns[defaultIndex];
    const pronounInfo = _.clone(_.find(myState.config.genderPronouns,
        pronounDetails => new RegExp(pronounDetails.matchPattern, 'i').test(gender)) || defaultPronounInfo);
    _.defaults(pronounInfo, defaultPronounInfo);
    return pronounInfo;
  };


  this.getSpellHydrationAttributes = function getSpellHydrationAttributes(character, pronounInfo) {
    const spells = _.chain(roll20.findObjs({ type: 'attribute', characterid: character.id }))
      .filter(attribute => attribute.get('name').match(/^repeating_spell.*/))
      .groupBy(attribute => attribute.get('name').match(/repeating_spell[\d]_([^_]+)_/)[1])
      .omit(spellAttrs => _.size(spellAttrs) > 9) // Omit spells that have already been populated somehow
      .map((spellAttrs, rowId) => {
        const nameAttr = spellAttrs.find(attr => attr.get('name').match(/repeating_spell[\d]_[^_]+_name/));
        if (nameAttr) {
          const annotatedSpellName = nameAttr.get('current');
          const bareSpellName = annotatedSpellName.replace(/\*|\([^)]+\)/g, '').trim();
          const spellObject = entityLookup.findEntity('spells', bareSpellName);
          if (spellObject) {
            spellObject.name = annotatedSpellName;
            spellObject.rowId = rowId;
          }
          return spellObject;
        }
        return null;
      })
      .compact()
      .value();

    return srdConverter.convertSpells(spells, pronounInfo);
  };

  this.getTokenRetrievalStrategy = function getTokenRetrievalStrategy(token) {
    return function tokenRetrievalStrategy(name, errors) {
      if (token) {
        const character = roll20.getObj('character', token.get('represents'));
        if (character && roll20.getAttrByName(character.id, 'locked')) {
          errors.push(`Character with name ${character.get('name')} and id ${character.id}` +
            ' was locked and cannot be overwritten');
          return null;
        }
        return character;
      }
      return null;
    };
  };

  this.nameRetrievalStrategy = function nameRetrievalStrategy(name, errors) {
    const chars = roll20.findObjs({ type: 'character', name });
    if (chars.length > 1) {
      errors.push(`More than one existing character found with name "${name}". Can't replace`);
      return null;
    }

    if (chars[0] && roll20.getAttrByName(chars[0].id, 'locked')) {
      errors.push(`Character with name ${chars[0].get('name')} and id ${chars[0].id}` +
        ' was locked and cannot be overwritten');
      return null;
    }

    return chars[0];
  };

  this.creationRetrievalStrategy = function creationRetrievalStrategy(name, errors) {
    if (!_.isEmpty(roll20.findObjs({ type: 'character', name }))) {
      errors.push(`Can't create new character with name "${name}` +
        '" because one already exists with that name. Perhaps you want --replace?');
      return null;
    }

    return roll20.createObj('character', { name });
  };

  this.getAvatarCopier = function getAvatarCopier(token) {
    return function avatarCopier(character) {
      character.set('avatar', token.get('imgsrc'));
      return character;
    };
  };

  this.applyCharacterDefaults = function applyCharacterDefaults(character) {
    const completionPromise = new Promise(resolve => roll20.onSheetWorkerCompleted(() => resolve(character)));
    _.each(utils.flattenObject(_.omit(myState.config.newCharSettings, 'tokenActions')), (value, key) => {
      const attrName = ShapedConfig.configToAttributeLookup[key];
      if (attrName) {
        const attribute = roll20.getOrCreateAttr(character.id, attrName);
        if (value === '***default***' || (_.isBoolean(value) && !value)) {
          attribute.removeWithWorker();
        }
        else {
          attribute.setWithWorker('current', _.isBoolean(value) ? 1 : value);
        }
      }
    });
    return completionPromise;
  };

  this.createTokenActions = function createTokenActions(character) {
    const abilityNames = _.chain(myState.config.newCharSettings.tokenActions)
      .map((action, actionName) => (action === true ? actionName : action))
      .compact()
      .values()
      .value();
    abilityMaker.addAbilitiesByName(abilityNames, character);
    return character;
  };

  this.getTokenConfigurer = function getTokenConfigurer(token, monsterImport) {
    return function tokenConfigurer(character) {
      const isNpcLiteral = roll20.getAttrByName(character.id, 'is_npc');
      const isNpc = (isNpcLiteral === 1 || isNpcLiteral === '1' || monsterImport);
      logger.debug('isNPC $$$ $$$', isNpcLiteral, isNpc);
      token.set('represents', character.id);
      token.set('name', character.get('name'));
      const settings = myState.config.tokenSettings;
      if (settings.number && isNpc && token.get('name').indexOf('%%NUMBERED%%') === -1) {
        token.set('name', `${token.get('name')} %%NUMBERED%%`);
      }

      _.chain(settings)
        .pick(['bar1', 'bar2', 'bar3'])
        .each((bar, barName) => {
          if (!_.isEmpty(bar.attribute)) {
            const attribute = roll20.getOrCreateAttr(character.id, bar.attribute);
            if (attribute) {
              if (bar.link) {
                token.set(`${barName}_link`, attribute.id);
              }
              else {
                token.set(`${barName}_link`, '');
              }
              token.set(`${barName}_value`, attribute.get('current'));
              if (bar.max) {
                token.set(`${barName}_max`, attribute.get('max'));
              }
              else {
                token.set(`${barName}_max`, '');
              }
              token.set(`showplayers_${barName}`, bar.showPlayers);
            }
          }
        });

      // auras
      _.chain(settings)
        .pick(['aura1', 'aura2'])
        .each((aura, auraName) => {
          token.set(`${auraName}_radius`, aura.radius);
          token.set(`${auraName}_color`, aura.color);
          token.set(`${auraName}_square`, aura.square);
        });

      logger.debug('Settings for tokens: $$$', settings);
      token.set('showname', settings.showName);
      token.set('showplayers_name', settings.showNameToPlayers);
      token.set('showplayers_aura1', settings.showAura1ToPlayers);
      token.set('showplayers_aura2', settings.showAura2ToPlayers);
      token.set('light_radius', settings.light.radius);
      token.set('light_dimradius', settings.light.dimRadius);
      token.set('light_otherplayers', settings.light.otherPlayers);
      token.set('light_hassight', settings.light.hasSight);
      token.set('light_angle', settings.light.angle);
      token.set('light_losangle', settings.light.losAngle);
      token.set('light_multiplier', settings.light.multiplier);
      return character;
    };
  };

  this.getTokenVisionConfigurer = function getTokenVisionConfigurer(token, sensesString) {
    if (_.isEmpty(sensesString)) {
      logger.debug('Empty senses string, using default values');
      return _.identity;
    }

    function fullRadiusLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, this.lightRadius));
      token.set('light_dimradius', Math.max(token.get('light_dimradius') || 0, this.lightRadius));
    }

    function darkvisionLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, Math.round(this.lightRadius * 1.1666666)));
      if (!token.get('light_dimradius')) {
        token.set('light_dimradius', -5);
      }
    }

    const configureFunctions = {
      blindsight: fullRadiusLightConfigurer,
      truesight: fullRadiusLightConfigurer,
      tremorsense: fullRadiusLightConfigurer,
      darkvision: darkvisionLightConfigurer,
    };

    const re = /(blindsight|darkvision|tremorsense|truesight)\s+(\d+)/;
    let match;
    const senses = [];
    while ((match = sensesString.match(re))) {
      senses.push({
        name: match[1],
        lightRadius: parseInt(match[2], 10),
        configureVision: configureFunctions[match[1]],
      });
      sensesString = sensesString.slice(match.index + match[0].length);
    }

    return function configureTokenVision(character) {
      senses.forEach(sense => sense.configureVision());
      return character;
    };
  };

  this.getDefaultTokenPersister = function getDefaultTokenPersister(token) {
    return function persistDefaultToken(character) {
      roll20.setDefaultTokenForCharacter(character, token);
      return character;
    };
  };


  this.handleSlots = function handleSlots(options) {
    if (options.use) {
      roll20.processAttrValue(options.character.id, `spell_slots_l${options.use}`, val => Math.max(0, --val));
    }
    if (options.restore) {
      const attrName = `spell_slots_l${options.restore}`;
      const max = roll20.getAttrByName(options.character.id, attrName, 'max');
      roll20.processAttrValue(options.character.id, `spell_slots_l${options.restore}`, (val) => {
        const retVal = Math.min(max, ++val);
        logger.debug('Setting attribute to $$$', retVal);
        return retVal;
      });
    }
  };

  /////////////////////////////////////////////////
  // Event Handlers
  /////////////////////////////////////////////////
  this.handleAddToken = function handleAddToken(token) {
    const represents = token.get('represents');
    if (_.isEmpty(represents)) {
      return;
    }
    const character = roll20.getObj('character', represents);
    if (!character) {
      return;
    }
    addedTokenIds.push(token.id);

    const wrappedChangeToken = this.wrapHandler(this.handleChangeToken);

    // URGH. Thanks Roll20.
    setTimeout((function wrapper(id) {
      return function innerWrapper() {
        const addedToken = roll20.getObj('graphic', id);
        if (addedToken) {
          wrappedChangeToken(addedToken);
        }
      };
      /* eslint-disable no-spaced-func */
    }(token.id)), 100);
    /* eslint-enable no-spaced-func */
  };

  this.handleChangeToken = function handleChangeToken(token) {
    if (_.contains(addedTokenIds, token.id)) {
      addedTokenIds = _.without(addedTokenIds, token.id);
      this.setTokenBarsOnDrop(token, true);
      advantageTracker.handleTokenChange(token);
    }
  };

  this.handleAddCharacter = function handleAddCharacter(character) {
    if (myState.config.newCharSettings.applyToAll) {
      this.applyCharacterDefaults(character);
    }
  };

  this.setTokenBarsOnDrop = function setTokenBarsOnDrop(token, overwrite) {
    const character = roll20.getObj('character', token.get('represents'));
    if (!character) {
      return;
    }

    function setBar(barName, bar, value) {
      if (value) {
        token.set(`${barName}_value`, value);
        if (bar.max) {
          token.set(`${barName}_max`, value);
        }
      }
    }

    _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .each((bar, barName) => {
        if (bar.attribute && !token.get(`${barName}_link`) && (!token.get(`${barName}_value`) || overwrite)) {
          if (bar.attribute === 'HP' && myState.config.sheetEnhancements.rollHPOnDrop) {
            // Guard against characters that aren't properly configured - i.e. ones used for templates and system
            // things rather than actual characters
            if (_.isEmpty(roll20.getAttrByName(character.id, 'hp_formula'))) {
              logger.debug('Ignoring character $$$ for rolling HP - has no hp_formula attribute',
                character.get('name'));
              return;
            }
            roll20.sendChat('', `%{${character.get('name')}|shaped_npc_hp}`, (results) => {
              if (results && results.length === 1) {
                const message = this.processInlinerolls(results[0]);
                if (!results[0].inlinerolls || !results[0].inlinerolls[0]) {
                  logger.warn('HP roll didn\'t have the expected structure. This is what we got back: $$$',
                    results[0]);
                }
                else {
                  roll20.sendChat('HP Roller', `/w GM &{template:5e-shaped} ${message}`, null, { noarchive: true });
                  setBar(barName, bar, results[0].inlinerolls[0].results.total);
                }
              }
            });
          }
          else {
            setBar(barName, bar, roll20.getAttrByName(character.id, bar.attribute));
          }
        }
      });
  };

  this.registerChatWatcher = function registerChatWatcher(handler, triggerFields) {
    const matchers = [];
    if (triggerFields && !_.isEmpty(triggerFields)) {
      matchers.push((msg, options) => {
        logger.debug('Matching options: $$$ against triggerFields $$$', options, triggerFields);
        return _.intersection(triggerFields, _.keys(options)).length === triggerFields.length;
      });
    }
    chatWatchers.push({ matchers, handler: handler.bind(this) });
  };

  this.triggerChatWatchers = function triggerChatWatchers(msg) {
    const options = this.getRollTemplateOptions(msg);
    logger.debug('Roll template options: $$$', options);
    _.each(chatWatchers, (watcher) => {
      if (_.every(watcher.matchers, matcher => matcher(msg, options))) {
        watcher.handler(options, msg);
      }
    });
  };

  /**
   *
   * @param options
   * @param {ChatMessage} msg
   */
  this.handleAmmo = function handleAmmo(options, msg) {
    if (!roll20.checkCharacterFlag(options.character.id, 'ammo_auto_use')) {
      return;
    }

    ammoManager.consumeAmmo(options, msg);
  };

  this.handleHD = function handleHD(options, msg) {
    const match = options.title.match(/(\d+)d(\d+) HIT_DICE/);
    if (match && myState.config.sheetEnhancements.autoHD) {
      const hdCount = parseInt(match[1], 10);
      const hdSize = match[2];
      const hdAttr = roll20.getAttrObjectByName(options.character.id, `hd_d${hdSize}`);
      const hpAttr = roll20.getOrCreateAttr(options.character.id, 'HP');
      const newHp = Math.min(parseInt(hpAttr.get('current') || 0, 10) +
        this.getRollValue(msg, options.roll1), hpAttr.get('max') || Infinity);

      if (hdAttr) {
        if (hdCount <= hdAttr.get('current')) {
          hdAttr.setWithWorker('current', hdAttr.get('current') - hdCount);
          hpAttr.setWithWorker('current', newHp);
          if (!hpAttr.get('max')) {
            hpAttr.setWithWorker('max', newHp);
          }
        }
        else {
          reportPublic('HD Police', `${options.characterName} can't use ${hdCount}d${hdSize} hit dice because they ` +
            `only have ${hdAttr.get('current')} left`);
        }
      }
    }
  };

  this.handleD20Roll = function handleD20Roll(options) {
    const autoRevertOptions = roll20.getAttrByName(options.character.id, 'auto_revert_advantage');
    if (autoRevertOptions === 1) {
      advantageTracker.setRollOption('normal', [options.character]);
    }
  };

  this.handleUses = function handleTraitClick(options) {
    if (myState.config.sheetEnhancements.autoTraits) {
      usesManager.handleUses(options);
    }
  };

  this.handleSpellCast = function handleSpellCast(options) {
    if (options.friendlyLevel === 'Cantrip' || !myState.config.sheetEnhancements.autoSpellSlots) {
      return;
    }

    const spellLevel = parseInt(options.friendlyLevel.slice(0, 1), 10);
    const level = options.castAsLevel ? parseInt(options.castAsLevel, 10) : spellLevel;
    const availableSlots = _.chain(_.range(spellLevel, 10))
      .map(slotLevel => roll20.getAttrObjectByName(options.character.id, `spell_slots_l${slotLevel}`))
      .compact()
      .filter(attr => attr.get('current') > 0)
      .value();

    const spellId = _.chain(roll20.getRepeatingSectionItemIdsByName(options.character.id, 'spell'))
      .pick(options.title.toLowerCase())
      .values()
      .first()
      .value();

    logger.debug('Spell id : $$$', spellId);

    const ritual = spellId ? !!roll20.getAttrByName(options.character.id, `repeating_spell_${spellId}_ritual`) : false;

    let msg;

    const bestSlot = availableSlots
        .find(slot => parseInt(slot.get('name').match(/spell_slots_l(\d)/)[1], 10) === level) ||
      _.first(availableSlots);

    if (bestSlot) {
      const slotLevel = parseInt(bestSlot.get('name').match(/spell_slots_l(\d)/)[1], 10);
      if (slotLevel === level) {
        bestSlot.set('current', bestSlot.get('current') - 1);
        if (ritual) {
          msg = `1 slot of level ${level} used. [Cast as ritual](!shaped-slots --restore ${level} ` +
            `--character ${options.character.id}) instead?`;
        }
      }
      else if (!options.castAsLevel) {
        msg = `You have no level ${level} spell slots left. Do you want to ` +
          `[Cast at level ${slotLevel}](!shaped-slots --use ${slotLevel} --character ${options.character.id}) instead?`;
        if (ritual) {
          msg += ' Alternatively, you could cast a ritual without using a slot.';
        }
      }
      else {
        msg = `You have no ${level} spell slots left. You can ` +
          `[Recast at level ${slotLevel}](!&#13;&#37;{${options.character.get('name')}` +
          `|repeating_spell_${spellId}_spell})`;
        if (ritual) {
          msg += ' or cast as a ritual instead.';
        }
      }
    }
    else {
      msg = `${options.character.get('name')} has no spell slots of level ${level} to cast ${options.title}`;
      if (ritual) {
        msg += ' but could cast as a ritual instead without using a slot.';
      }
    }

    if (msg) {
      roll20.sendChat('Spell Slots Police', msg, null, { noarchive: true });
    }
  };

  this.handleDeathSave = function handleDeathSave(options, msg) {
    if (roll20.getAttrByName(options.character.id, 'shaped_d20') === '1d20') {
      return;
    }
    const currentHP = roll20.getAttrByName(options.character.id, 'HP');
    if (currentHP !== 0 && currentHP !== '0') {
      reportPublic('Death Saves', `${options.character.get('name')} has more than 0 HP and shouldn't be rolling death` +
        ' saves');
      return;
    }

    const successes = roll20.getAttrObjectByName(options.character.id, 'death_saving_throw_successes');
    let successCount = successes.get('current');
    const failures = roll20.getAttrObjectByName(options.character.id, 'death_saving_throw_failures');
    let failureCount = failures.get('current');
    const result = this.getRollValue(msg, options.roll1);

    switch (result) {
      case 1:
        failureCount += 2;
        break;
      case 20:
        failureCount = 0;
        successCount = 0;

        roll20.setAttrWithWorker(options.character.id, 'HP', 1);
        reportPublic('Death Saves', `${options.character.get('name')} has recovered to 1 HP`);
        break;
      default:
        if (result >= 10) {
          successCount++;
        }
        else {
          failureCount++;
        }
    }

    if (failureCount >= 3) {
      failureCount = 3;
      reportPublic('Death Saves', `${options.character.get('name')} has failed 3` +
        ' death saves and is now dead');
    }
    else if (successCount >= 3) {
      reportPublic('Death Saves', `${options.character.get('name')} has succeeded 3` +
        ' death saves and is now stable');
      failureCount = 0;
      successCount = 0;
    }
    successes.setWithWorker({ current: successCount });
    failures.setWithWorker({ current: failureCount });
  };

  this.handleFX = function handleFX(options, msg) {
    const parts = options.fx.split(' ');
    if (parts.length < 2 || _.some(parts.slice(0, 2), _.isEmpty)) {
      logger.warn('FX roll template variable is not formated correctly: [$$$]', options.fx);
      return;
    }


    const fxType = parts[0];
    const pointsOfOrigin = parts[1];
    let targetTokenId;
    const sourceCoords = {};
    const targetCoords = {};
    let fxCoords = [];
    let pageId;

    // noinspection FallThroughInSwitchStatementJS
    switch (pointsOfOrigin) {
      case 'sourceToTarget':
      case 'source':
        targetTokenId = parts[2];
        fxCoords.push(sourceCoords, targetCoords);
        break;
      case 'targetToSource':
      case 'target':
        targetTokenId = parts[2];
        fxCoords.push(targetCoords, sourceCoords);
        break;
      default:
        throw new Error(`Unrecognised pointsOfOrigin type in fx spec: ${pointsOfOrigin}`);
    }

    if (targetTokenId) {
      const targetToken = roll20.getObj('graphic', targetTokenId);
      pageId = targetToken.get('_pageid');
      targetCoords.x = targetToken.get('left');
      targetCoords.y = targetToken.get('top');
    }
    else {
      pageId = roll20.getCurrentPage(msg.playerid).id;
    }


    const casterTokens = roll20.findObjs({ type: 'graphic', pageid: pageId, represents: options.character.id });

    if (casterTokens.length) {
      // If there are multiple tokens for the character on this page, then try and find one of them that is selected
      // This doesn't work without a selected token, and the only way we can get this is to use @{selected} which is a
      // pain for people who want to launch without a token selected if(casterTokens.length > 1) { const selected =
      // _.findWhere(casterTokens, {id: sourceTokenId}); if (selected) { casterTokens = [selected]; } }
      sourceCoords.x = casterTokens[0].get('left');
      sourceCoords.y = casterTokens[0].get('top');
    }


    if (!fxCoords[0]) {
      logger.warn('Couldn\'t find required point for fx for character $$$, casterTokens: $$$, fxSpec: $$$ ',
        options.character.id, casterTokens, options.fx);
      return;
    }
    else if (!fxCoords[1]) {
      fxCoords = fxCoords.slice(0, 1);
    }

    roll20.spawnFx(fxCoords, fxType, pageId);
  };

  this.getRollValue = function getRollValue(msg, rollOutputExpr) {
    const rollIndex = rollOutputExpr.match(/\$\[\[(\d+)]]/)[1];
    return msg.inlinerolls[rollIndex].results.total;
  };

  /**
   *
   * @returns {*}
   */
  this.getRollTemplateOptions = function getRollTemplateOptions(msg) {
    if (msg.rolltemplate === '5e-shaped') {
      const regex = /\{\{(.*?)}}/g;
      let match;
      const options = {};
      while ((match = regex.exec(msg.content))) {
        if (match[1]) {
          const splitAttr = match[1].split('=');
          const propertyName = splitAttr[0].replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
          options[propertyName] = splitAttr.length === 2 ? splitAttr[1].replace(/\^\{/, '') : '';
        }
      }
      if (options.characterName) {
        options.character = roll20.findObjs({
          _type: 'character',
          name: options.characterName,
        })[0];
      }
      return options;
    }
    return {};
  };

  this.processInlinerolls = function processInlinerolls(msg) {
    if (_.has(msg, 'inlinerolls')) {
      return _.chain(msg.inlinerolls)
        .reduce((previous, current, index) => {
          previous[`$[[${index}]]`] = current.results.total || 0;
          return previous;
        }, {})
        .reduce((previous, current, index) => previous.replace(index.toString(), current), msg.content)
        .value();
    }

    return msg.content;
  };

  // This method can go once all functions are moved into modules which handle their own configuration
  this.commandProcConfigured = false;
  this.oldStyleModulesConfigure = function oldStyleModulesConfigure(cp) {
    if (this.commandProcConfigured) {
      return cp;
    }

    this.commandProcConfigured = true;
    return cp
    // !shaped-import-statblock
      .addCommand('import-statblock', this.importStatblock.bind(this), true)
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-import-monster , !shaped-monster
      .addCommand(['import-monster', 'monster'], this.importMonstersFromJson.bind(this), true)
      .option('all', ShapedConfig.booleanValidator)
      .optionLookup('monsters', _.partial(entityLookup.findEntity.bind(entityLookup), 'monsters', _, false))
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .option('as', ShapedConfig.stringValidator)
      .withSelection({
        graphic: {
          min: 0,
          max: 1,
        },
      })
      // !shaped-import-spell, !shaped-spell
      .addCommand(['import-spell', 'spell'], this.importSpellsFromJson.bind(this), false)
      .optionLookup('spells', _.partial(entityLookup.findEntity.bind(entityLookup), 'spells', _, false))
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      })
      // !shaped-import-spell-list
      .addCommand('import-spell-list', this.importSpellListFromJson.bind(this), false)
      .options(ShapedConfig.spellSearchOptions)
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      })
      // !shaped-token-defaults
      .addCommand(['token-defaults', 'apply-defaults'], this.applyTokenDefaults.bind(this), false)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-slots
      .addCommand('slots', this.handleSlots.bind(this), false)
      .option('character', ShapedConfig.getCharacterValidator(roll20), true)
      .option('use', ShapedConfig.integerValidator)
      .option('restore', ShapedConfig.integerValidator);
  };

  this.checkInstall = function checkInstall() {
    logger.info('-=> ShapedScripts %%GULP_INJECT_VERSION%% <=-');
    Migrator.migrateShapedConfig(myState, logger);
  };

  this.wrapHandler = function wrapHandler(handler) {
    const self = this;
    return function handlerWrapper() {
      try {
        handler.apply(self, arguments);
      }
      catch (e) {
        errorHandler(e);
      }
      finally {
        logger.prefixString = '';
      }
    };
  };

  this.updateBarsForCharacterTokens = function updateBarsForCharacterTokens(curr) {
    roll20.findObjs({ type: 'graphic', represents: curr.get('characterid') })
      .forEach(token => this.setTokenBarsOnDrop(token, false));
  };

  this.getAttributeChangeHandler = function getAttributeChangeHandler(attributeName) {
    const handlers = {
      shaped_d20: advantageTracker.handleRollOptionChange.bind(advantageTracker),
    };

    _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .pluck('attribute')
      .each((attrName) => {
        if (attrName === 'HP') {
          attrName = 'hp_formula';
        }
        handlers[attrName] = this.updateBarsForCharacterTokens.bind(this);
      });

    return handlers[attributeName];
  };

  this.registerEventHandlers = function registerEventHandlers() {
    roll20.on('chat:message', this.wrapHandler(this.handleInput));
    roll20.on('add:token', this.wrapHandler(this.handleAddToken));
    roll20.on('change:token', this.wrapHandler(this.handleChangeToken));
    roll20.on('change:attribute', this.wrapHandler((curr, prev) => {
      const handler = this.getAttributeChangeHandler(curr.get('name'));
      if (handler) {
        handler(curr, prev);
      }
    }));
    roll20.on('add:character', this.wrapHandler(this.handleAddCharacter));
    this.registerChatWatcher(this.handleDeathSave, ['deathSavingThrow', 'character', 'roll1']);
    this.registerChatWatcher(this.handleAmmo, ['ammoName', 'character']);
    this.registerChatWatcher(this.handleFX, ['fx', 'character']);
    this.registerChatWatcher(this.handleHD, ['character', 'title']);
    this.registerChatWatcher(this.handleD20Roll, ['character', '2d20kh1']);
    this.registerChatWatcher(this.handleD20Roll, ['character', '2d20kl1']);
    this.registerChatWatcher(this.handleUses, ['character', 'uses', 'repeatingItem']);
    // this.registerChatWatcher(this.handleSpellCast, ['character', 'spell', 'friendlyLevel']);
  };

  logger.wrapModule(this);
}

ShapedScripts.prototype.logWrap = 'ShapedScripts';
