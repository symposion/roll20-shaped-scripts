/* globals unescape */
'use strict';
const _ = require('underscore');
const parseModule = require('./parser');
const cp = require('./command-parser');
const utils = require('./utils');
const AdvantageTracker = require('./advantage-tracker');
const ConfigUI = require('./config-ui');
const Logger = require('roll20-logger');
const UserError = require('./user-error');

const schemaVersion = 1.3;
const configDefaults = {
  logLevel: 'INFO',
  tokenSettings: {
    number: false,
    bar1: {
      attribute: 'HP',
      max: true,
      link: false,
      showPlayers: false,
    },
    bar2: {
      attribute: 'speed',
      max: false,
      link: true,
      showPlayers: false,
    },
    bar3: {
      attribute: '',
      max: false,
      link: false,
      showPlayers: false,
    },
    aura1: {
      radius: '',
      color: '#FFFF99',
      square: false,
    },
    aura2: {
      radius: '',
      color: '#59e594',
      square: false,
    },
    light: {
      radius: '',
      dimRadius: '',
      otherPlayers: false,
      hasSight: false,
      angle: 360,
      losAngle: 360,
      multiplier: 1,
    },
    showName: true,
    showNameToPlayers: false,
    showAura1ToPlayers: true,
    showAura2ToPlayers: true,
  },
  newCharSettings: {
    sheetOutput: '@{output_to_all}',
    deathSaveOutput: '@{output_to_all}',
    initiativeOutput: '@{output_to_all}',
    showNameOnRollTemplate: '@{show_character_name_yes}',
    rollOptions: '@{normal}',
    initiativeRoll: '@{normal_initiative}',
    initiativeToTracker: '@{initiative_to_tracker_yes}',
    breakInitiativeTies: '@{initiative_tie_breaker_var}',
    showTargetAC: '@{attacks_vs_target_ac_no}',
    showTargetName: '@{attacks_vs_target_name_no}',
    autoAmmo: '@{ammo_auto_use_var}',
    savingThrowsHalfProf: false,
    mediumArmorMaxDex: 2,
  },
  advTrackerSettings: {
    showMarkers: false,
    ignoreNpcs: false,
    advantageMarker: 'green',
    disadvantageMarker: 'red',
  },
  sheetEnhancements: {
    rollHPOnDrop: true,
    autoHD: true,
  },
  genderPronouns: [
    {
      matchPattern: '^f$|female|girl|woman|feminine',
      nominative: 'she',
      accusative: 'her',
      possessive: 'her',
      reflexive: 'herself',
    },
    {
      matchPattern: '^m$|male|boy|man|masculine',
      nominative: 'he',
      accusative: 'him',
      possessive: 'his',
      reflexive: 'himself',
    },
    {
      matchPattern: '^n$|neuter|none|construct|thing|object',
      nominative: 'it',
      accusative: 'it',
      possessive: 'its',
      reflexive: 'itself',
    },
  ],
  defaultGenderIndex: 2,

};

const configToAttributeLookup = {
  sheetOutput: 'output_option',
  deathSaveOutput: 'death_save_output_option',
  initiativeOutput: 'initiative_output_option',
  showNameOnRollTemplate: 'show_character_name',
  rollOptions: 'roll_setting',
  initiativeRoll: 'initiative_roll',
  initiativeToTracker: 'initiative_to_tracker',
  breakInitiativeTies: 'initiative_tie_breaker',
  showTargetAC: 'attacks_vs_target_ac',
  showTargetName: 'attacks_vs_target_name',
  autoAmmo: 'ammo_auto_use',
  savingThrowsHalfProf: 'saving_throws_half_proficiency',
  mediumArmorMaxDex: 'medium_armor_max_dex',
};

function booleanValidator(value) {
  const converted = value === 'true' || (value === 'false' ? false : value);
  return {
    valid: typeof value === 'boolean' || value === 'true' || value === 'false',
    converted,
  };
}

function stringValidator(value) {
  return {
    valid: true,
    converted: value,
  };
}

function getOptionList(options) {
  return function optionList(value) {
    if (value === undefined) {
      return options;
    }
    return {
      converted: options[value],
      valid: options[value] !== undefined,
    };
  };
}

