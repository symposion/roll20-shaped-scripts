/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
const expect = require('chai').expect;
const Roll20 = require('roll20-wrapper');
const SpellManager = require('../lib/modules/spell-manager');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const Roll20Object = require('./dummy-roll20-object');
const cp = require('./dummy-command-parser');
const _ = require('underscore');


describe('shaped-script', function () {
  let roll20;
  let spellManager;

  beforeEach(function () {
    roll20 = new Roll20();
    spellManager = new SpellManager();
    const reporter = new Reporter();
    spellManager.configure(roll20, reporter, logger, { config: { sheetEnhancements: { autoSpellSlots: true } } }, cp,
      { registerChatListener: _.noop }, { registerEventHandler: _.noop });
  });

  describe('handleSpellCast', function () {
    it('should deal with cantrips correctly', function () {
      const mock = sinon.mock(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');

      mock.expects('getAttrObjectByName').never();
      spellManager.handleSpellCast({ castAsLevel: '', character: char, spellLevel: 'CANTRIP' });
      mock.verify();
    });

    it('should deal with normal spells correctly', function () {
      sinon.stub(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');

      const slotsAttr = new Roll20Object('attribute', { name: 'spell_slots_l5', current: 2 });
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_slots_l5').returns(slotsAttr);
      roll20.getAttrObjectByName.withArgs(char.id, 'warlock_spell_slots').returns(null);
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_points').returns(null);

      spellManager.handleSpellCast({ castAsLevel: 5, character: char });
      expect(slotsAttr.props).to.have.property('current', 1);
    });
  });
});
