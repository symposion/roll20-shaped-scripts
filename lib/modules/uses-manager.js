'use strict';
const ShapedModule = require('./../shaped-module');
const _ = require('underscore');

class UsesManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', 'uses', 'repeatingItem'], this.handleUses.bind(this));
    chatWatcher.registerChatListener(['character', 'legendary'], this.handleLegendary.bind(this));
  }

  /**
   * Handles the click event of a trait when 'autoTraits' is true
   * Consumes one use of the clicked trait
   * @param {object} options - The message options
   */
  handleUses(options) {
    if (!this.myState.config.sheetEnhancements.autoTraits) {
      return;
    }

    let perUse = parseInt(options.perUse || 1, 10);
    if (_.isNaN(perUse)) {
      this.reportError(`Character ${options.characterName} has an invalid 'Per Use" value [${options.perUse}] for ` +
        `${options.title} so uses could not be decremented.`, options.playerId);
      return;
    }

    perUse = perUse || 1;

    const usesAttr = this.roll20.getAttrObjectByName(options.character.id, `${options.repeatingItem}_uses`);


    if (usesAttr && usesAttr.get('max')) {
      const currentVal = parseInt(usesAttr.get('current'), 10);
      if (currentVal - perUse >= 0) {
        usesAttr.setWithWorker({ current: currentVal - perUse });
      }
      else {
        this.reportResult('Uses Police', `${options.characterName} can't use ${options.title} because ` +
          'they don\'t have sufficient uses left.', options);
      }
    }
  }

  handleLegendary(options) {
    if (!this.myState.config.sheetEnhancements.autoTraits) {
      return;
    }


    let cost = 1;
    switch (options.cost) {
      case 'COSTS_2_ACTIONS':
        cost = 2;
        break;
      case 'COSTS_3_ACTIONS':
        cost = 3;
        break;
      default:
      // Do nothing
    }

    const legendaryAmountAttr = this.roll20.getAttrObjectByName(options.character.id, 'legendary_action_amount');
    if (!legendaryAmountAttr) {
      this.logger.error('No legendary action amount defined for character $$$ so can\'t decrement it',
        options.character.id);
      return;
    }

    const current = legendaryAmountAttr.get('current');
    if (cost > current) {
      this.reportResult('Uses Police', `${options.characterName} can't use ${options.title} because ` +
        'they don\'t have sufficient legendary points left.', options);
      return;
    }

    legendaryAmountAttr.setWithWorker({ current: current - 1 });
  }
}

module.exports = UsesManager;
