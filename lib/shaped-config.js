'use strict';
const _ = require('underscore');
const Migrator = require('./migrator');
const Utils = require('./utils');
const ShapedModule = require('./shaped-module');

const oneSixConfig = {
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
    autoRevertAdvantage: false,
    houserules: {
      savingThrowsHalfProf: false,
      mediumArmorMaxDex: 2,
    },
  },
  advTrackerSettings: {
    showMarkers: false,
    ignoreNpcs: false,
    advantageMarker: 'green',
    disadvantageMarker: 'red',
    output: 'silent',
  },
  sheetEnhancements: {
    rollHPOnDrop: true,
    autoHD: true,
    autoSpellSlots: true,
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

const migrator = new Migrator()
  .addProperty('config', {})
  .skipToVersion(0.4)
  .overwriteProperty('config.genderPronouns', Utils.deepClone(oneSixConfig).genderPronouns)
  .skipToVersion(1.2)
  .moveProperty('config.autoHD', 'config.sheetEnhancements.autoHD')
  .moveProperty('config.rollHPOnDrop', 'config.sheetEnhancements.rollHPOnDrop')
  .skipToVersion(1.4)
  .moveProperty('config.newCharSettings.savingThrowsHalfProf',
    'config.newCharSettings.houserules.savingThrowsHalfProf')
  .moveProperty('config.newCharSettings.mediumArmorMaxDex', 'config.newCharSettings.houserules.mediumArmorMaxDex')
  .skipToVersion(1.6)
  .transformConfig((state) => {
    _.defaults(state.config, oneSixConfig);
    _.defaults(state.config.tokenSettings, oneSixConfig.tokenSettings);
    _.defaults(state.config.newCharSettings, oneSixConfig.newCharSettings);
    _.defaults(state.config.advTrackerSettings, oneSixConfig.advTrackerSettings);
    _.defaults(state.config.sheetEnhancements, oneSixConfig.sheetEnhancements);
    return state;
  }, 'Applying defaults as at schema version 1.6')
  // 1.7
  // add base houserules and variants section
  // add sheetEnhancements.autoTraits
  .nextVersion()
  .addProperty('config.variants', {
    rests: {
      longNoHpFullHd: false,
    },
  })
  .addProperty('config.sheetEnhancements.autoTraits', true)
  // 1.8
  // Set tokens to have vision by default so that people see the auto-generated stuff based on senses
  .nextVersion()
  .overwriteProperty('config.tokenSettings.light.hasSight', true)
  // 1.9 Add default tab setting
  .nextVersion()
  .addProperty('config.newCharSettings.tab', 'core')
  // 2.0 Add default token actions
  .nextVersion()
  .addProperty('config.newCharSettings.tokenActions', {
    initiative: false,
    abilityChecks: null,
    advantageTracker: null,
    savingThrows: null,
    attacks: null,
    statblock: false,
    traits: null,
    actions: null,
    reactions: null,
    legendaryActions: null,
    lairActions: null,
    regionalEffects: null,
    rests: false,
  })
  // 2.1 Add spells token action
  .nextVersion()
  .addProperty('config.newCharSettings.tokenActions.spells', false)
  // 2.2 Changes to support new roll behaviour in sheet 4.2.1
  .nextVersion()
  .overwriteProperty('config.newCharSettings.sheetOutput', '')
  .overwriteProperty('config.newCharSettings.deathSaveOutput', '')
  .overwriteProperty('config.newCharSettings.initiativeOutput', '')
  .overwriteProperty('config.newCharSettings.showNameOnRollTemplate', '')
  .overwriteProperty('config.newCharSettings.rollOptions', '')
  .overwriteProperty('config.newCharSettings.initiativeRoll', '')
  .overwriteProperty('config.newCharSettings.initiativeToTracker', '')
  .overwriteProperty('config.newCharSettings.breakInitiativeTies', '')
  .overwriteProperty('config.newCharSettings.showTargetAC', '')
  .overwriteProperty('config.newCharSettings.showTargetName', '')
  .overwriteProperty('config.newCharSettings.autoAmmo', '1')
  // 2.3 Remove "small" macros
  .nextVersion()
  .transformConfig((config) => {
    _.each(config.config.newCharSettings.tokenActions, (value, key) => {
      if (typeof value === 'string' && value.match('.*Small$')) {
        config.config.newCharSettings.tokenActions[key] = value.replace(/Small$/, '');
      }
    });
    return config;
  }, 'Removing "small" macros')
  .addProperty('config.newCharSettings.textSizes', {
    spellsTextSize: 'text',
    abilityChecksTextSize: 'text',
    savingThrowsTextSize: 'text',
  })
  // 2.4 Don't set default values for sheet options to save on attribute bloat
  .nextVersion()
  .transformConfig((config) => {
    const ncs = config.config.newCharSettings;
    const defaults = {
      sheetOutput: '',
      deathSaveOutput: '',
      initiativeOutput: '',
      showNameOnRollTemplate: '',
      rollOptions: '{{ignore=[[0',
      initiativeRoll: '@{shaped_d20}',
      initiativeToTracker: '@{selected|initiative_formula} &{tracker}',
      breakInitiativeTies: '',
      showTargetAC: '',
      showTargetName: '',
      autoAmmo: '',
      tab: 'core',
    };
    _.each(defaults, (defaultVal, key) => {
      if (ncs[key] === defaultVal) {
        ncs[key] = '***default***';
      }
    });

    if (ncs.houserules.mediumArmorMaxDex === '2') {
      ncs.houserules.mediumArmorMaxDex = '***default***';
    }

    ['spellsTextSize', 'abilityChecksTextSize', 'savingThrowsTextSize'].forEach((prop) => {
      if (ncs.textSizes[prop] === 'text_big') {
        ncs.textSizes[prop] = '***default***';
      }
    });

    return config;
  }, 'Removing default values')
  // 2.5 Custom saving throws
  .nextVersion()
  .addProperty('config.newCharSettings.houserules.saves', {
    useCustomSaves: '***default***',
    useAverageOfAbilities: '***default***',
    fortitude: {
      fortitudeStrength: '***default***',
      fortitudeDexterity: '***default***',
      fortitudeConstitution: '***default***',
      fortitudeIntelligence: '***default***',
      fortitudeWisdom: '***default***',
      fortitudeCharisma: '***default***',
    },
    reflex: {
      reflexStrength: '***default***',
      reflexDexterity: '***default***',
      reflexConstitution: '***default***',
      reflexIntelligence: '***default***',
      reflexWisdom: '***default***',
      reflexCharisma: '***default***',
    },
    will: {
      willStrength: '***default***',
      willDexterity: '***default***',
      willConstitution: '***default***',
      willIntelligence: '***default***',
      willWisdom: '***default***',
      willCharisma: '***default***',
    },
  })
  .moveProperty('config.newCharSettings.houserules.savingThrowsHalfProf',
    'config.newCharSettings.houserules.saves.savingThrowsHalfProf')
  .addProperty('config.newCharSettings.houserules.baseDC', '***default***')
  // 2.6 expertise_as_advantage
  .nextVersion()
  .addProperty('config.newCharSettings.houserules.expertiseAsAdvantage', '***default***')
  // 2.7 add hide options
  .nextVersion()
  .addProperty('config.newCharSettings.hide', {
    hideAttack: '***default***',
    hideDamage: '***default***',
    hideAbilityChecks: '***default***',
    hideSavingThrows: '***default***',
    hideSavingThrowDC: '***default***',
    hideSpellContent: '***default***',
    hideActionFreetext: '***default***',
    hideSavingThrowFailure: '***default***',
    hideSavingThrowSuccess: '***default***',
    hideRecharge: '***default***',
  })
  // 2.8 rename hideActionFreetext
  .nextVersion()
  .moveProperty('config.newCharSettings.hide.hideActionFreetext', 'config.newCharSettings.hide.hideFreetext')
  // 2.9 make auto-applying new character settings optional (and switched off by default)
  .nextVersion()
  .addProperty('config.newCharSettings.applyToAll', false)
  // 3.0 add hit dice output option + show rests option
  .nextVersion()
  .addProperty('config.newCharSettings.hitDiceOutput', '***default***')
  .addProperty('config.newCharSettings.showRests', '***default***')
  // 3.1 add hideCost
  .nextVersion()
  .addProperty('config.newCharSettings.hide.hideCost', '***default***')
  // 3.2 update roll settings;
  .nextVersion()
  .transformConfig((config) => {
    const ncs = config.config.newCharSettings;
    const oldVals = {
      advantage: 'adv {{ignore=[[0',
      disadvantage: 'dis {{ignore=[[0',
      two: '{{roll2=[[d20@{d20_mod}',
    };
    const newVals = {
      advantage: '2d20kh1',
      disadvantage: '2d20kl1',
      two: '1d20',
    };
    const key = _.invert(oldVals)[ncs.rollOptions];
    ncs.rollOptions = key ? newVals[key] : '***default***';
    return config;
  }, 'Upgrading Roll options settings to new format')
  // 3.3 make boolean switches consistent for 9.x sheet
  .nextVersion()
  .transformConfig((config) => {
    const ncs = config.config.newCharSettings;
    [
      'showTargetAC',
      'showTargetName',
      'autoAmmo',
      'houserules.expertiseAsAdvantage',
      'houserules.saves.useCustomSaves',
      'houserules.saves.useAverageOfAbilities',
      'houserules.saves.fortitude.fortitudeStrength',
      'houserules.saves.fortitude.fortitudeDexterity',
      'houserules.saves.fortitude.fortitudeConstitution',
      'houserules.saves.fortitude.fortitudeIntelligence',
      'houserules.saves.fortitude.fortitudeWisdom',
      'houserules.saves.fortitude.fortitudeCharisma',
      'houserules.saves.reflex.reflexStrength',
      'houserules.saves.reflex.reflexDexterity',
      'houserules.saves.reflex.reflexConstitution',
      'houserules.saves.reflex.reflexIntelligence',
      'houserules.saves.reflex.reflexWisdom',
      'houserules.saves.reflex.reflexCharisma',
      'houserules.saves.will.willStrength',
      'houserules.saves.will.willDexterity',
      'houserules.saves.will.willConstitution',
      'houserules.saves.will.willIntelligence',
      'houserules.saves.will.willWisdom',
      'houserules.saves.will.willCharisma',
    ].forEach((propPath) => {
      const propVal = Utils.getObjectFromPath(ncs, propPath);
      const newVal = (propVal !== '***default***');
      Utils.deepExtend(ncs, Utils.createObjectFromPath(propPath, newVal));
    });
    return config;
  }, 'Upgrade config for 9.x character sheet')
  // 3.4 Fix initiative settings for 9.1.0 sheet
  .nextVersion()
  .transformConfig((config) => {
    const ncs = config.config.newCharSettings;
    ncs.breakInitiativeTies = ncs.breakInitiativeTies !== '***default***';
    if (ncs.initiativeToTracker !== '***default***') {
      ncs.initiativeToTracker = 0;
    }
    return config;
  }, 'Upgrade initiative settings')
  // 3.5 Add option to put recharges on token actions
  .nextVersion()
  .addProperty('config.newCharSettings.tokenActions.showRecharges', false)
  // 3.6 Add new props for latest sheet
  .nextVersion()
  .transformConfig((config) => {
    const ncs = config.config.newCharSettings;
    ncs.display = {
      showPassiveSkills: false,
      showWeight: '***default***',
      showEmote: false,
      showFreetext: false,
      showFreeform: false,
      showDiceModifiers: false,
      showCritRange: false,
      extraOnACrit: false,
    };
    ncs.measurementSystems = {
      distanceSystem: '***default***',
      weightSystem: '***default***',
      encumbranceMultiplier: 1,
    };
    _.extend(ncs.houserules, {
      inspirationMultiple: false,
      criticalDamageHouserule: '***default***',
      proficiencyDice: false,
      psionics: false,
      customClasses: false,
      honorToggle: false,
      sanityToggle: false,
    });
    ncs.tokenActions.racialFeatures = null;
    ncs.tokenActions.classFeatures = null;
    ncs.tokenActions.feats = null;
    ncs.automaticHigherLevelQueries = '***default***';
    return config;
  }, 'Adding new properties for 9.x sheet settings')
  .moveProperty('config.newCharSettings.showRests', 'config.newCharSettings.display.showRests')
  // 3.7 Add monsterTokenName
  .nextVersion()
  .addProperty('config.tokenSettings.monsterTokenName', '')
  // 3.8 Rename hide settings
  .nextVersion()
  .deleteProperty('config.newCharSettings.hide.hideSpellContent')
  .addProperty('config.newCharSettings.hide.hideContent', '***default***')
  // 3.9 Move spell slots under new character settings
  .nextVersion()
  .moveProperty('config.sheetEnhancements.autoSpellSlots', 'config.newCharSettings.automaticallyExpendSpellResources')
  // 4.0 More flexible options for HP/HD recovery
  .nextVersion()
  .transformConfig((config) => {
    const restSettings = config.config.variants.rests;
    restSettings.longRestHDRecovery = 0.5;
    restSettings.longRestHPRecovery = 1;
    if (restSettings.longNoHpFullHd) {
      restSettings.longRestHDRecovery = 1;
      restSettings.longRestHPRecovery = 0;
    }
    delete restSettings.longNoHpFullHd;
    return config;
  }, 'Making more flexible options for HP/HD recovery')
  // 4.1 rename racial features
  .nextVersion()
  .moveProperty('config.newCharSettings.tokenActions.racialFeatures',
    'config.newCharSettings.tokenActions.racialTraits')
  // 4.2 add switch for auto turn recharge
  .nextVersion()
  .addProperty('config.sheetEnhancements.turnRecharges', false)
  // 4.3 add switch for auto ammo recovery
  .nextVersion()
  .addProperty('config.sheetEnhancements.ammoRecovery', false)
  // 4.4 remove hideCost as it isn't used any more
  .nextVersion()
  .deleteProperty('config.newCharSettings.hide.hideCost')
  // 4.5 add automatically roll damage settings;
  .nextVersion()
  .addProperty('config.newCharSettings.automaticallyRollDamageForAttacks', '***default***')
  .addProperty('config.newCharSettings.automaticallyRollDamageForSavingThrows', '***default***')
  // 4.6 latest sheet changes;
  .nextVersion()
  .deleteProperty('config.newCharSettings.measurementSystems.encumbranceMultiplier')
  .addProperty('config.newCharSettings.houserules.hitPointsRecoveredOnALongRest', '***default***')
  .addProperty('config.newCharSettings.houserules.hitDiceRecoveredOnALongRest', '***default***')
  .deleteProperty('config.newCharSettings.hide.hideSavingThrowSuccess')
  .addProperty('config.newCharSettings.hide.hideTargetAC')
  .deleteProperty('config.newCharSettings.display.showRests')
  // 4.7 fix hit points /hit dice
  .nextVersion()
  .transformConfig((config) => {
    const baseConfig = config.config.newCharSettings.houserules;
    baseConfig.hitPointsRecoveredOnALongRest = baseConfig.hitPointsRecoveredOnALongRest || '0';
    baseConfig.hitDiceRecoveredOnALongRest = baseConfig.hitDiceRecoveredOnALongRest || '0';
    return config;
  }, 'Fixing hit points/hit dice settings')
  // 4.8 add Utility, rename Attacks to Offense
  .nextVersion()
  .moveProperty('config.newCharSettings.tokenActions.attacks', 'config.newCharSettings.tokenActions.offense')
  .addProperty('config.newCharSettings.tokenActions.utility', null);


module.exports = class ShapedConfig extends ShapedModule {

  addCommands(commandProcessor) {
    commandProcessor
      .addCommand('reset-config', this.resetConfig.bind(this), true)
      .addCommand('upgrade-config', this.upgradeConfig.bind(this), true);
  }

  runStartupSequence(commandProc, cb) {
    this.logger.info('Configuration state: $$$', this.myState);
    if (!migrator.isValid(this.myState)) {
      const error = '5e Shaped Companion configuration is invalid. This is most likely because you have tried' +
        ' to downgrade from a later version. You can either reinstall a later version or ' +
        '<a href="!shaped-reset-config">Reset Configuration</a> to defaults.';
      this.reporter.reportError(error);
      this.logger.error('Invalid configuration!');
      commandProc.setDefaultCommandHandler(() => this.reportError(error));
      this.configUpgradedCallback = cb;
      return;
    }
    if (migrator.needsUpdate(this.myState)) {
      this.logger.warn('Configuration requires updating');
      const title = '5eShaped Companion Updates';
      const msg = '5e Shaped Companion has been updated and needs to ' +
        'upgrade its configuration. Please note that this is a one-way process, if you do not wish to proceed, ' +
        'please revert to a previous version of the script. <a href="!shaped-upgrade-config">Upgrade</a>';
      this.reporter.reportPlayer(title, msg);
      commandProc.setDefaultCommandHandler(() => this.reportPlayer(title, msg));
      this.configUpgradedCallback = cb;
      return;
    }
    cb();
  }

  resetConfig() {
    this.myState = {};
    this.reportPlayer('5e Shaped Companion Config', 'Configuration has been reset to defaults.');
    this.upgradeConfig();
  }

  upgradeConfig() {
    migrator.migrateConfig(this.myState, this.logger);
    this.reportPlayer('5e Shaped Companion Config', 'Configuration has been upgraded to latest version');
    if (this.configUpgradedCallback) {
      this.configUpgradedCallback();
      this.configUpgradedCallback = null;
    }
  }

  static get configToAttributeLookup() {
    const lookup = {
      sheetOutput: 'output_option',
      deathSaveOutput: 'death_save_output_option',
      initiativeOutput: 'initiative_output_option',
      hitDiceOutput: 'hit_dice_output_option',
      showNameOnRollTemplate: 'show_character_name',
      rollOptions: 'shaped_d20',
      initiativeRoll: 'initiative_roll',
      initiativeToTracker: 'initiative_to_tracker',
      breakInitiativeTies: 'initiative_tie_breaker',
      showTargetAC: 'attacks_vs_target_ac',
      showTargetName: 'attacks_vs_target_name',
      autoAmmo: 'ammo_auto_use',
      autoRevertAdvantage: 'auto_revert_advantage',
      savingThrowsHalfProf: 'saving_throws_half_proficiency',
      mediumArmorMaxDex: 'medium_armor_max_dex',
      spellsTextSize: 'spells_text_size',
      abilityChecksTextSize: 'ability_checks_text_size',
      savingThrowsTextSize: 'saving_throws_text_size',
      baseDC: 'base_dc',
      tab: 'tab',
      useCustomSaves: 'use_custom_saving_throws',
      useAverageOfAbilities: 'average_of_abilities',
      expertiseAsAdvantage: 'expertise_as_advantage',
      hideAttack: 'hide_attack',
      hideDamage: 'hide_damage',
      hideAbilityChecks: 'hide_ability_checks',
      hideSavingThrows: 'hide_saving_throws',
      hideSavingThrowDC: 'hide_saving_throw_dc',
      hideContent: 'hide_content',
      hideFreetext: 'hide_freetext',
      hideSavingThrowFailure: 'hide_saving_throw_failure',
      hideRecharge: 'hide_recharge',
      hideTargetAC: 'hide_target_ac',
      customSkills: 'custom_skills',
      showPassiveSkills: 'show_passive_skills',
      showWeight: 'show_weight',
      showEmote: 'show_emote',
      showFreetext: 'show_freetext',
      showFreeform: 'show_freeform',
      showDiceModifiers: 'show_dice_modifiers',
      showCritRange: 'show_crit_range',
      extraOnACrit: 'extra_on_a_crit',
      inspirationMultiple: 'inspiration_multiple',
      criticalDamageHouserule: 'critical_damage_houserule',
      proficiencyDice: 'proficiency_dice',
      psionics: 'psionics',
      customClasses: 'custom_classes',
      honorToggle: 'honor_toggle',
      sanityToggle: 'sanity_toggle',
      distanceSystem: 'distance_system',
      weightSystem: 'weight_system',
      automaticHigherLevelQueries: 'automatic_higher_level_queries',
      automaticallyExpendSpellResources: 'automatically_expend_spell_resources',
      automaticallyRollDamageForAttacks: 'automatically_roll_damage_for_attacks',
      automaticallyRollDamageForSavingThrows: 'automatically_roll_damage_for_saving_throws',
      hitPointsRecoveredOnALongRest: 'hit_points_recovered_on_a_long_rest',
      hitDiceRecoveredOnALongRest: 'hit_dice_recovered_on_a_long_rest',
    };

    ['fortitude', 'reflex', 'will'].forEach((save) => {
      ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].forEach((ability) => {
        lookup[`${save}${ability}`] = `${save}_${ability.toLowerCase()}`;
      });
    });

    return lookup;
  }

  static booleanValidator(value) {
    const converted = value === 'true' || (value === 'false' ? false : value);
    return {
      valid: typeof value === 'boolean' || value === 'true' || value === 'false',
      converted,
    };
  }

  static stringValidator(value) {
    return {
      valid: true,
      converted: value,
    };
  }

  static arrayValidator(value) {
    return {
      valid: true,
      converted: value.split(',').map(s => s.trim()),
    };
  }

  static getOptionList(options) {
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

  static getHideOption(propertyName) {
    return this.getOptionList({ false: '***default***', true: `{{${propertyName}=1}}` });
  }

  static integerValidator(value) {
    const parsed = parseInt(value, 10);
    return {
      converted: parsed,
      valid: !isNaN(parsed),
    };
  }

  static floatValidator(value) {
    const parsed = parseFloat(value);
    return {
      converted: parsed,
      valid: !isNaN(parsed),
    };
  }

  static colorValidator(value) {
    return {
      converted: value,
      valid: /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(value),
    };
  }

  static jsonValidator(value) {
    try {
      return {
        converted: JSON.parse(unescape(value)),
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

  static checkCharacterSelectedOrSupplied(options, reporter) {
    if (options.character) {
      options.selected.character = options.character;
    }
    if (!options.selected.character) {
      reporter.reportError('You must either select a character token or supply a character id using --character');
      return false;
    }

    return true;
  }

  static get sheetOutputValidator() {
    return this.getOptionList({
      public: '***default***',
      whisper: '/w GM',
      choose: '?{Output|Public,|Whisper,/w GM }',
    });
  }

  static get rollOutputValidator() {
    return this.getOptionList({
      sheetOutput: '***default***',
      public: '',
      whisper: '/w GM',
      choose: '?{Output|Public,|Whisper,/w GM }',
    });
  }

  static get commandOutputValidator() {
    return this.getOptionList({
      public: 'public',
      whisper: 'whisper',
      silent: 'silent',
    });
  }

  static get statusMarkerValidator() {
    return this.getOptionList(ShapedConfig.validStatusMarkers());
  }

  static get barLinkValidator() {
    return this.getOptionList({
      always: true,
      pcOnly: 'pcOnly',
      never: false,
    });
  }

  static get barValidator() {
    return {
      attribute: this.stringValidator,
      max: this.booleanValidator,
      link: this.barLinkValidator,
      showPlayers: this.booleanValidator,
    };
  }

  static get auraValidator() {
    return {
      radius: this.stringValidator,
      color: this.colorValidator,
      square: this.booleanValidator,
    };
  }

  static get lightValidator() {
    return {
      radius: this.stringValidator,
      dimRadius: this.stringValidator,
      otherPlayers: this.booleanValidator,
      hasSight: this.booleanValidator,
      angle: this.integerValidator,
      losAngle: this.integerValidator,
      multiplier: this.integerValidator,
    };
  }

  static getCharacterValidator(roll20) {
    return ShapedConfig.getObjectValidator('character', roll20);
  }

  static getObjectValidator(type, roll20) {
    return (value) => {
      const obj = roll20.getObj(type, value);
      return {
        converted: obj,
        valid: !!obj,
      };
    };
  }

  static get spellSearchOptions() {
    return {
      classes: this.arrayValidator,
      domains: this.arrayValidator,
      oaths: this.arrayValidator,
      patrons: this.arrayValidator,
      school: this.stringValidator,
      level: this.integerValidator,
    };
  }


  static regExpValidator(value) {
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

  static get configOptionsSpec() {
    return {
      tokenSettings: {
        monsterTokenName: this.stringValidator,
        number: this.booleanValidator,
        bar1: this.barValidator,
        bar2: this.barValidator,
        bar3: this.barValidator,
        aura1: this.auraValidator,
        aura2: this.auraValidator,
        light: this.lightValidator,
        showName: this.booleanValidator,
        showNameToPlayers: this.booleanValidator,
        showAura1ToPlayers: this.booleanValidator,
        showAura2ToPlayers: this.booleanValidator,
      },
      newCharSettings: {
        applyToAll: this.booleanValidator,
        sheetOutput: this.sheetOutputValidator,
        deathSaveOutput: this.rollOutputValidator,
        hitDiceOutput: this.rollOutputValidator,
        initiativeOutput: this.rollOutputValidator,
        showNameOnRollTemplate: this.getOptionList({
          true: '{{show_character_name=1}}',
          false: '***default***',
        }),
        rollOptions: this.getOptionList({
          normal: '***default***',
          advantage: '2d20kh1',
          disadvantage: '2d20kl1',
          query: '?{Roll|Normal,d20|Advantage,2d20kh1|Disadvantage,2d20kl1}',
          advantageQuery: '?{Disadvantaged|No,2d20kh1|Yes,d20}',
          disadvantageQuery: '?{Advantaged|No,2d20kl1|Yes,d20}',
          two: '1d20',
        }),
        initiativeRoll: this.getOptionList({
          normal: '***default***',
          advantage: '2d20@{d20_mod}kh1',
          disadvantage: '2d20@{d20_mod}kl1',
        }),
        initiativeToTracker: this.getOptionList({
          true: '***default***',
          false: 0,
        }),
        breakInitiativeTies: this.booleanValidator,
        showTargetAC: this.booleanValidator,
        showTargetName: this.booleanValidator,
        automaticallyRollDamageForAttacks: this.getOptionList({
          true: '***default***',
          false: 0,
        }),
        automaticallyRollDamageForSavingThrows: this.getOptionList({
          true: '***default***',
          false: 0,
        }),
        autoAmmo: this.booleanValidator,
        autoRevertAdvantage: this.booleanValidator,
        automaticHigherLevelQueries: this.getOptionList({
          true: '***default***',
          false: 0,
        }),
        automaticallyExpendSpellResources: this.booleanValidator,
        display: {
          showPassiveSkills: this.booleanValidator,
          showWeight: this.getOptionList({
            true: '***default***',
            false: 0,
          }),
          showEmote: this.booleanValidator,
          showFreetext: this.booleanValidator,
          showFreeform: this.booleanValidator,
          showDiceModifiers: this.booleanValidator,
          showCritRange: this.booleanValidator,
          extraOnACrit: this.booleanValidator,
        },
        measurementSystems: {
          distanceSystem: this.getOptionList({
            feet: '***default***',
            meters: 'METERS',
          }),
          weightSystem: this.getOptionList({
            pounds: '***default***',
            kilograms: 'KILOGRAMS',
          }),
        },
        houserules: {
          hitPointsRecoveredOnALongRest: this.getOptionList({
            None: '0',
            Half: 'HALF',
            All: '***default***',
          }),
          hitDiceRecoveredOnALongRest: this.getOptionList({
            None: '0',
            Half: '***default***',
            All: 'ALL',
          }),
          inspirationMultiple: this.booleanValidator,
          criticalDamageHouserule: this.getOptionList({
            normal: '***default***',
            criticalDamageIsMaximized: 'CRITICAL_DAMAGE_IS_MAXIMIZED',
            noCriticalDamageFromDefaultDamage: 'NO_CRITICAL_DAMAGE_FROM_DEFAULT_DAMAGE',
          }),
          proficiencyDice: this.booleanValidator,
          psionics: this.booleanValidator,
          customClasses: this.booleanValidator,
          honorToggle: this.booleanValidator,
          sanityToggle: this.booleanValidator,
          baseDC: this.getOptionList(_.range(0, 21).reduce((result, val) => {
            result[val] = val === 8 ? '***default***' : val;
            return result;
          }, {})),
          mediumArmorMaxDex: this.getOptionList(_.range(0, 11).reduce((result, val) => {
            result[val] = val === 2 ? '***default***' : val;
            return result;
          }, {})),
          expertiseAsAdvantage: this.booleanValidator,
          saves: {
            savingThrowsHalfProf: this.booleanValidator,
            useCustomSaves: this.booleanValidator,
            useAverageOfAbilities: this.booleanValidator,
            fortitude: {
              fortitudeStrength: this.booleanValidator,
              fortitudeDexterity: this.booleanValidator,
              fortitudeConstitution: this.booleanValidator,
              fortitudeIntelligence: this.booleanValidator,
              fortitudeWisdom: this.booleanValidator,
              fortitudeCharisma: this.booleanValidator,
            },
            reflex: {
              reflexStrength: this.booleanValidator,
              reflexDexterity: this.booleanValidator,
              reflexConstitution: this.booleanValidator,
              reflexIntelligence: this.booleanValidator,
              reflexWisdom: this.booleanValidator,
              reflexCharisma: this.booleanValidator,
            },
            will: {
              willStrength: this.booleanValidator,
              willDexterity: this.booleanValidator,
              willConstitution: this.booleanValidator,
              willIntelligence: this.booleanValidator,
              willWisdom: this.booleanValidator,
              willCharisma: this.booleanValidator,
            },
          },
        },
        tab: this.getOptionList({
          core: '***default***',
          character: 'character',
          settings: 'settings',
          all: 'all',
        }),
        tokenActions: {
          initiative: this.booleanValidator,
          abilityChecks: this.getOptionList({
            none: null,
            query: 'abilityChecksQuery',
            chatWindow: 'abilityChecks',
            queryShort: 'abilChecksQuery',
            chatWindowShort: 'abilChecks',
          }),
          advantageTracker: this.getOptionList({
            none: null,
            normal: 'advantageTracker',
            short: 'advantageTrackerShort',
            shortest: 'advantageTrackerShortest',
            query: 'advantageTrackerQuery',
          }),
          savingThrows: this.getOptionList({
            none: null,
            query: 'savingThrowsQuery',
            chatWindow: 'savingThrows',
            queryShort: 'savesQuery',
            chatWindowShort: 'saves',
          }),
          offense: this.getOptionList({
            none: null,
            individualActions: 'offense',
            chatWindow: 'offenseMacro',
          }),
          utility: this.getOptionList({
            none: null,
            individualActions: 'utility',
            chatWindow: 'utilityMacro',
          }),
          statblock: this.booleanValidator,
          traits: this.getOptionList({
            none: null,
            individualActions: 'traits',
            chatWindow: 'traitsMacro',
          }),
          racialTraits: this.getOptionList({
            none: null,
            individualActions: 'racialTraits',
            chatWindow: 'racialTraitsMacro',
          }),
          classFeatures: this.getOptionList({
            none: null,
            individualActions: 'classFeatures',
            chatWindow: 'classFeaturesMacro',
          }),
          feats: this.getOptionList({
            none: null,
            individualActions: 'feats',
            chatWindow: 'featsMacro',
          }),
          actions: this.getOptionList({
            none: null,
            individualActions: 'actions',
            chatWindow: 'actionsMacro',
          }),
          spells: this.booleanValidator,
          reactions: this.getOptionList({
            none: null,
            individualActions: 'reactions',
            chatWindow: 'reactionsMacro',
          }),
          legendaryActions: this.getOptionList({
            none: null,
            individualActions: 'legendaryActions',
            chatWindow: 'legendaryActionsMacro',
            chatWindowShort: 'legendaryA',
          }),
          lairActions: this.getOptionList({
            none: null,
            chatWindow: 'lairActions',
            chatWindowShort: 'lairA',
          }),
          regionalEffects: this.getOptionList({
            none: null,
            chatWindow: 'regionalEffects',
            chatWindowShort: 'regionalE',
          }),
          rests: this.booleanValidator,
          showRecharges: this.booleanValidator,
        },
        textSizes: {
          spellsTextSize: this.getOptionList({
            normal: '***default***',
            big: 'big',
          }),
          abilityChecksTextSize: this.getOptionList({
            normal: '***default***',
            big: 'text_big',
          }),
          savingThrowsTextSize: this.getOptionList({
            normal: '***default***',
            big: 'text_big',
          }),
        },
        hide: {
          hideAbilityChecks: this.getHideOption('hide_ability_checks'),
          hideSavingThrows: this.getHideOption('hide_saving_throws'),
          hideAttack: this.getHideOption('hide_attack'),
          hideDamage: this.getHideOption('hide_damage'),
          hideFreetext: this.getHideOption('hide_freetext'),
          hideRecharge: this.getHideOption('hide_recharge'),
          hideTargetAC: this.getHideOption('hide_target_ac'),
          hideSavingThrowDC: this.getHideOption('hide_saving_throw_dc'),
          hideSavingThrowFailure: this.getHideOption('hide_saving_throw_failure'),
          hideContent: this.getHideOption('hide_content'),
        },
        customSkills: this.stringValidator,
      },
      advTrackerSettings: {
        showMarkers: this.booleanValidator,
        ignoreNpcs: this.booleanValidator,
        advantageMarker: this.statusMarkerValidator,
        disadvantageMarker: this.statusMarkerValidator,
        output: this.commandOutputValidator,
      },
      sheetEnhancements: {
        rollHPOnDrop: this.booleanValidator,
        autoHD: this.booleanValidator,
        autoTraits: this.booleanValidator,
        turnRecharges: this.booleanValidator,
        ammoRecovery: this.booleanValidator,
      },
      genderPronouns: [
        {
          matchPattern: this.regExpValidator,
          nominative: this.stringValidator,
          accusative: this.stringValidator,
          possessive: this.stringValidator,
          reflexive: this.stringValidator,
        },
      ],
      defaultGenderIndex: this.integerValidator,
      variants: {
        rests: {
          longRestHPRecovery: this.getOptionList({
            all: 1,
            half: 0.5,
            none: 0,
          }),
          longRestHDRecovery: this.getOptionList({
            all: 1,
            half: 0.5,
            none: 0,
          }),
        },
      },
    };
  }

  static validStatusMarkers() {
    const markers = [
      'blue',
      'brown',
      'green',
      'pink',
      'purple',
      'red',
      'yellow',
      'arrowed',
      'all-for-one',
      'angel-outfit',
      'archery-target',
      'aura',
      'back-pain',
      'black-flag',
      'bleeding-eye',
      'bolt-shield',
      'broken-heart',
      'broken-shield',
      'broken-skull',
      'chained-heart',
      'chemical-bolt',
      'cobweb',
      'dead',
      'death-zone',
      'drink-me',
      'edge-crack',
      'fishing-net',
      'fist',
      'fluffy-wing',
      'flying-flag',
      'frozen-orb',
      'grab',
      'grenade',
      'half-haze',
      'half-heart',
      'interdiction',
      'lightning-helix',
      'ninja-mask',
      'overdrive',
      'padlock',
      'pummeled',
      'radioactive',
      'rolling-bomb',
      'sentry-gun',
      'screaming',
      'skull',
      'sleepy',
      'snail',
      'spanner',
      'stopwatch',
      'strong',
      'three-leaves',
      'tread',
      'trophy',
      'white-tower',
    ];

    const obj = {};
    for (let i = 0; i < markers.length; i++) {
      obj[markers[i]] = markers[i];
    }

    return obj;
  }
};

