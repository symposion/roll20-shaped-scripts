/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const _ = require('underscore');
const Roll20 = require('roll20-wrapper');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const Roll20Object = require('./dummy-roll20-object');
const el = require('./dummy-entity-lookup');
const Importer = require('../lib/importer');
const cp = require('./dummy-command-parser');

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

function errorHandler(err) {
  throw err;
}

describe('importer', function () {
  let roll20;

  beforeEach(function () {
    roll20 = new Roll20();
  });

  describe('#importMonsters', function () {
    it('token, no existing character, one monster', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(roll20, monsters, {},
        function (token, character) {
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });
    });

    it('token, existing character, one monster', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(roll20, monsters, {},
        function (token, character) {
          token.set('represents', character.id);
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });
    });

    it('token, existing character, one monster, overwrite', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(roll20, monsters, { overwrite: true },
        function (token, character) {
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });
    });

    it('token, existing character, one monster, replace', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(roll20, monsters, { replace: true },
        function (token, character) {
          character.set('name', 'monster2');
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });
    });

    it('token, existing character, one monster, replace', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(roll20, monsters, { replace: true },
        function (token, character) {
          character.set('name', 'monster');
          roll20.findObjs.withArgs({ type: 'character', name: 'monster' }).returns([character]);
        },
        function (character, attributes, token) {
          expect(token.props.represents).to.equal(character.id);
          expect(character.props.avatar).to.equal('imgsrc');
        });
    });
  });

  describe('#runImportStage', function () {
    it('builds execution groups properly', function () {
      const roll20Mock = sinon.mock(roll20);
      const characterStub = {
        id: 'myid',
        get: function get() {
          return 'name';
        },
      };
      const attributes = {};
      const importer = new Importer(el.entityLookup, null, null);
      importer.configure(roll20, new Reporter(), logger, {}, errorHandler, cp);
      _.times(100, index => (attributes[`attr${index}`] = index));
      roll20Mock.expects('onSheetWorkerCompleted').twice().yieldsAsync();
      roll20Mock.expects('setAttrWithWorker').exactly(100);
      roll20Mock.expects('sendChat').once();
      return importer.runImportStage(characterStub, attributes, 'Test').then(() => roll20Mock.verify());
    });
  });

  describe('#spellAttributesForCharacter', function () {
    it('groups spell attributes correctly', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);
      const importer = new Importer(el.entityLookup, null, null);
      importer.configure(roll20, new Reporter(), logger, {}, errorHandler, cp);

      roll20Mock.expects('findObjs').returns(spellAttributes);
      const spells = importer.getSpellAttributesForCharacter(char);
      expect(_.size(spells)).to.equal(6);
      expect(spells).to.have.all.keys(['mage hand', 'shield', 'thunderwave (self only)', 'dimension door (self only)',
        'disintegrate', 'counterspell']);
      roll20Mock.verify();
    });

    it('creates attribute list for import spells', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);
      const srdConverterStub = {
        convertSpells: _.identity,
      };
      const importer = new Importer(el.entityLookup, null, null, srdConverterStub);
      importer.configure(roll20, new Reporter(), logger, {}, errorHandler, cp);
      roll20Mock.expects('findObjs').returns(spellAttributes);

      const attributes = importer.getSpellAttributesForImport(char, {},
        [{ name: 'Banishment', content: 'Banishment content' }, { name: 'Shield', content: 'Shield content' }], true);
      expect(attributes).to.deep.equal([
        { name: 'Shield', rowId: '2', level: 1 },
        { name: 'Thunderwave (self only)', rowId: '3', level: 1 },
        { name: 'Disintegrate', rowId: '5', level: 6 },
        { name: 'Counterspell', rowId: '6', level: 3 },
        { name: 'Banishment', content: 'Banishment content' },
      ]);
      roll20Mock.verify();
    });

    it('omits spells when overwrite not set', function () {
      const char = new Roll20Object('character', { name: 'character' });
      const roll20Mock = sinon.mock(roll20);
      const srdConverterStub = {
        convertSpells: _.identity,
      };
      const importer = new Importer(el.entityLookup, null, null, srdConverterStub);
      importer.configure(roll20, new Reporter(), logger, {}, errorHandler, cp);
      roll20Mock.expects('findObjs').returns(spellAttributes);

      const attributes = importer.getSpellAttributesForImport(char, {},
        [{ name: 'Banishment', content: 'Banishment content' }, { name: 'Mage Hand', content: 'Mage hand content' }],
        false);
      expect(attributes).to.deep.equal([
        { name: 'Shield', rowId: '2', level: 1 },
        { name: 'Thunderwave (self only)', rowId: '3', level: 1 },
        { name: 'Disintegrate', rowId: '5', level: 6 },
        { name: 'Counterspell', rowId: '6', level: 3 },
        { name: 'Banishment', content: 'Banishment content' },
      ]);
      roll20Mock.verify();
    });
  });

  describe('#getTokenVisionConfigurer', function () {
    let importer;
    before(function () {
      importer = new Importer(el.entityLookup, null, null);
      importer.configure(roll20, new Reporter(), logger, {}, errorHandler, cp);
    });

    it('should configure senses correctly', function () {
      const token = new Roll20Object('graphic');
      importer.getTokenVisionConfigurer(token, 'blindsight 80ft. tremorsense 60ft.')();
      expect(token.props).to.have.property('light_radius', 80);
      expect(token.props).to.have.property('light_dimradius', 80);
    });

    it('should handle senses with conditions', function () {
      const token = new Roll20Object('graphic');
      importer.getTokenVisionConfigurer(token,
        'blindsight 30 ft. or 10 ft. while deafened (blind beyond this radius)')();
      expect(token.props).to.have.property('light_radius', 30);
      expect(token.props).to.have.property('light_dimradius', 30);
    });

    it('should handle darkvision with another sense', function () {
      const token = new Roll20Object('graphic');
      importer.getTokenVisionConfigurer(token,
        'darkvision 40ft., tremorsense 20ft.')();
      expect(token.props).to.have.property('light_radius', Math.round(40 * 1.1666666));
      expect(token.props).to.have.property('light_dimradius', 20);
    });

    it('should handle darkvision with another better sense', function () {
      const token = new Roll20Object('graphic');
      importer.getTokenVisionConfigurer(token,
        'darkvision 30ft., tremorsense 40ft.')();
      expect(token.props).to.have.property('light_radius', 40);
      expect(token.props).to.have.property('light_dimradius', 40);
    });

    it('should handle darkvision on its own', function () {
      const token = new Roll20Object('graphic');
      importer.getTokenVisionConfigurer(token, 'darkvision 30ft.')();
      expect(token.props).to.have.property('light_radius', Math.round(30 * 1.1666666));
      expect(token.props).to.have.property('light_dimradius', -5);
    });
  });
});


