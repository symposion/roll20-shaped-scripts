'use strict';
const _ = require('underscore');
const ShapedModule = require('../shaped-module');
const ShapedConfig = require('../shaped-config');

class AmmoManager extends ShapedModule {

  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerEventHandler('change:campaign:initiativepage', (initPage) => {
      this.logger.debug('Initiative page changed to: $$$', initPage);
      if (initPage) {
        this.myState.ammoTracking = {};
      }
      else {
        this.reportTotalAmmoUse();
        this.myState.ammoTracking = {};
      }
    });
  }

  addCommands(commandProc) {
    commandProc
      .addCommand('recover-ammo', this.recoverAmmo.bind(this), true)
      .option('ammoAttr', ShapedConfig.getObjectValidator('attribute', this.roll20), true)
      .option('uses', ShapedConfig.integerValidator, true);
  }

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
      .find(attribute => attribute.get('name').match(/.*uses$/))
      .value();

    if (!ammoAttr) {
      this.logger.error('No ammo attribute found corresponding to name $$$', options.ammoName);
      return;
    }

    if (options.ammo) {
      const ammoRemaining = parseInt(options.ammo, 10);
      if (ammoRemaining >= 0) {
        const current = parseInt(ammoAttr.get('current'), 10);
        ammoAttr.setWithWorker('current', ammoRemaining);
        const ammoTracking = this.getAmmoTracking();
        if (ammoTracking) {
          ammoTracking[ammoAttr.id] = (ammoTracking[ammoAttr.id] || 0) + current - ammoRemaining;
        }
      }
      else {
        this.reportResult('Ammo Police', `${options.characterName} can't use ${options.title} because ` +
          `they don't have enough ${options.ammoName} left`, options);
      }
    }
  }

  getAmmoTracking() {
    if (this.roll20.getCampaign().get('initiativepage')) {
      this.myState.ammoTracking = this.myState.ammoTracking || {};
      return this.myState.ammoTracking;
    }
    return null;
  }

  reportTotalAmmoUse() {
    if (!this.myState.config.sheetEnhancements.ammoRecovery) {
      return;
    }
    const recoveryStrings = _.chain(this.myState.ammoTracking)
      .map((used, id) => {
        const ammoAttr = this.roll20.getObj('attribute', id);
        if (!ammoAttr) {
          return null;
        }
        const ammoName = this.roll20.getAttrByName(ammoAttr.get('characterid'),
          ammoAttr.get('name').replace(/_uses/, '_name'));
        const char = this.roll20.getObj('character', ammoAttr.get('characterid'));
        return `${char.get('name')} used ${used} ${ammoName}.&nbsp;<a href="!shaped-recover-ammo ` +
          `--ammoAttr ${id} --uses ?{Uses to recover|${Math.floor(used / 2)}}">Recover</a>`;
      })
      .compact()
      .value();

    if (!_.isEmpty(recoveryStrings)) {
      const msg = `<ul><li>${recoveryStrings.join('</li><li>')}</li></ul>`;
      this.reportPlayer('Ammo Recovery', msg);
    }
  }

  recoverAmmo(options) {
    const ammoName = this.roll20.getAttrByName(options.ammoAttr.get('characterid'),
      options.ammoAttr.get('name').replace(/_uses/, '_name'));
    options.ammoAttr.setWithWorker({ current: options.ammoAttr.get('current') + options.uses });
    this.reportCharacter('Ammo Recovery', `You recover ${options.uses} ${ammoName}`,
      options.ammoAttr.get('characterid'));
  }

}

module.exports = AmmoManager;