function integerValidator(value) {
  const parsed = parseInt(value, 10);
  return {
    converted: parsed,
    valid: !isNaN(parsed),
  };
}

function colorValidator(value) {
  return {
    converted: value,
    valid: /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(value),
  };
}

const sheetOutputValidator = getOptionList({
  public: '@{output_to_all}',
  whisper: '@{output_to_gm}',
});
const statusMarkerValidator = getOptionList(ConfigUI.validStatusMarkers());
const barValidator = {
  attribute: stringValidator,
  max: booleanValidator,
  link: booleanValidator,
  showPlayers: booleanValidator,
};
const auraValidator = {
  radius: stringValidator,
  color: colorValidator,
  square: booleanValidator,
};
const lightValidator = {
  radius: stringValidator,
  dimRadius: stringValidator,
  otherPlayers: booleanValidator,
  hasSight: booleanValidator,
  angle: integerValidator,
  losAngle: integerValidator,
  multiplier: integerValidator,
};

function regExpValidator(value) {
  try {
    new RegExp(value, 'i').test('');
    return {
      converted: value,
      valid: true,
    };
  }
  catch (e) {
    return {
      converted: null,
      valid: false,
    };
  }
}


const configOptionsSpec = {
  logLevel(value) {
    const converted = value.toUpperCase();
    return { valid: _.has(Logger.levels, converted), converted };
  },
  tokenSettings: {
    number: booleanValidator,
    bar1: barValidator,
    bar2: barValidator,
    bar3: barValidator,
    aura1: auraValidator,
    aura2: auraValidator,
    light: lightValidator,
    showName: booleanValidator,
    showNameToPlayers: booleanValidator,
    showAura1ToPlayers: booleanValidator,
    showAura2ToPlayers: booleanValidator,
  },
  newCharSettings: {
    sheetOutput: sheetOutputValidator,
    deathSaveOutput: sheetOutputValidator,
    initiativeOutput: sheetOutputValidator,
    showNameOnRollTemplate: getOptionList({
      true: '@{show_character_name_yes}',
      false: '@{show_character_name_no}',
    }),
    rollOptions: getOptionList({
      normal: '@{roll_1}',
      advantage: '@{roll_advantage}',
      disadvantage: '@{roll_disadvantage}',
      two: '@{roll_2}',
    }),
    initiativeRoll: getOptionList({
      normal: '@{normal_initiative}',
      advantage: '@{advantage_on_initiative}',
      disadvantage: '@{disadvantage_on_initiative}',
    }),
    initiativeToTracker: getOptionList({
      true: '@{initiative_to_tracker_yes}',
      false: '@{initiative_to_tracker_no}',
    }),
    breakInitiativeTies: getOptionList({
      true: '@{initiative_tie_breaker_var}',
      false: '',
    }),
    showTargetAC: getOptionList({
      true: '@{attacks_vs_target_ac_yes}',
      false: '@{attacks_vs_target_ac_no}',
    }),
    showTargetName: getOptionList({
      true: '@{attacks_vs_target_name_yes}',
      false: '@{attacks_vs_target_name_no}',
    }),
    autoAmmo: getOptionList({
      true: '@{ammo_auto_use_var}',
      false: '',
    }),
    savingThrowsHalfProf: booleanValidator,
    mediumArmorMaxDex: getOptionList([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  },
  advTrackerSettings: {
    showMarkers: booleanValidator,
    ignoreNpcs: booleanValidator,
    advantageMarker: statusMarkerValidator,
    disadvantageMarker: statusMarkerValidator,
  },
  sheetEnhancements: {
    rollHPOnDrop: booleanValidator,
    autoHD: booleanValidator,
  },
  genderPronouns: [
    {
      matchPattern: regExpValidator,
      nominative: stringValidator,
      accusative: stringValidator,
      possessive: stringValidator,
      reflexive: stringValidator,
    },
  ],
  defaultGenderIndex: integerValidator,
};

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
  const chatWatchers = [];
  const at = new AdvantageTracker(logger, myState, roll20);

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

    this.getCommandProcessor().processCommand(msg);
  };


  /////////////////////////////////////////
  // Command handlers
  /////////////////////////////////////////
  this.configure = function configure(options) {
    // drop "menu" options
    utils.deepExtend(myState.config, _.omit(options, ['atMenu', 'tsMenu', 'ncMenu', 'seMenu']));

    const cui = new ConfigUI();

    logger.debug('options: $$$', options);
    logger.debug('state.config: $$$', myState.config);

    let menu;
    if (options.advTrackerSettings || options.atMenu) {
      menu = cui.getConfigOptionGroupAdvTracker(myState.config, configOptionsSpec);
    }
    else if (options.tokenSettings || options.tsMenu) {
      menu = cui.getConfigOptionGroupTokens(myState.config, configOptionsSpec);
    }
    else if (options.newCharSettings || options.ncMenu) {
      menu = cui.getConfigOptionGroupNewCharSettings(myState.config, configOptionsSpec);
    }
    else if (options.sheetEnhancements || options.seMenu) {
      menu = cui.getConfigOptionGroupSheetEnhancements(myState.config, configOptionsSpec);
    }
    else {
      menu = cui.getConfigOptionsMenu();
    }

    report('Configuration', menu);
  };

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
    _.each(myState.config.newCharSettings, (value, key) => {
      const attribute = roll20.getOrCreateAttr(character.id, configToAttributeLookup[key]);
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

  this.applyAdvantageTracker = function applyAdvantageTracker(options) {
    let type = 'normal';
    if (options.advantage) {
      type = 'advantage';
    }
    else if (options.disadvantage) {
      type = 'disadvantage';
    }

    at.setRollOption(type, options.selected.character);
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
    }(token.id)), 100);
  };

  this.handleChangeToken = function handleChangeToken(token) {
    if (_.contains(addedTokenIds, token.id)) {
      addedTokenIds = _.without(addedTokenIds, token.id);
      this.rollHPForToken(token);
      at.handleTokenChange(token);
    }
  };

  this.getHPBar = function getHPBar() {
    return _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .findKey({ attribute: 'HP' })
      .value();
  };

  this.rollHPForToken = function rollHPForToken(token) {
    const hpBar = this.getHPBar();
    logger.debug('HP bar is $$$', hpBar);
    if (!hpBar || !myState.config.sheetEnhancements.rollHPOnDrop) {
      return;
    }

    const represents = token.get('represents');
    if (!represents) {
      return;
    }
    const character = roll20.getObj('character', represents);
    if (!character) {
      return;
    }
    const hpBarLink = token.get(`${hpBar}_link`);
    if (hpBarLink) {
      return;
    }
    // Guard against characters that aren't properly configured - i.e. ones used for templates and system
    // things rather than actual characters
    if (_.isEmpty(roll20.getAttrByName(character.id, 'hp_formula'))) {
      logger.debug('Ignoring character $$$ for rolling HP - has no hp_formula attribute', character.get('name'));
      return;
    }

    roll20.sendChat('', `%{${character.get('name')}|npc_hp}`, results => {
      if (results && results.length === 1) {
        const message = this.processInlinerolls(results[0]);
        if (!results[0].inlinerolls || !results[0].inlinerolls[0]) {
          logger.warn('HP roll didn\'t have the expected structure. This is what we got back: $$$', results[0]);
        }
        else {
          const total = results[0].inlinerolls[0].results.total;
          roll20.sendChat('HP Roller', `/w GM &{template:5e-shaped} ${message}`);
          token.set(`${hpBar}_value`, total);
          if (myState.config.tokenSettings[hpBar].max) {
            token.set(`${hpBar}_max`, total);
          }
        }
      }
    });
  };


  this.registerChatWatcher = function registerChatWatcher(handler, triggerFields) {
    const matchers = [];
    if (triggerFields && !_.isEmpty(triggerFields)) {
      matchers.push((msg, options) =>
        _.intersection(triggerFields, _.keys(options)).length === triggerFields.length
      );
    }
    chatWatchers.push({ matchers, handler: handler.bind(this) });
  };

  this.triggerChatWatchers = function triggerChatWatchers(msg) {
    const options = this.getRollTemplateOptions(msg);
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

    const ammoAttr = _.chain(roll20.findObjs({ type: 'attribute', characterid: options.character.id }))
      .filter(attribute => attribute.get('name').indexOf('repeating_ammo') === 0)
      .groupBy(attribute => attribute.get('name').replace(/(repeating_ammo_[^_]+).*/, '$1'))
      .find(attributeList =>
        _.find(attributeList, attribute =>
          attribute.get('name').match(/.*name$/) && attribute.get('current') === options.ammoName)
      )
      .find(attribute => attribute.get('name').match(/.*qty$/))
      .value();

    if (!ammoAttr) {
      logger.error('No ammo attribute found corresponding to name $$$', options.ammoName);
      return;
    }

    let ammoUsed = 1;
    if (options.ammo) {
      const rollRef = options.ammo.match(/\$\[\[(\d+)\]\]/);
      if (rollRef) {
        const rollExpr = msg.inlinerolls[rollRef[1]].expression;
        const match = rollExpr.match(/\d+-(\d+)/);
        if (match) {
          ammoUsed = match[1];
        }
      }
    }

    const val = parseInt(ammoAttr.get('current'), 10) || 0;
    ammoAttr.set('current', Math.max(0, val - ammoUsed));
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

  this.addAbility = function addAbility(options) {
    if (_.isEmpty(options.abilities)) {
      reportError('No abilities specified. Take a look at the documentation for a list of ability options.');
      return;
    }
    const messages = _.map(options.selected.character, (character) => {
      const operationMessages = _.chain(options.abilities)
        .sortBy('sortKey')
        .map(maker => maker.run(character, options))
        .value();


      if (_.isEmpty(operationMessages)) {
        return `<li>${character.get('name')}: Nothing to do</li>`;
      }

      let message;
      message = `<li>Configured the following abilities for character ${character.get('name')}:<ul><li>`;
      message += operationMessages.join('</li><li>');
      message += '</li></ul></li>';

      return message;
    });

    report('Ability Creation', `<ul>${messages.join('')}</ul>`);
  };

  function getAbilityMaker(character) {
    return function abilityMaker(abilitySpec) {
      const ability = roll20.getOrCreateObj('ability', { characterid: character.id, name: abilitySpec.name });
      ability.set({ action: abilitySpec.action, istokenaction: true }); // TODO configure this
      return abilitySpec.name;
    };
  }

  const abilityDeleter = {
    run(character) {
      const abilities = roll20.findObjs({ type: 'ability', characterid: character.id });
      const deleted = _.map(abilities, obj => {
        const name = obj.get('name');
        obj.remove();
        return name;
      });

      return `Deleted: ${_.isEmpty(deleted) ? 'None' : deleted.join(', ')}`;
    },
    sortKey: '',
  };

  function RepeatingAbilityMaker(repeatingSection, abilityName, label, canMark) {
    this.run = function run(character, options) {
      options[`cache${repeatingSection}`] = options[`cache${repeatingSection}`] ||
        roll20.getRepeatingSectionItemIdsByName(character.id, repeatingSection);

      const configured = _.chain(options[`cache${repeatingSection}`])
        .map((repeatingId, repeatingName) => {
          let repeatingAction = `%{${character.get('name')}|repeating_${repeatingSection}_${repeatingId}` +
            `_${abilityName}}`;
          if (canMark && options.mark) {
            repeatingAction += '\n!mark @{target|token_id}';
          }
          return { name: utils.toTitleCase(repeatingName), action: repeatingAction };
        })
        .map(getAbilityMaker(character))
        .value();

      const addedText = _.isEmpty(configured) ? 'Not present for character' : configured.join(', ');
      return `${label}: ${addedText}`;
    };
    this.sortKey = 'originalOrder';
  }

  function RollAbilityMaker(abilityName, newName) {
    this.run = function run(character) {
      return getAbilityMaker(character)({
        name: newName,
        action: `%{${character.get('name')}|${abilityName}}`,
      });
    };
    this.sortKey = 'originalOrder';
  }

  function RepeatingSectionMacroMaker(abilityName, repeatingSection, macroName) {
    this.run = function run(character) {
      if (!_.isEmpty(roll20.getRepeatingSectionAttrs(character.id, repeatingSection))) {
        return getAbilityMaker(character)({
          name: macroName,
          action: `%{${character.get('name')}|${abilityName}}`,
        });
      }
      return `${macroName}: Not present for character`;
    };
    this.sortKey = 'originalOrder';
  }

  const staticAbilityOptions = {
    DELETE: abilityDeleter,
    initiative: new RollAbilityMaker('initiative', 'Init'),
    abilitychecks: new RollAbilityMaker('ability_checks_macro', 'Ability Checks'),
    abilitychecksquery: new RollAbilityMaker('ability_checks_query_macro', 'Ability Checks'),
    abilchecks: new RollAbilityMaker('ability_checks_macro', 'AbilChecks'),
    abilchecksquery: new RollAbilityMaker('ability_checks_query_macro', 'AbilChecks'),
    savingthrows: new RollAbilityMaker('saving_throw_macro', 'Saving Throws'),
    savingthrowsquery: new RollAbilityMaker('saving_throw_query_macro', 'Saving Throws'),
    saves: new RollAbilityMaker('saving_throw_macro', 'Saves'),
    savesquery: new RollAbilityMaker('saving_throw_query_macro', 'Saves'),
    attacks: new RepeatingAbilityMaker('attack', 'attack', 'Attacks', true),
    statblock: new RollAbilityMaker('statblock', 'Statblck'),
    traits: new RepeatingAbilityMaker('trait', 'trait', 'Traits'),
    'traits-macro': new RepeatingSectionMacroMaker('traits_macro', 'trait', 'Traits'),
    actions: new RepeatingAbilityMaker('action', 'action', 'Actions', true),
    'actions-macro': new RepeatingSectionMacroMaker('actions_macro', 'action', 'Actions'),
    reactions: new RepeatingAbilityMaker('reaction', 'action', 'Reactions'),
    'reactions-macro': new RepeatingSectionMacroMaker('reactions_macro', 'reaction', 'Reactions'),
    legendaryactions: new RepeatingAbilityMaker('legendaryaction', 'action', 'Legendary Actions'),
    'legendaryactions-macro': new RepeatingSectionMacroMaker('legendaryactions_macro', 'legendaryaction', 'Legendary' +
      ' Actions'),
    legendarya: new RepeatingAbilityMaker('legendaryaction', 'action', 'LegendaryA'),
    lairactions: new RepeatingSectionMacroMaker('lairactions_macro', 'lairaction', 'Lair Actions'),
    laira: new RepeatingSectionMacroMaker('lairactions_macro', 'lairaction', 'LairA'),
    regionaleffects: new RepeatingSectionMacroMaker('regionaleffects_macro', 'regionaleffect', 'Regional Effects'),
    regionale: new RepeatingSectionMacroMaker('regionaleffects_macro', 'regionaleffect', 'RegionalE'),
  };

  function abilityLookup(optionName, existingOptions) {
    let maker = staticAbilityOptions[optionName];

    // Makes little sense to add named spells to multiple characters at once
    if (!maker && existingOptions.selected.character.length === 1) {
      existingOptions.spellToRepeatingIdLookup = existingOptions.spellToRepeatingIdLookup ||
        roll20.getRepeatingSectionItemIdsByName(existingOptions.selected.character[0].id, 'spell');

      const repeatingId = existingOptions.spellToRepeatingIdLookup[optionName.toLowerCase()];
      if (repeatingId) {
        maker = new RollAbilityMaker(`repeating_spell_${repeatingId}_spell`, utils.toTitleCase(optionName));
      }
    }
    return maker;
  }


  this.getCommandProcessor = function getCommandProcessor() {
    return cp('shaped', roll20)
      .addCommand('config', this.configure.bind(this))
      .options(configOptionsSpec)
      .option('atMenu', booleanValidator)
      .option('tsMenu', booleanValidator)
      .option('ncMenu', booleanValidator)
      .option('seMenu', booleanValidator)
      .addCommand('import-statblock', this.importStatblock.bind(this))
      .option('overwrite', booleanValidator)
      .option('replace', booleanValidator)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      .addCommand(['import-monster', 'monster'], this.importMonstersFromJson.bind(this))
      .option('all', booleanValidator)
      .optionLookup('monsters', entityLookup.findEntity.bind(entityLookup, 'monsters'))
      .option('overwrite', booleanValidator)
      .option('replace', booleanValidator)
      .withSelection({
        graphic: {
          min: 0,
          max: 1,
        },
      })
      .addCommand(['import-spell', 'spell'], this.importSpellsFromJson.bind(this))
      .optionLookup('spells', entityLookup.findEntity.bind(entityLookup, 'spells'))
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      })
      .addCommand('at', this.applyAdvantageTracker.bind(this))
      .option('advantage', booleanValidator)
      .option('disadvantage', booleanValidator)
      .option('normal', booleanValidator)
      .withSelection({
        character: {
          min: 1,
          max: Infinity,
        },
      })
      .addCommand('abilities', this.addAbility.bind(this))
      .withSelection({
        character: {
          min: 1,
          max: Infinity,
        },
      })
      .optionLookup('abilities', abilityLookup)
      .option('mark', booleanValidator)
      .addCommand('token-defaults', this.applyTokenDefaults.bind(this))
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      .end();
  };

  this.checkInstall = function checkInstall() {
    logger.info('-=> ShapedScripts %%GULP_INJECT_VERSION%% <=-');
    if (myState.version !== schemaVersion) {
      logger.info('  > Updating Schema to v$$$ from $$$<', schemaVersion, myState && myState.version);
      logger.info('Preupgrade state: $$$', myState);

      /* eslint-disable no-fallthrough */
      // noinspection FallThroughInSwitchStatementJS
      switch (myState && myState.version) {
        case 0.1:
        case 0.2:
        case 0.3:
          _.extend(myState.config.genderPronouns, utils.deepClone(configDefaults.genderPronouns));
        case 0.4:
        case 0.5:
        case 0.6:
        case 0.7:
        case 0.8:
        case 0.9:
        case 1.0:
        case 1.1:
          // These lines are 1.1 upgrade specific - do not move down
          myState.config.sheetEnhancements = {};
          myState.config.sheetEnhancements.autoHD = myState.config.autoHD;
          myState.config.sheetEnhancements.rollHPOnDrop = myState.config.rollHPOnDrop;
          delete myState.config.rollHPOnDrop;
          delete myState.config.autoHD;
        case 1.2:
          // This stays at the bottom
          _.defaults(myState.config, utils.deepClone(configDefaults));
          _.defaults(myState.config.tokenSettings, utils.deepClone(configDefaults.tokenSettings));
          _.defaults(myState.config.newCharSettings, utils.deepClone(configDefaults.newCharSettings));
          _.defaults(myState.config.advTrackerSettings, utils.deepClone(configDefaults.advTrackerSettings));
          _.defaults(myState.config.sheetEnhancements, utils.deepClone(configDefaults.sheetEnhancements));
          myState.version = schemaVersion;
          break;
        default:
          if (!myState.version) {
            _.defaults(myState, {
              version: schemaVersion,
              config: utils.deepClone(configDefaults),
            });
            logger.info('Making new state object $$$', myState);
          }
          else {
            logger.error('Unknown schema version for state $$$', myState);
            reportError('Serious error attempting to upgrade your global state, please see log for details. ' +
              'ShapedScripts will not function correctly until this is fixed');
            myState = undefined;
          }
          break;
      }
      /* eslint-enable no-fallthrough */
      logger.info('Upgraded state: $$$', myState);
    }
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

  this.registerEventHandlers = function registerEventHandlers() {
    roll20.on('chat:message', this.wrapHandler(this.handleInput));
    roll20.on('add:token', this.wrapHandler(this.handleAddToken));
    roll20.on('change:token', this.wrapHandler(this.handleChangeToken));
    roll20.on('change:attribute', this.wrapHandler(msg => {
      if (msg.get('name') === 'roll_setting') {
        at.handleRollOptionChange(msg);
      }
    }));
    this.registerChatWatcher(this.handleDeathSave, ['deathSavingThrow', 'character', 'roll1']);
    this.registerChatWatcher(this.handleAmmo, ['ammoName', 'character']);
    this.registerChatWatcher(this.handleFX, ['fx', 'character']);
    this.registerChatWatcher(this.handleHD, ['character', 'title']);
  };

  logger.wrapModule(this);
}

ShapedScripts.prototype.logWrap = 'ShapedScripts';
