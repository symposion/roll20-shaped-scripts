'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');

class AmmoManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['ammoName', 'character'], this.consumeAmmo.bind(this));
  }

  consumeAmmo(options, msg) {
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

    let ammoUsed = 1;
    if (options.ammo) {
      const rollRef = options.ammo.match(/\$\[\[(\d+)\]\]/);
      if (rollRef) {
        const rollExpr = msg.inlinerolls[rollRef[1]].expression;
        const match = rollExpr.match(/\d+-(\d+)/);
        if (match) {
          ammoUsed = match[1];
        }
      }
    }

    const val = parseInt(ammoAttr.get('current'), 10) || 0;
    ammoAttr.setWithWorker('current', Math.max(0, val - ammoUsed));
  }
}

module.exports = AmmoManager;
