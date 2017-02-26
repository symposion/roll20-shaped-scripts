'use strict';
const _ = require('underscore');

module.exports = class ShapedConfig {

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
      showRests: 'show_rests',
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
      hideSavingThrowSuccess: 'hide_saving_throw_success',
      hideRecharge: 'hide_recharge',
      hideCost: 'hide_cost',
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
      encumbranceMultiplier: 'encumbrance_multiplier',
      automaticHigherLevelQueries: 'automatic_higher_level_queries',
      automaticallyExpendSpellResources: 'automatically_expend_spell_resources',
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

  static get sheetOutputValidator() {
    return this.getOptionList({
      public: '***default***',
      whisper: '/w GM',
    });
  }

  static get rollOutputValidator() {
    return this.getOptionList({
      sheetStandard: '***default***',
      public: '',
      whisper: '/w GM',
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
        autoAmmo: this.booleanValidator,
        autoRevertAdvantage: this.booleanValidator,
        automaticHigherLevelQueries: this.getOptionList({
          true: '***default***',
          false: 0,
        }),
        automaticallyExpendSpellResources: this.booleanValidator,
        display: {
          showRests: this.booleanValidator,
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
          encumbranceMultiplier: this.floatValidator,
        },
        houserules: {
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
          attacks: this.getOptionList({
            none: null,
            individualActions: 'attacks',
            chatWindow: 'attacksMacro',
          }),
          statblock: this.booleanValidator,
          traits: this.getOptionList({
            none: null,
            individualActions: 'traits',
            chatWindow: 'traitsMacro',
          }),
          racialFeatures: this.getOptionList({
            none: null,
            individualActions: 'racialFeatures',
            chatWindow: 'racialFeaturesMacro',
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
          hideCost: this.getHideOption('hide_cost'),
          hideSavingThrowDC: this.getHideOption('hide_saving_throw_dc'),
          hideSavingThrowFailure: this.getHideOption('hide_saving_throw_failure'),
          hideSavingThrowSuccess: this.getHideOption('hide_saving_throw_success'),
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

  static validStatusMarkers() {
    const markers = [
      'red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow', 'dead', 'skull', 'sleepy',
      'half-heart', 'half-haze', 'interdiction', 'snail', 'lightning-helix', 'spanner', 'chained-heart',
      'chemical-bolt', 'death-zone', 'drink-me', 'edge-crack', 'ninja-mask', 'stopwatch', 'fishing-net', 'overdrive',
      'strong', 'fist', 'padlock', 'three-leaves', 'fluffy-wing', 'pummeled', 'tread', 'arrowed', 'aura',
      'back-pain', 'black-flag', 'bleeding-eye', 'bolt-shield', 'broken-heart', 'cobweb', 'broken-shield',
      'flying-flag', 'radioactive', 'trophy', 'broken-skull', 'frozen-orb', 'rolling-bomb', 'white-tower',
      'grab', 'screaming', 'grenade', 'sentry-gun', 'all-for-one', 'angel-outfit', 'archery-target',
    ];

    const obj = {};
    for (let i = 0; i < markers.length; i++) {
      obj[markers[i]] = markers[i];
    }

    return obj;
  }
};

