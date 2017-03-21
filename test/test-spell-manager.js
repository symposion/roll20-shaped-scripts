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
const el = require('./dummy-entity-lookup');

const spellAttributes = [
  new Roll20Object('attribute', { name: 'repeating_spell0_1_name', current: 'Mage Hand' }),
  new Roll20Object('attribute', { name: 'repeating_spell0_1_level', current: 0 }),
  new Roll20Object('attribute', { name: 'repeating_spell0_1_content', current: 'Mage hand Content' }),
  new Roll20Object('attribute', { name: 'repeating_spell1_2_name', current: 'Shield *' }),
  new Roll20Object('attribute', { name: 'repeating_spell1_2_level', current: 1 }),
  new Roll20Object('attribute', { name: 'repeating_spell1_3_name', current: 'Thunderwave (self only)' }),
  new Roll20Object('attribute', { name: 'repeating_spell5_4_name', current: 'Dimension Door (self only)' }),
  new Roll20Object('attribute', { name: 'repeating_spell5_4_content', current: 'Dimension Door content' }),
  new Roll20Object('attribute', { name: 'repeating_spell6_5_name', current: 'Disintegrate' }),
  new Roll20Object('attribute', { name: 'repeating_spell3_6_name', current: 'Counterspell' }),
];

describe('spell-manager', function () {
  let roll20;
  let spellManager;

  beforeEach(function () {
    roll20 = new Roll20();
    const reporter = new Reporter();
    const myState = { config: { sheetEnhancements: { autoSpellSlots: true } } };
    spellManager = new SpellManager({
      roll20,
      reporter,
      logger,
      myState,
      entityLookup: el.entityLookup,
      entityLister: { addEntity: _.noop },
      srdConverter: { convertSpells: _.identity },
    });

    spellManager.configure(cp, { registerChatListener: _.noop }, { registerEventHandler: _.noop });
  });

  describe('handleSpellCast', function () {
    it('should deal with cantrips correctly', function () {
      const mock = sinon.mock(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');

      mock.expects('getAttrObjectByName').never();
      mock.expects('getAttrByName').withArgs(char.id, 'automatically_expend_spell_resources').returns(1);
      spellManager.handleSpellCast({ castAsLevel: '', character: char, spellLevel: 'CANTRIP' });
      mock.verify();
    });

    it('should deal with normal spells correctly', function () {
      sinon.stub(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');
      roll20.getAttrByName.withArgs(char.id, 'automatically_expend_spell_resources').returns(1);
      const slotsAttr = new Roll20Object('attribute', { name: 'spell_slots_l5', current: 2 });
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_slots_l5').returns(slotsAttr);
      roll20.getAttrObjectByName.withArgs(char.id, 'warlock_spell_slots').returns(null);
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_points').returns(null);

      spellManager.handleSpellCast({ castAsLevel: 5, character: char });
      expect(slotsAttr.props).to.have.property('current', 1);
    });
  });

  describe('#spellAttributesForCharacter', function () {
    it('groups spell attributes correctly', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);

      roll20Mock.expects('findObjs').returns(spellAttributes);
      const spells = spellManager.getSpellAttributesForCharacter(char);
      expect(_.size(spells)).to.equal(6);
      expect(spells).to.have.all.keys(['mage hand', 'shield', 'thunderwave (self only)', 'dimension door (self only)',
        'disintegrate', 'counterspell']);
      roll20Mock.verify();
    });

    it('creates attribute list for import spells', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);
      roll20Mock.expects('findObjs').returns(spellAttributes);

      const attributes = spellManager.getSpellAttributesForImport(char, {},
        [{ name: 'Banishment', content: 'Banishment content' }, { name: 'Shield', content: 'Shield content' }], true);
      expect(JSON.parse(attributes.import_data).spell_data).to.deep.equal([
        { name: 'Shield', rowId: '2', level: 1, source: 'unnamed' },
        { name: 'Thunderwave (self only)', rowId: '3', level: 1, source: 'unnamed' },
        { name: 'Disintegrate', rowId: '5', level: 6, source: 'unnamed' },
        { name: 'Counterspell', rowId: '6', level: 3, source: 'unnamed' },
        { name: 'Banishment', content: 'Banishment content' },
      ]);
      roll20Mock.verify();
    });

    it('omits spells when overwrite not set', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);
      roll20Mock.expects('findObjs').returns(spellAttributes);

      const attributes = spellManager.getSpellAttributesForImport(char, {},
        [{ name: 'Banishment', content: 'Banishment content' }, { name: 'Mage Hand', content: 'Mage hand content' }],
        false);
      expect(JSON.parse(attributes.import_data).spell_data).to.deep.equal([
        { name: 'Shield', rowId: '2', level: 1, source: 'unnamed' },
        { name: 'Thunderwave (self only)', rowId: '3', level: 1, source: 'unnamed' },
        { name: 'Disintegrate', rowId: '5', level: 6, source: 'unnamed' },
        { name: 'Counterspell', rowId: '6', level: 3, source: 'unnamed' },
        { name: 'Banishment', content: 'Banishment content' },
      ]);
      roll20Mock.verify();
    });
  });
});
