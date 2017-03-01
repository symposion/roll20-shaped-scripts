'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');

class AmmoManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['ammoName', 'character'], this.consumeAmmo.bind(this));
  }

  consumeAmmo(options) {
    if (!this.roll20.checkCharacterFlag(options.character.id, 'ammo_auto_use')) {
      return;
    }

    const ammoAttr = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: options.character.id }))
      .filter(attribute => attribute.get('name').indexOf('repeating_ammo') === 0)
      .groupBy(attribute => attribute.get('name').replace(/(repeating_ammo_[^_]+).*/, '$1'))
      .find(attributeList =>
        _.find(attributeList, attribute =>
        attribute.get('name').match(/.*name$/) && attribute.get('current') === options.ammoName)
      )
      .find(attribute => attribute.get('name').match(/.*qty$/))
      .value();

    if (!ammoAttr) {
      this.logger.error('No ammo attribute found corresponding to name $$$', options.ammoName);
      return;
    }

    if (options.ammo) {
      const ammoRemaining = parseInt(options.ammo, 10);
      if (ammoRemaining >= 0) {
        ammoAttr.setWithWorker('current', ammoRemaining);
      }
      else {
        this.reportResult('Ammo Police', `${options.characterName} can't use ${options.title} because ` +
          `they don't have enough ${options.ammoName} left`, options);
      }
    }
  }
}

module.exports = AmmoManager;
