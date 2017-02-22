'use strict';
const ShapedModule = require('./shaped-module');
const _ = require('underscore');

class UsesManager extends ShapedModule {

  addCommands(commandProcessor) {
    // no commands for this module
    return commandProcessor;
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
        `${options.title} so uses could not be decremented.`);
      return;
    }

    perUse = perUse || 1;

    const usesAttr = this.roll20.getAttrObjectByName(options.character.id, `${options.repeatingItem}_uses`);


    if (usesAttr && usesAttr.get('max')) {
      const currentVal = parseInt(usesAttr.get('current'), 10);
      if (currentVal - perUse >= 0) {
        usesAttr.setWithWorker('current', currentVal - perUse);
      }
      else {
        this.reportPublic('Uses Police', `${options.characterName} can't use ${options.title} because ` +
          'they don\'t have sufficient uses left.');
      }
    }
  }
}

module.exports = UsesManager;
