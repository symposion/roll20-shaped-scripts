'use strict';
const ShapedModule = require('../shaped-module');
const _ = require('underscore');
const ShapedConfig = require('../shaped-config');

module.exports = class SpellManager extends ShapedModule {

  addCommands(commandProc) {
    commandProc.addCommand('remove-spell', this.removeSpell.bind(this), false)
      .option('all', ShapedConfig.booleanValidator, false)
      .optionLookup('spells', this.spellLookup.bind(this), false)
      .withSelection({
        character: {
          min: 1,
          max: 1,
        },
      });
  }

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', 'spell', 'castAsLevel'], this.handleSpellCast.bind(this));
  }

  handleSpellCast(options) {
    const autoSlots = parseInt(this.roll20.getAttrByName(options.character.id,
      'automatically_expend_spell_resources'), 10);
    if (options.ritual || !autoSlots || options.spellLevel === 'CANTRIP' || options.spellRepeat) {
      return;
    }

    const castingLevel = parseInt(options.castAsLevel, 10);
    if (_.isNaN(castingLevel)) {
      this.logger.error('Bad casting level [$$$]', options.castAsLevel);
      this.reportError('An error occured with spell slots, see the log for more details', options.playerId);
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
      this.reportResult('Slots Police', `${options.characterName} cannot cast ${options.title} at level ` +
        `${options.castAsLevel} because they don't have enough spell slots/points.`, options);
    }
  }

  spellLookup(name, options) {
    const spellCache = this.getSpellCache(options);
    return spellCache[name.toLowerCase().replace(/\s+/g, '')];
  }

  getSpellCache(options) {
    const charId = options.selected.character.id;
    const spellCache = options.getCache('characterSpells');
    if (!spellCache.initialised) {
      _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
        .filter(attr => attr.get('name').match(/^repeating_spell\d.*/))
        .groupBy(attr => attr.get('name').match(/^repeating_spell\d_([^_]+)/)[1])
        .each((attrs, id) => {
          const name = attrs.find(attr => attr.get('name').match(/^.*_name$/)).get('current');
          if (name) {
            spellCache[name.toLowerCase().replace(/\s+/g, '')] = { attrs, id, name };
          }
        });
      Object.defineProperty(spellCache, 'initialised', { value: true });
    }
    return spellCache;
  }

  removeSpell(options) {
    if (!options.all && _.isEmpty(options.spells)) {
      this.reportError('You must supply either --all or a list of individual spells to !shaped-remove-spell');
      return;
    }
    const spellCache = this.getSpellCache(options);
    if (options.all) {
      options.spells = _.values(spellCache);
    }

    const removed = options.spells.map((spellDetails) => {
      _.invoke(spellDetails.attrs, 'remove');
      return spellDetails.name;
    });

    if (!_.isEmpty(removed)) {
      this.logger.debug('Spells removed: $$$', removed);
      this.reportPlayer('Spells Removed', 'Removed the following spells from character ' +
        `${options.selected.character.get('name')}: <ul><li>${removed.join('</li><li>')}</li></ul>`, options.playerId);
    }
    else {
      this.reportPlayer('No Spells Removed',
        `${options.selected.character.get('name')} has no spells to remove!`, options.playerId);
    }
  }
};

