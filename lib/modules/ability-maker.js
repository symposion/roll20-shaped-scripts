'use strict';
const _ = require('underscore');
const Utils = require('./../utils');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');

const RECHARGE_LOOKUP = {
  TURN: '(T)',
  SHORT_OR_LONG_REST: '(SR)',
  LONG_REST: '(LR)',
  RECHARGE_2_6: '(2-6)',
  RECHARGE_3_6: '(3-6)',
  RECHARGE_4_6: '(4-6)',
  RECHARGE_5_6: '(5-6)',
  RECHARGE_6: '(6)',
};

class MacroMaker {
  constructor(roll20) {
    if (!roll20) {
      throw new Error('Rol20 parameter is required for MacroMaker constructor');
    }
    this.roll20 = roll20;
    this.sortKey = 'originalOrder';
  }

  getAbilityMaker(character) {
    const self = this;
    return function abilityMaker(abilitySpec) {
      const ability = self.roll20.getOrCreateObj('ability', { characterid: character.id, name: abilitySpec.name });
      ability.set({ action: abilitySpec.action, istokenaction: true });
      return abilitySpec.name;
    };
  }
}

class AbilityDeleter extends MacroMaker {
  constructor(roll20) {
    super(roll20);
    this.sortKey = '';
  }

  run(character) {
    const abilities = this.roll20.findObjs({ type: 'ability', characterid: character.id });
    const deleted = _.map(abilities, (obj) => {
      const name = obj.get('name');
      obj.remove();
      return name;
    });

    return `Deleted: ${_.isEmpty(deleted) ? 'None' : deleted.join(', ')}`;
  }
}

class RepeatingAbilityMaker extends MacroMaker {
  constructor(repeatingSection, abilityName, label, canMark, roll20) {
    super(roll20);
    this.repeatingSection = repeatingSection;
    this.abilityName = abilityName;
    this.label = label;
    this.canMark = canMark;
  }

  run(character, options) {
    const cache = options.getCache(character.id);
    cache[this.repeatingSection] = cache[this.repeatingSection] ||
      this.roll20.getRepeatingSectionItemIdsByName(character.id, this.repeatingSection);

    const configured = _.chain(cache[this.repeatingSection])
      .map((repeatingId, repeatingName) => {
        let repeatingAction = `%{${character.id}|repeating_${this.repeatingSection}_${repeatingId}` +
          `_${this.abilityName}}`;
        let name = Utils.toTitleCase(repeatingName);
        if (options.showRecharges) {
          const recharge = this.roll20.getAttrByName(character.id,
            `repeating_${this.repeatingSection}_${repeatingId}_recharge`, 'current', true);
          if (RECHARGE_LOOKUP[recharge]) {
            name += ` ${RECHARGE_LOOKUP[recharge]}`;
          }
        }
        if (this.canMark && options.mark) {
          repeatingAction += '\n!mark @{target|token_id}';
        }
        return { name, action: repeatingAction };
      })
      .map(this.getAbilityMaker(character))
      .value();

    const addedText = _.isEmpty(configured) ? 'Not present for character' : configured.join(', ');
    return `${this.label}: ${addedText}`;
  }
}

class RollAbilityMaker extends MacroMaker {
  constructor(abilityName, newName, roll20) {
    super(roll20);
    this.abilityName = abilityName;
    this.newName = newName;
  }

  run(character) {
    return this.getAbilityMaker(character)({
      name: this.newName,
      action: `%{${character.id}|${this.abilityName}}`,
    });
  }
}


class CommandAbilityMaker extends MacroMaker {
  constructor(command, options, newName, roll20) {
    super(roll20);
    this.command = command;
    this.options = options;
    this.newName = newName;
  }

  run(character) {
    return this.getAbilityMaker(character)({
      name: this.newName,
      action: `!${this.command} ${Utils.toOptionsString(this.options)}`,
    });
  }
}

class MultiCommandAbilityMaker extends MacroMaker {
  constructor(commandSpecs, roll20) {
    super(roll20);
    this.commandSpecs = commandSpecs;
  }

  run(character) {
    const abilMaker = this.getAbilityMaker(character);
    return this.commandSpecs.map(cmdSpec =>
      abilMaker({
        name: cmdSpec.abilityName,
        action: `!${cmdSpec.command} ${Utils.toOptionsString(cmdSpec.options)}`,
      })
    );
  }
}

