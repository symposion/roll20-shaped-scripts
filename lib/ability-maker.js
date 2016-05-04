'use strict';
const _ = require('underscore');
const utils = require('./utils');
const ShapedModule = require('./shaped-module');
const ShapedConfig = require('./shaped-config');

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
      ability.set({ action: abilitySpec.action, istokenaction: true }); // TODO configure this
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
    const deleted = _.map(abilities, obj => {
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
        let repeatingAction = `%{${character.get('name')}|repeating_${this.repeatingSection}_${repeatingId}` +
          `_${this.abilityName}}`;
        if (this.canMark && options.mark) {
          repeatingAction += '\n!mark @{target|token_id}';
        }
        return { name: utils.toTitleCase(repeatingName), action: repeatingAction };
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
      action: `%{${character.get('name')}|${this.abilityName}}`,
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
      action: `!${this.command} ${utils.toOptionsString(this.options)}`,
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
        action: `!${cmdSpec.command} ${utils.toOptionsString(cmdSpec.options)}`,
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
        action: `%{${character.get('name')}|${this.abilityName}}`,
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
        utils.toTitleCase(optionName), roll20);
    }
    return undefined;
  };
}

module.exports = class AbilityMaker extends ShapedModule {
  addCommands(commandProcessor) {
    const roll20 = this.roll20;
    const staticAbilityOptions = {
      DELETE: new AbilityDeleter(roll20),
      initiative: new RollAbilityMaker('shaped_initiative', 'Init', roll20),
      abilityChecks: new RollAbilityMaker('shaped_ability_checks', 'Ability Checks', roll20),
      abilityChecksSmall: new RollAbilityMaker('shaped_ability_checks_small', 'Ability Checks', roll20),
      abilityChecksQuery: new RollAbilityMaker('shaped_ability_checks_query', 'Ability Checks', roll20),
      abilChecks: new RollAbilityMaker('shaped_ability_checks', 'AbilChecks', roll20),
      abilChecksSmall: new RollAbilityMaker('shaped_ability_checks_small', 'AbilChecks', roll20),
      abilChecksQuery: new RollAbilityMaker('shaped_ability_checks_query', 'AbilChecks', roll20),
      advantageTracker: new MultiCommandAbilityMaker([
        { command: 'shaped-at', options: ['advantage'], abilityName: 'Advantage' },
        { command: 'shaped-at', options: ['disadvantage'], abilityName: 'Disadvantage' },
        { command: 'shaped-at', options: ['normal'], abilityName: 'Normal' },
      ], roll20),
      advantageTrackerQuery: new CommandAbilityMaker('shaped-at',
        ['?{Roll Option|Normal,normal|w/ Advantage,advantage|w/ Disadvantage,disadvantage}'], '(dis)Adv Query', roll20),
      savingThrows: new RollAbilityMaker('shaped_saving_throw', 'Saving Throws', roll20),
      savingThrowsSmall: new RollAbilityMaker('shaped_saving_throw_small', 'Saving Throws', roll20),
      savingThrowsQuery: new RollAbilityMaker('shaped_saving_throw_query', 'Saving Throws', roll20),
      saves: new RollAbilityMaker('shaped_saving_throw', 'Saves', roll20),
      savesSmall: new RollAbilityMaker('shaped_saving_throw_small', 'Saves', roll20),
      savesQuery: new RollAbilityMaker('shaped_saving_throw_query', 'Saves', roll20),
      attacks: new RepeatingAbilityMaker('attack', 'attack', 'Attacks', true, roll20),
      attacksMacro: new RepeatingSectionMacroMaker('shaped_attacks', 'attack', 'Attacks', roll20),
      statblock: new RollAbilityMaker('shaped_statblock', 'Statblock', roll20),
      traits: new RepeatingAbilityMaker('trait', 'trait', 'Traits', false, roll20),
      traitsMacro: new RepeatingSectionMacroMaker('shaped_traits', 'trait', 'Traits', roll20),
      actions: new RepeatingAbilityMaker('action', 'action', 'Actions', true, roll20),
      actionsMacro: new RepeatingSectionMacroMaker('shaped_actions', 'action', 'Actions', roll20),
      reactions: new RepeatingAbilityMaker('reaction', 'action', 'Reactions', false, roll20),
      reactionsMacro: new RepeatingSectionMacroMaker('shaped_reactions', 'reaction', 'Reactions', roll20),
      legendaryActions: new RepeatingAbilityMaker('legendaryaction', 'action', 'Legendary Actions', false, roll20),
      legendaryActionsMacro: new RepeatingSectionMacroMaker('shaped_legendaryactions', 'legendaryaction',
        'Legendary Actions', roll20),
      legendaryA: new RepeatingAbilityMaker('legendaryaction', 'action', 'LegendaryA', false, roll20),
      lairActions: new RepeatingSectionMacroMaker('shaped_lairactions', 'lairaction', 'Lair Actions', roll20),
      lairA: new RepeatingSectionMacroMaker('shaped_lairactions', 'lairaction', 'LairA', roll20),
      regionalEffects: new RepeatingSectionMacroMaker('shaped_regionaleffects', 'regionaleffect',
        'Regional Effects', roll20),
      regionalE: new RepeatingSectionMacroMaker('shaped_regionaleffects', 'regionaleffect', 'RegionalE', roll20),
      rests: new CommandAbilityMaker('shaped-rest', ['?{Rest type|Short,short|Long,long}'], 'Rests', roll20),
    };


    return commandProcessor.addCommand('abilities', this.addAbility.bind(this))
      .withSelection({
        character: {
          min: 1,
          max: Infinity,
        },
      })
      .optionLookup('abilities', staticAbilityOptions)
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('spell', 'spell', this.roll20))
      .optionLookup('abilities', getRepeatingSectionAbilityLookup('trait', 'trait', this.roll20))
      .option('mark', ShapedConfig.booleanValidator);
  }

  addAbility(options) {
    if (_.isEmpty(options.abilities)) {
      this.reportError('No abilities specified. ' +
        'Take a look at the documentation for a list of ability options.');
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

    this.report('Ability Creation', `<ul>${messages.join('')}</ul>`);
  }
};
