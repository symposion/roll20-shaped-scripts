'use strict';
const _ = require('underscore');

class RestManager {

  constructor(logger, myState, roll20) {
    this.logger = logger;
    this.myState = myState;
    this.roll20 = roll20;
  }

  /**
   * Performs all of the short rest actions for the specified character
   * @param {collection of characters} selectedChars - The characters to perform short rest actions on
   */
  doShortRest(selectedChars) {
    _.each(selectedChars, (currentChar) => {
      const charId = currentChar.get('_id');
      this.logger.debug(`Processing short rest for ${this.roll20.getObj('character', charId).get('name')}:`);

      this.rechargeTraits(charId, 'Short Rest');
    });
  }

  /**
   * Performs all of the long rest actions for the specified character - including short rest actions
   * @param {collection of characters} selectedChars - The characters to perform long rest actions on
   */
  doLongRest(selectedChars) {
    _.each(selectedChars, (currentChar) => {
      const charId = currentChar.get('_id');
      this.logger.debug(`Processing long rest for ${this.roll20.getObj('character', charId).get('name')}:`);

      this.rechargeTraits(charId, 'short');
      this.rechargeTraits(charId, 'long');

      this.resetHP(charId);

      this.regainHitDie(charId);

      this.regainSpellSlots(charId);
    });
  }

  /**
   * Recharges all of the repeating 'traits' section items that have a 'recharge' defined
   * @param {string} charId - the Roll20 character ID
   * @param {string} restType - the type of rest being performed; either 'Short Rest' or 'Long Rest'
   */
  rechargeTraits(charId, restType) {
    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .map(attribute => (attribute.get('name').match(/^repeating_trait_([^_]+)_recharge$/) || [])[1])
      .reject(_.isUndefined)
      .uniq()
      .each(attId => {
        const traitPre = `repeating_trait_${attId}`;
        const rechargeAtt = this.roll20.getAttrByName(charId, `${traitPre}_recharge`);
        if (rechargeAtt.toLowerCase().indexOf(restType) !== -1) {
          const attName = this.roll20.getAttrByName(charId, `${traitPre}_name`);
          this.logger.debug(`Recharging '${attName}'`);
          const max = this.roll20.getAttrByName(charId, `${traitPre}_uses`, 'max');
          this.roll20.setAttrByName(charId, `${traitPre}_uses`, max);
        }
      });
  }

  /**
   * Resets the HP of the specified character to its maximum value
   * @param {string} charId - the Roll20 character ID
   */
  resetHP(charId) {
    this.logger.debug('Resetting HP to max');
    const max = this.roll20.getAttrByName(charId, 'HP', 'max');
    this.roll20.setAttrByName(charId, 'HP', max);
  }

  /**
   * Adds Hit die to the specified character based on PHB rules
   * @param {string} charId - the Roll20 character ID
   */
  regainHitDie(charId) {
    this.logger.debug('Regaining Hit Die');
    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => (attribute.get('name').match(/^hd_d\d{1,2}$/)))
      .uniq()
      .each(hdAttr => {
        const max = parseInt(hdAttr.get('max'), 10);
        if (max > 0) {
          const current = parseInt(hdAttr.get('current'), 10);
          let newCurrent = current;
          const regained = max === 1 ? 1 : Math.floor(max / 2);
          newCurrent += regained;
          this.roll20.setAttrByName(charId, hdAttr.get('name'), newCurrent > max ? max : newCurrent);
        }
      });
  }

  /**
   * Resets all (non warlock) spell slots of the specified character to their maximum valus
   * @param {string} charId - the Roll20 character ID
   */
  regainSpellSlots(charId) {
    this.logger.debug('Regaining Spell Slots');
    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => (attribute.get('name').match(/^spell_slots_l\d$/)))
      .uniq()
      .each(slotAttr => {
        const max = parseInt(slotAttr.get('max'), 10);
        if (max > 0) {
          this.roll20.setAttrByName(charId, slotAttr.get('name'), max);
        }
      });
  }
}

module.exports = RestManager;
