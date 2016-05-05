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
const TraitManager = require('./trait-manager');
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

function ShapedScripts(logger, myState, roll20, parser, entityLookup, reporter, srdConverter, sanitise, mpp) {
  let addedTokenIds = [];
  const report = reporter.report.bind(reporter);
  const reportError = reporter.reportError.bind(reporter);
  const commandProc = makeCommandProc('shaped', roll20);
  const chatWatchers = [];
  const advantageTracker = new AdvantageTracker();
  const traitManager = new TraitManager();
  const ammoManager = new AmmoManager();
  const modules = [
    new AbilityMaker(),
    new ConfigUI(),
    advantageTracker,
    traitManager,
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
    _.each(options.selected.graphic, token => {
      const represents = token.get('represents');
      const character = roll20.getObj('character', represents);
      if (character) {
        this.getTokenConfigurer(token)(character);
      }
    });
  };

  this.importStatblock = function importStatblock(options) {
    logger.info('Importing statblocks for tokens $$$', options.selected.graphic);
    _.each(options.selected.graphic, token => {
      const error = `Could not find GM notes on either selected token ${token.get('name')} or the character ` +
        'it represents. Have you pasted it in correctly?';
      const text = token.get('gmnotes');
      if (!text) {
        const char = roll20.getObj('character', token.get('represents'));
        if (char) {
          char.get('gmnotes', notes => {
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
    mpp(monsters, entityLookup);
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

    if (token) {
      characterProcessors.push(this.getAvatarCopier(token).bind(this));
      if (_.size(monsters) === 1) {
        characterProcessors.push(this.getTokenConfigurer(token).bind(this));
        characterProcessors.push(this.getTokenVisionConfigurer(token, monsters[0].senses));
        if (options.replace || options.overwrite) {
          characterRetrievalStrategies.push(this.getTokenRetrievalStrategy(token).bind(this));
        }
      }
    }
    if (options.replace) {
      characterRetrievalStrategies.push(this.nameRetrievalStrategy);
    }

    characterRetrievalStrategies.push(this.creationRetrievalStrategy.bind(this));
    characterProcessors.push(this.monsterDataPopulator.bind(this));

    const errors = [];
    const importedList = _.chain(monsters)
      .map(monsterData => {
        const character = _.reduce(characterRetrievalStrategies,
          (result, strategy) => result || strategy(monsterData.name, errors), null);

        if (!character) {
          logger.error('Failed to find or create character for monster $$$', monsterData.name);
          return null;
        }

        const oldAttrs = roll20.findObjs({ type: 'attribute', characterid: character.id });
        _.invoke(oldAttrs, 'remove');
        character.set('name', monsterData.name);

        _.each(characterProcessors, proc => proc(character, monsterData));
        return character && character.get('name');
      })
      .compact()
      .value();

    if (!_.isEmpty(importedList)) {
      const monsterList = importedList.join('</li><li>');
      report('Import Success', `Added the following monsters: <ul><li>${monsterList}</li></ul>`);
    }
    if (!_.isEmpty(errors)) {
      const errorList = errors.join('</li><li>');
      reportError(`The following errors occurred on import:  <ul><li>${errorList}</li></ul>`);
    }
  };

  this.importSpellsFromJson = function importSpellsFromJson(options) {
    if (_.isEmpty(options.spells)) {
      this.showEntityPicker('spell', 'spells');
    }
    else {
      this.addSpellsToCharacter(options.selected.character, options.spells);
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
      report(`${utils.toTitleCase(entityName)} Importer`,
        `<a href="!shaped-import-${entityName} --?{Pick a ${entityName}|${list.join('|')}}">Click to select a ` +
        `${entityName}</a>`);
    }
    else {
      reportError(`Could not find any ${entityNamePlural}.<br/>Please ensure you have a properly formatted ` +
        `${entityNamePlural} json file.`);
    }
  };

  this.addSpellsToCharacter = function addSpellsToCharacter(character, spells, noreport) {
    const gender = roll20.getAttrByName(character.id, 'gender');

    const defaultIndex = Math.min(myState.config.defaultGenderIndex, myState.config.genderPronouns.length);
    const defaultPronounInfo = myState.config.genderPronouns[defaultIndex];
    const pronounInfo = _.clone(_.find(myState.config.genderPronouns,
      pronounDetails => new RegExp(pronounDetails.matchPattern, 'i').test(gender)) || defaultPronounInfo);

    _.defaults(pronounInfo, defaultPronounInfo);

    const importData = {
      spells: srdConverter.convertSpells(spells, pronounInfo),
    };
    this.getImportDataWrapper(character).mergeImportData(importData);
    if (!noreport) {
      report('Import Success', 'Added the following spells:  <ul><li>' +
        `${_.map(importData.spells, spell => spell.name).join('</li><li>')}</li></ul>`);
    }
  };

  this.monsterDataPopulator = function monsterDataPopulator(character, monsterData) {
    _.each(utils.flattenObject(myState.config.newCharSettings), (value, key) => {
      const attribute = roll20.getOrCreateAttr(character.id, ShapedConfig.configToAttributeLookup[key] || key);
      attribute.set('current', _.isBoolean(value) ? (value ? 'on' : 0) : value);
    });

    const converted = srdConverter.convertMonster(monsterData);
    logger.debug('Converted monster data: $$$', converted);
    const expandedSpells = converted.spells;
    delete converted.spells;
    this.getImportDataWrapper(character).setNewImportData({ npc: converted });
    if (expandedSpells) {
      this.addSpellsToCharacter(character, expandedSpells, true);
    }
    return character;
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
      errors.push(`More than one existing character found with name "${name}". Can\'t replace`);
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
      errors.push(`Can\'t create new character with name "${name}` +
        '" because one already exists with that name. Perhaps you want --replace?');
      return null;
    }

    return roll20.createObj('character', { name });
  };

  this.getAvatarCopier = function getAvatarCopier(token) {
    return function avatarCopier(character) {
      character.set('avatar', token.get('imgsrc'));
    };
  };

  this.getTokenConfigurer = function getTokenConfigurer(token) {
    return function tokenConfigurer(character) {
      token.set('represents', character.id);
      token.set('name', character.get('name'));
      const settings = myState.config.tokenSettings;
      if (settings.number && token.get('name').indexOf('%%NUMBERED%%') === -1) {
        token.set('name', `${token.get('name')} %%NUMBERED%%`);
      }

      _.chain(settings)
        .pick(['bar1', 'bar2', 'bar3'])
        .each((bar, barName) => {
          if (!_.isEmpty(bar.attribute)) {
            const attribute = roll20.getOrCreateAttr(character.id, bar.attribute);
            if (attribute) {
              token.set(`${barName}_value`, attribute.get('current'));
              if (bar.max) {
                token.set(`${barName}_max`, attribute.get('max'));
              }
              token.set(`showplayers_${barName}`, bar.showPlayers);
              if (bar.link) {
                token.set(`${barName}_link`, attribute.id);
              }
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
    };
  };

  this.getTokenVisionConfigurer = function getTokenVisionConfigurer(token, sensesString) {
    if (_.isEmpty(sensesString)) {
      return _.noop;
    }

    function fullRadiusLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, this.lightRadius));
      token.set('light_dimradius', Math.max(token.get('light_dimradius') || 0, this.lightRadius));
    }

    function darkvisionLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, this.lightRadius * 1.1666666));
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

    return function configureTokenVision() {
      senses.forEach(sense => sense.configureVision());
    };
  };

  this.getImportDataWrapper = function getImportDataWrapper(character) {
    return {
      setNewImportData(importData) {
        if (_.isEmpty(importData)) {
          return;
        }
        roll20.setAttrByName(character.id, 'import_data', JSON.stringify(importData));
        roll20.setAttrByName(character.id, 'import_data_present', 'on');
      },
      mergeImportData(importData) {
        if (_.isEmpty(importData)) {
          return undefined;
        }
        const attr = roll20.getOrCreateAttr(character.id, 'import_data');
        const dataPresentAttr = roll20.getOrCreateAttr(character.id, 'import_data_present');
        let current = {};
        try {
          if (!_.isEmpty(attr.get('current').trim())) {
            current = JSON.parse(attr.get('current'));
          }
        }
        catch (e) {
          logger.warn('Existing import_data attribute value was not valid JSON: [$$$]', attr.get('current'));
        }
        _.each(importData, (value, key) => {
          const currentVal = current[key];
          if (currentVal) {
            if (!_.isArray(currentVal)) {
              current[key] = [currentVal];
            }
            current[key] = current[key].concat(value);
          }
          else {
            current[key] = value;
          }
        });
        logger.debug('Setting import data to $$$', current);
        attr.set('current', JSON.stringify(current));
        dataPresentAttr.set('current', 'on');
        return current;
      },

      logWrap: 'importDataWrapper',
    };
  };

  this.handleSlots = function handleSlots(options) {
    if (options.use) {
      roll20.processAttrValue(options.character.id, `spell_slots_l${options.use}`, val => Math.max(0, --val));
    }
    if (options.restore) {
      const attrName = `spell_slots_l${options.restore}`;
      const max = roll20.getAttrByName(options.character.id, attrName, 'max');
      roll20.processAttrValue(options.character.id, `spell_slots_l${options.restore}`, val => {
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
    } (token.id)), 100);
    /* eslint-enable no-spaced-func */
  };

  this.handleChangeToken = function handleChangeToken(token) {
    if (_.contains(addedTokenIds, token.id)) {
      addedTokenIds = _.without(addedTokenIds, token.id);
      this.setTokenBarsOnDrop(token);
      advantageTracker.handleTokenChange(token);
    }
  };

  this.setTokenBarsOnDrop = function setTokenBarsOnDrop(token) {
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
        if (bar.attribute && !token.get(`${barName}_link`) && !token.get(`${barName}_value`)) {
          if (bar.attribute === 'HP' && myState.config.sheetEnhancements.rollHPOnDrop) {
            // Guard against characters that aren't properly configured - i.e. ones used for templates and system
            // things rather than actual characters
            if (_.isEmpty(roll20.getAttrByName(character.id, 'hp_formula'))) {
              logger.debug('Ignoring character $$$ for rolling HP - has no hp_formula attribute',
                character.get('name'));
              return;
            }
            roll20.sendChat('', `%{${character.get('name')}|shaped_npc_hp}`, results => {
              if (results && results.length === 1) {
                const message = this.processInlinerolls(results[0]);
                if (!results[0].inlinerolls || !results[0].inlinerolls[0]) {
                  logger.warn('HP roll didn\'t have the expected structure. This is what we got back: $$$', results[0]);
                }
                else {
                  roll20.sendChat('HP Roller', `/w GM &{template:5e-shaped} ${message}`);
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
    _.each(chatWatchers, watcher => {
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
    if (!roll20.getAttrByName(options.character.id, 'ammo_auto_use')) {
      return;
    }

    ammoManager.consumeAmmo(options, msg);
  };

  this.handleHD = function handleHD(options, msg) {
    const match = options.title.match(/(\d+)d(\d+) Hit Dice/);
    if (match && myState.config.sheetEnhancements.autoHD) {
      const hdCount = parseInt(match[1], 10);
      const hdSize = match[2];
      const hdAttr = roll20.getAttrObjectByName(options.character.id, `hd_d${hdSize}`);
      const hpAttr = roll20.getAttrObjectByName(options.character.id, 'HP');
      const newHp = Math.min(parseInt(hpAttr.get('current'), 10) +
        this.getRollValue(msg, options.roll1), hpAttr.get('max'));

      if (hdAttr) {
        if (hdCount <= hdAttr.get('current')) {
          hdAttr.set('current', hdAttr.get('current') - hdCount);
          hpAttr.set('current', newHp);
        }
        else {
          report('HD Police', `${options.characterName} can't use ${hdCount}d${hdSize} hit dice because they only ` +
            `have ${hdAttr.get('current')} left`);
        }
      }
    }
  };

  this.handleD20Roll = function handleD20Roll(options) {
    if (options.disadvantage || options.advantage) {
      const autoRevertOptions = roll20.getAttrByName(options.character.id, 'auto_revert_advantage');
      if (autoRevertOptions === 'on') {
        advantageTracker.setRollOption('normal', [options.character]);
      }
    }
  };

  this.handleTraitClick = function handleTraitClick(options) {
    if (myState.config.sheetEnhancements.autoTraits) {
      traitManager.handleTraitClick(options);
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
      roll20.sendChat('Spell Slots Police', msg);
    }
  };

  this.handleDeathSave = function handleDeathSave(options, msg) {
    // TODO: Do we want to output text on death/recovery?
    function increment(val) {
      return ++val;
    }

    // TODO: Advantage?
    if (roll20.getAttrByName(options.character.id, 'roll_setting') !== '@{roll_2}') {
      const result = this.getRollValue(msg, options.roll1);
      const attributeToIncrement = result >= 10 ? 'death_saving_throw_successes' : 'death_saving_throw_failures';
      roll20.processAttrValue(options.character.id, attributeToIncrement, increment);
    }
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
    const rollIndex = rollOutputExpr.match(/\$\[\[(\d+)\]\]/)[1];
    return msg.inlinerolls[rollIndex].results.total;
  };

  /**
   *
   * @returns {*}
   */
  this.getRollTemplateOptions = function getRollTemplateOptions(msg) {
    if (msg.rolltemplate === '5e-shaped') {
      const regex = /\{\{(.*?)\}\}/g;
      let match;
      const options = {};
      while (!!(match = regex.exec(msg.content))) {
        if (match[1]) {
          const splitAttr = match[1].split('=');
          const propertyName = splitAttr[0].replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
          options[propertyName] = splitAttr.length === 2 ? splitAttr[1] : '';
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
      .addCommand('import-statblock', this.importStatblock.bind(this))
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-import-monster , !shaped-monster
      .addCommand(['import-monster', 'monster'], this.importMonstersFromJson.bind(this))
      .option('all', ShapedConfig.booleanValidator)
      .optionLookup('monsters', _.partial(entityLookup.findEntity.bind(entityLookup), 'monsters', _, false))
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .withSelection({
        graphic: {
          min: 0,
          max: 1,
        },
      })
      // !shaped-import-spell, !shaped-spell
      .addCommand(['import-spell', 'spell'], this.importSpellsFromJson.bind(this))
      .optionLookup('spells', _.partial(entityLookup.findEntity.bind(entityLookup), 'spells', _, false))
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      })
      // !shaped-import-spell-list
      .addCommand('import-spell-list', this.importSpellListFromJson.bind(this))
      .options(ShapedConfig.spellSearchOptions)
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      })
      // !shaped-token-defaults
      .addCommand('token-defaults', this.applyTokenDefaults.bind(this))
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-slots
      .addCommand('slots', this.handleSlots.bind(this))
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
        if (typeof e === 'string' || e instanceof parseModule.ParserError || e instanceof UserError) {
          reportError(e);
          logger.error('Error: $$$', e.toString());
        }
        else {
          logger.error(e.toString());
          logger.error(e.stack);
          reportError('An error occurred. Please see the log for more details.');
        }
      }
      finally {
        logger.prefixString = '';
      }
    };
  };

  this.updateBarsForCharacterTokens = function updateBarsForCharacterTokens(curr) {
    roll20.findObjs({ type: 'graphic', represents: curr.get('characterid') })
      .forEach(this.setTokenBarsOnDrop.bind(this));
  };

  this.getAttributeChangeHandler = function getAttributeChangeHandler(attributeName) {
    const handlers = {
      roll_setting: advantageTracker.handleRollOptionChange.bind(advantageTracker),
    };

    _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .pluck('attribute')
      .each(attrName => {
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
    this.registerChatWatcher(this.handleDeathSave, ['deathSavingThrow', 'character', 'roll1']);
    this.registerChatWatcher(this.handleAmmo, ['ammoName', 'character']);
    this.registerChatWatcher(this.handleFX, ['fx', 'character']);
    this.registerChatWatcher(this.handleHD, ['character', 'title']);
    this.registerChatWatcher(this.handleD20Roll, ['character', 'roll1']);
    this.registerChatWatcher(this.handleTraitClick, ['character', 'trait']);
    // this.registerChatWatcher(this.handleSpellCast, ['character', 'spell', 'friendlyLevel']);
  };

  logger.wrapModule(this);
}

ShapedScripts.prototype.logWrap = 'ShapedScripts';