class RepeatingSectionMacroMaker extends MacroMaker {
  constructor(abilityName, repeatingSection, macroName, roll20) {
    super(roll20);
    this.abilityName = abilityName;
    this.repeatingSection = repeatingSection;
    this.macroName = macroName;
    this.sortKey = 'originalOrder';
  }

  run(character) {
    if (!_.isEmpty(this.roll20.getRepeatingSectionAttrs(character.id, this.repeatingSection))) {
      return this.getAbilityMaker(character)({
        name: this.macroName,
        action: `%{${character.id}|${this.abilityName}}`,
      });
    }
    return `${this.macroName}: Not present for character`;
  }
}

function getRepeatingSectionAbilityLookup(sectionName, rollName, roll20) {
  return function repeatingSectionAbilityLookup(optionName, existingOptions) {
    const characterId = existingOptions.selected.character[0].id;
    const cache = existingOptions.getCache(characterId);

    cache[sectionName] = cache[sectionName] || roll20.getRepeatingSectionItemIdsByName(characterId, sectionName);

    const repeatingId = cache[sectionName][optionName.toLowerCase()];

    if (repeatingId) {
      return new RollAbilityMaker(`repeating_${sectionName}_${repeatingId}_${rollName}`,
        Utils.toTitleCase(optionName), roll20);
    }
    return undefined;
  };
}