function runImportMonsterTest(roll20, monsters, options, preConfigure, expectationChecker) {
  sinon.stub(roll20, 'createObj');
  sinon.stub(roll20, 'findObjs');
  sinon.stub(roll20, 'getAttrByName');
  sinon.stub(roll20, 'sendChat');
  sinon.stub(roll20, 'getObj');
  sinon.stub(roll20, 'setDefaultTokenForCharacter');
  const importer = new Importer(el.entityLookup, null, null, { convertMonster: _.identity });
  importer.configure(roll20, new Reporter(), logger, { config: { tokenSettings: { light: {} } } }, errorHandler, cp);

  const token = new Roll20Object('graphic');
  token.set('imgsrc', 'imgsrc');

  const attributes = {};
  const character = new Roll20Object('character');

  preConfigure(token, character);

  sinon.stub(roll20, 'setAttrByName', function (characterId, name, value) {
    expect(characterId).to.equal(character.id);
    const attr = attributes[name] || new Roll20Object('attribute');
    attr.set('current', value);
    attributes[name] = attr;
  });

  roll20.findObjs.withArgs({ type: 'attribute', characterid: character.id }).returns([]);
  sinon.stub(roll20, 'getOrCreateAttr', function (characterId, name) {
    expect(characterId).to.equal(character.id);
    const attr = new Roll20Object('attribute');
    attributes[name] = attr;
    attr.remove = _.noop;
    return attr;
  });
  roll20.getAttrByName.withArgs(character.id, 'locked').returns(null);
  sinon.stub(importer, 'applyCharacterDefaults').returns(character);
  sinon.stub(importer, 'monsterDataPopulator').returns(character);
  sinon.stub(importer, 'createTokenActions').returns(character);

  return importer.importMonsters(monsters, options, token, []).then(() => {
    expectationChecker(character, attributes, token);
  });
}
