'use strict';
const _ = require('underscore');
const ShapedModule = require('./shaped-module');

class TraitManager extends ShapedModule {

  addCommands(commandProcessor) {
    // no commands for this module
    return commandProcessor;
  }

  /**
   * Handles the click event of a trait when 'autoTraits' is true
   * Consumes one use of the clicked trait
   * @param {object} options - The message options
   */
  handleTraitClick(options) {
    const traitId = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: options.character.id }))
      .map(attribute => (attribute.get('name').match(/^repeating_trait_([^_]+)_name$/) || [])[1])
      .reject(_.isUndefined)
      .uniq()
      .find(attId => this.roll20.getAttrByName(options.character.id, `repeating_trait_${attId}_name`) === options.title)
      .value();

    const usesAttr = this.roll20.getAttrObjectByName(options.character.id, `repeating_trait_${traitId}_uses`);
    const perUse = options.perUse || 1;
    if (usesAttr) {
      const currentVal = parseInt(usesAttr.get('current'), 10);
      if (currentVal - perUse >= 0) {
        usesAttr.set('current', currentVal - perUse);
      }
      else {
        this.reportPublic('Trait Police', `${options.characterName} can't use ${options.title} because ` +
          'they don\'t have sufficient uses left.');
      }
    }
  }
}

module.exports = TraitManager;