module.exports = class AbilityMaker extends ShapedModule {

  addCommands(commandProcessor) {
    const roll20 = this.roll20;
    this.staticAbilityOptions = {
      DELETE: new AbilityDeleter(roll20),
      advantageTracker: new MultiCommandAbilityMaker([
        { command: 'shaped-at', options: ['advantage'], abilityName: 'Advantage' },
        { command: 'shaped-at', options: ['disadvantage'], abilityName: 'Disadvantage' },
        { command: 'shaped-at', options: ['normal'], abilityName: 'Normal' },
      ], roll20),
      advantageTrackerShort: new MultiCommandAbilityMaker([
        { command: 'shaped-at', options: ['advantage'], abilityName: 'Adv' },
        { command: 'shaped-at', options: ['disadvantage'], abilityName: 'Dis' },
        { command: 'shaped-at', options: ['normal'], abilityName: 'Normal' },
      ], roll20),
      advantageTrackerShortest: new MultiCommandAbilityMaker([
        { command: 'shaped-at', options: ['advantage'], abilityName: 'Adv' },
        { command: 'shaped-at', options: ['disadvantage'], abilityName: 'Dis' },
      ], roll20),
      advantageTrackerQuery: new CommandAbilityMaker('shaped-at',
        ['?{Roll Option|Normal,normal|w/ Advantage,advantage|w/ Disadvantage,disadvantage}'], '(dis)Adv Query', roll20),
      initiative: new RollAbilityMaker('shaped_initiative', 'Init', roll20),
      abilityChecks: new RollAbilityMaker('shaped_ability_checks', 'Ability Checks', roll20),
      abilityChecksQuery: new RollAbilityMaker('shaped_ability_checks_query', 'Ability Checks', roll20),
      abilChecks: new RollAbilityMaker('shaped_ability_checks', 'AbilChecks', roll20),
      abilChecksQuery: new RollAbilityMaker('shaped_ability_checks_query', 'AbilChecks', roll20),
      savingThrows: new RollAbilityMaker('shaped_saving_throw', 'Saving Throws', roll20),
      savingThrowsQuery: new RollAbilityMaker('shaped_saving_throw_query', 'Saving Throws', roll20),
      saves: new RollAbilityMaker('shaped_saving_throw', 'Saves', roll20),
      savesQuery: new RollAbilityMaker('shaped_saving_throw_query', 'Saves', roll20),
      rests: new CommandAbilityMaker('shaped-rest', [{ name: 'type', value: '?{Rest type|Short,short|Long,long}' }],
        'Rests', roll20),
      offense: new RepeatingAbilityMaker('offense', 'offense', 'Offense', true, roll20),
      offenseMacro: new RepeatingSectionMacroMaker('shaped_offense', 'offense', 'Offense', roll20),
      utility: new RepeatingAbilityMaker('utility', 'utility', 'Utility', true, roll20),
      utilityMacro: new RepeatingSectionMacroMaker('shaped_utility', 'utility', 'Utility', roll20),
      spells: new RepeatingSectionMacroMaker('shaped_spells', 'spell', 'Spells', roll20),
      statblock: new RollAbilityMaker('shaped_statblock', 'Statblock', roll20),
      traits: new RepeatingAbilityMaker('trait', 'trait', 'Traits', false, roll20),
      traitsMacro: new RepeatingSectionMacroMaker('shaped_traits', 'trait', 'Traits', roll20),
      racialTraits: new RepeatingAbilityMaker('racialtrait', 'action', 'Racial Traits', false, roll20),
      racialTraitsMacro: new RepeatingSectionMacroMaker('shaped_racialtraits', 'racialtrait', 'Racial Traits',
        roll20),
      classFeatures: new RepeatingAbilityMaker('classfeature', 'action', 'Class Features', false, roll20),
      classFeaturesMacro: new RepeatingSectionMacroMaker('shaped_classfeatures', 'classfeature', 'Class Features',
        roll20),
      feats: new RepeatingAbilityMaker('feat', 'action', 'Feats', false, roll20),
      featsMacro: new RepeatingSectionMacroMaker('shaped_feats', 'feat', 'Feats', roll20),
      actions: new RepeatingAbilityMaker('action', 'action', 'Actions', true, roll20),
      actionsMacro: new RepeatingSectionMacroMaker('shaped_actions', 'action', 'Actions', roll20),
      reactions: new RepeatingAbilityMaker('reaction', 'action', 'Reactions', false, roll20),
      reactionsMacro: new RepeatingSectionMacroMaker('shaped_reactions', 'reaction', 'Reactions', roll20),
      legendaryActions: new RepeatingAbilityMaker('legendaryaction', 'action', 'Legendary Actions', true, roll20),
      legendaryActionsMacro: new RepeatingSectionMacroMaker('shaped_legendaryactions', 'legendaryaction',
        'Legendary Actions', roll20),
      legendaryA: new RepeatingSectionMacroMaker('shaped_legendaryactions', 'legendaryaction',
        'LegendaryA', roll20),
      lairActions: new RepeatingSectionMacroMaker('shaped_lairactions', 'lairaction', 'Lair Actions', roll20),
      lairA: new RepeatingSectionMacroMaker('shaped_lairactions', 'lairaction', 'LairA', roll20),
      regionalEffects: new RepeatingSectionMacroMaker('shaped_regionaleffects', 'regionaleffect',
        'Regional Effects', roll20),
      regionalE: new RepeatingSectionMacroMaker('shaped_regionaleffects', 'regionaleffect', 'RegionalE', roll20),
    };


    return commandProcessor.addCommand('abilities', this.addAbility.bind(this), false)
      .withSelection({
        character: {
          min: 1,
          max: Infinity,
        },
      })
      .optionLookup('abilities', this.staticAbilityOptions)
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell0', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell1', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell2', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell3', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell4', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell5', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell6', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell7', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell8', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell9', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('trait', 'trait', this.roll20))
      .option('mark', ShapedConfig.booleanValidator);
  }

  addAbilitiesByName(abilities, character, showRecharges) {
    const caches = {};
    const options = {
      getCache(key) {
        return (caches[key] = caches[key] || {});
      },
      showRecharges,
    };
    // Slightly backwards way of doing this that ensures that we run the items in the order they are listed above
    // rather than the order they are passed in the parameter. Ideally we'd allow users to configure this but
    // since we haven't implemented that functionality the order is determine by the order in the saved configuration
    // object which is quite hard to control.
    _.chain(this.staticAbilityOptions)
      .pick((value, key) => _.contains(abilities, key))
      .each(abilityMaker => abilityMaker.run(character, options));
  }

  addAbility(options) {
    if (_.isEmpty(options.abilities)) {
      this.reportError('No abilities specified. ' +
        'Take a look at the documentation for a list of ability options.', options.playerId);
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

    this.reportPlayer('Ability Creation', `<ul>${messages.join('')}</ul>`, options.playerId);
  }
};
