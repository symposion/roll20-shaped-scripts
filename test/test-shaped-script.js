/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const Roll20 = require('roll20-wrapper');
const ShapedScripts = require('../lib/shaped-script');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const Roll20Object = require('./dummy-roll20-object');
const el = require('./dummy-entity-lookup');

/**
 * Test attribute
 * @param name
 * @param value
 * @constructor
 */
function Attribute(name, value) {
  this.name = name;
  this.value = value;
}

// noinspection JSUnusedGlobalSymbols
Attribute.prototype.get = function (propName) {
  switch (propName) {
    case 'current':
      return this.value;
    case 'name':
      return this.name;
    default:
      throw new Error(`Unrecognised property name ${propName}`);
  }
};

describe('shaped-script', function () {
  let roll20;

  beforeEach(function () {
    roll20 = new Roll20();
  });

  describe('#triggerChatWatchers', function () {
    it('trigger hd watcher', function () {
      sinon.stub(roll20);
      const characterStub = { id: 'myid' };
      roll20.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      const shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20, null, el.entityLookup,
        new Reporter());
      shapedScript.registerEventHandlers();
      const msg = {
        rolltemplate: '5e-shaped',
        content: '{{uses=@{Bellaluna|hd_d10}}}{{uses_max=@{Bellaluna|hd_d10|max}}{{character_name=Bob}}' +
        '@{Bob|attacher_hit_dice}',
        inlinerolls: [{ expression: '50-2' }],
      };
      shapedScript.triggerChatWatchers(msg);
    });
  });

  describe('ability creation', function () {
    it('should create save ability', function () {
      sinon.stub(roll20);
      const characterStub = new Roll20Object('character');
      characterStub.set('name', 'Bob');
      const tokenStub = new Roll20Object('graphic');
      const abilityStub = new Roll20Object('ability');
      tokenStub.set('represents', characterStub.id);
      roll20.getObj.withArgs('graphic', tokenStub.id).returns(tokenStub);
      roll20.getObj.withArgs('character', characterStub.id).returns(characterStub);
      roll20.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves',
      }).returns(abilityStub);
      const reporter = new Reporter();
      const shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20, null,
        el.entityLookup, reporter);
      shapedScript.handleInput({
        type: 'api',
        content: '!shaped-abilities --saves',
        selected: [{ _type: 'graphic', _id: tokenStub.id }],
      });
      expect(roll20.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves',
      }).callCount).to.equal(1);
    });
  });

  describe('handleSpellCast', function () {
    it('should deal with cantrips correctly', function () {
      const mock = sinon.mock(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');
      const reporter = new Reporter();
      const shapedScript = new ShapedScripts(logger, { config: { sheetEnhancements: { autoSpellSlots: true } } },
        roll20, null, el.entityLookup, reporter);

      mock.expects('getAttrObjectByName').never();
      shapedScript.handleSpellCast({ castAsLevel: '', character: char, spellLevel: 'CANTRIP' });
      mock.verify();
    });

    it('should deal with normal spells correctly', function () {
      sinon.stub(roll20);
      const char = new Roll20Object('character');
      char.set('name', 'Bob');
      const reporter = new Reporter();
      const shapedScript = new ShapedScripts(logger, { config: { sheetEnhancements: { autoSpellSlots: true } } },
        roll20, null, el.entityLookup, reporter);

      const slotsAttr = new Roll20Object('attribute', { name: 'spell_slots_l5', current: 2 });
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_slots_l5').returns(slotsAttr);
      roll20.getAttrObjectByName.withArgs(char.id, 'warlock_spell_slots').returns(null);
      roll20.getAttrObjectByName.withArgs(char.id, 'spell_points').returns(null);

      shapedScript.handleSpellCast({ castAsLevel: 5, character: char });
      expect(slotsAttr.props).to.have.property('current', 1);
    });
  });
});
