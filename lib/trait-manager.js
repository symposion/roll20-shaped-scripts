'use strict';
const _ = require('underscore');

class TraitManager {

  constructor(logger, roll20, reporter) {
    this.logger = logger;
    this.roll20 = roll20;
    this.reporter = reporter;
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
    if (usesAttr) {
      if (usesAttr.get('current') > 0) {
        usesAttr.set('current', parseInt(usesAttr.get('current'), 10) - 1);
      }
      else {
        this.reporter.report('Trait Police', `${options.characterName} can't use ${options.title} because ` +
          'they don\'t have any uses left.');
      }
    }
  }
}

module.exports = TraitManager;
