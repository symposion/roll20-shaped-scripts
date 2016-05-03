'use strict';
const _ = require('underscore');
const Logger = require('roll20-logger');
const ConfigUI = require('./config-ui');

module.exports = class ShapedConfig {
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

  static integerValidator(value) {
    const parsed = parseInt(value, 10);
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

  static get sheetOutputValidator() {
    return this.getOptionList({
      public: '@{output_to_all}',
      whisper: '@{output_to_gm}',
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
    return this.getOptionList(ConfigUI.validStatusMarkers());
  }

  static get barValidator() {
    return {
      attribute: this.stringValidator,
      max: this.booleanValidator,
      link: this.booleanValidator,
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
    return function characterValidator(value) {
      const char = roll20.getObj('character', value);
      return {
        converted: char,
        valid: !!char,
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
      logLevel(value) {
        const converted = value.toUpperCase();
        return { valid: _.has(Logger.levels, converted), converted };
      },
      tokenSettings: {
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
        sheetOutput: this.sheetOutputValidator,
        deathSaveOutput: this.sheetOutputValidator,
        initiativeOutput: this.sheetOutputValidator,
        showNameOnRollTemplate: this.getOptionList({
          true: '@{show_character_name_yes}',
          false: '@{show_character_name_no}',
        }),
        rollOptions: this.getOptionList({
          normal: '@{roll_1}',
          advantage: '@{roll_advantage}',
          disadvantage: '@{roll_disadvantage}',
          two: '@{roll_2}',
        }),
        initiativeRoll: this.getOptionList({
          normal: '@{normal_initiative}',
          advantage: '@{advantage_on_initiative}',
          disadvantage: '@{disadvantage_on_initiative}',
        }),
        initiativeToTracker: this.getOptionList({
          true: '@{initiative_to_tracker_yes}',
          false: '@{initiative_to_tracker_no}',
        }),
        breakInitiativeTies: this.getOptionList({
          true: '@{initiative_tie_breaker_var}',
          false: '',
        }),
        showTargetAC: this.getOptionList({
          true: '@{attacks_vs_target_ac_yes}',
          false: '@{attacks_vs_target_ac_no}',
        }),
        showTargetName: this.getOptionList({
          true: '@{attacks_vs_target_name_yes}',
          false: '@{attacks_vs_target_name_no}',
        }),
        autoAmmo: this.getOptionList({
          true: '@{ammo_auto_use_var}',
          false: '',
        }),
        autoRevertAdvantage: this.booleanValidator,
        houserules: {
          savingThrowsHalfProf: this.booleanValidator,
          mediumArmorMaxDex: this.getOptionList([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        },
        tab: this.getOptionList({
          core: 'core',
          spells: 'spells',
          equipment: 'equipment',
          character: 'character',
          settings: 'settings',
          all: 'all',
        }),
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
        autoSpellSlots: this.booleanValidator,
        autoTraits: this.booleanValidator,
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
          longNoHpFullHd: this.booleanValidator,
        },
      },
    };
  }
};

