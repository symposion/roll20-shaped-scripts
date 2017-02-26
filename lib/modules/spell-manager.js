'use strict';
const ShapedModule = require('./../shaped-module');
const _ = require('underscore');

module.exports = class SpellManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', 'spell', 'castAsLevel'], this.handleSpellCast.bind(this));
  }

  handleSpellCast(options) {
    if (options.ritual || !this.myState.config.sheetEnhancements.autoSpellSlots ||
      options.spellLevel === 'CANTRIP' || options.spellRepeat) {
      return;
    }

    const castingLevel = parseInt(options.castAsLevel, 10);
    if (_.isNaN(castingLevel)) {
      this.logger.error('Bad casting level [$$$]', options.castAsLevel);
      this.reportError('An error occured with spell slots, see the log for more details');
      return;
    }

    const spellPointsAttr = this.roll20.getAttrObjectByName(options.character.id, 'spell_points');
    if (spellPointsAttr && spellPointsAttr.get('current')) {
      const spellPointsLimit = parseInt(this.roll20.getAttrByName(options.character.id, 'spell_points_limit'), 10);
      const cost = castingLevel + Math.floor(castingLevel / 3) + 1;
      if (castingLevel <= spellPointsLimit && cost <= spellPointsAttr.get('current')) {
        spellPointsAttr.setWithWorker({ current: spellPointsAttr.get('current') - cost });
        return;
      }
    }


    const spellSlotAttr = this.roll20.getAttrObjectByName(options.character.id, `spell_slots_l${options.castAsLevel}`);
    const warlockSlotsAttr = this.roll20.getAttrObjectByName(options.character.id, 'warlock_spell_slots');
    if (warlockSlotsAttr && warlockSlotsAttr.get('current')) {
      const warlockSlotsLevelString = this.roll20.getAttrByName(options.character.id, 'warlock_spells_max_level');
      this.logger.debug('Warlock slots level: $$$', warlockSlotsLevelString);
      const warlockSlotsLevel = warlockSlotsLevelString ? parseInt(warlockSlotsLevelString.substring(0, 1), 10) : 0;
      this.logger.debug('Parsed warlock slots level: $$$', warlockSlotsLevel);
      if (warlockSlotsLevel === castingLevel) {
        this.logger.debug('Decrementing warlock spell slots attribute $$$', warlockSlotsAttr);
        warlockSlotsAttr.setWithWorker({ current: warlockSlotsAttr.get('current') - 1 });
        return;
      }
    }

    if (spellSlotAttr && spellSlotAttr.get('current')) {
      this.logger.debug('Decrementing normal spell slots attribute $$$', spellSlotAttr);
      spellSlotAttr.setWithWorker({ current: spellSlotAttr.get('current') - 1 });
    }
    else {
      this.reportPublic('Slots Police', `${options.characterName} cannot cast ${options.title} at level ` +
        `${options.castAsLevel} because they don't have enough spell slots/points.`);
    }
  }
};

