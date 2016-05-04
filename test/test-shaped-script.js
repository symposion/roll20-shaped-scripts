/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const _ = require('underscore');
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

const arrowsQty = new Attribute('repeating_ammo_YYY_qty', 50);

const attributeArray = [
  new Attribute('normalAttr', 'someVal'),
  new Attribute('anotherNormalAttr', 'someVal'),
  new Attribute('repeating_foo_XXX_something', 'someVal'),
  new Attribute('repeating_foo_XXX_other', 'someVal'),
  new Attribute('repeating_foo_YYY_something', 'someVal'),
  new Attribute('repeating_foo_YYY_other', 'someVal'),
  new Attribute('repeating_ammo_XXX_qty', 20),
  new Attribute('repeating_ammo_XXX_weight', 0.25),
  new Attribute('repeating_ammo_XXX_name', 'bolts'),
  arrowsQty,
  new Attribute('repeating_ammo_YYY_name', 'arrows'),
  new Attribute('repeating_ammo_YYY_weight', 0.1),
];

describe('shaped-script', function () {
  let roll20;

  beforeEach(function () {
    roll20 = new Roll20();
  });

  describe('checkForAmmoUpdate', function () {
    it('should decrement ammo correctly', function () {
      sinon.stub(roll20);
      const characterStub = { id: 'myid' };


      roll20.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      roll20.findObjs.withArgs({ type: 'attribute', characterid: characterStub.id }).returns(attributeArray);
      roll20.getAttrByName.withArgs(characterStub.id, 'ammo_auto_use').returns('1');

      const shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20, null, null,
        new Reporter());

      const msg = {
        rolltemplate: '5e-shaped',
        content: '{{ammo_name=arrows}}{{character_name=Bob}}{{ammo=$[[0]]}}',
        inlinerolls: [{ expression: '50-2' }],
      };

      const options = shapedScript.getRollTemplateOptions(msg);

      const setVals = {};

      arrowsQty.set = function (propName, value) {
        setVals[propName] = value;
      };

      shapedScript.handleAmmo(options, msg);
      // noinspection JSUnresolvedVariable
      return setVals.should.deep.equal({ current: 48 });
    });
  });

  describe('#importMonsters', function () {
    it('token, no existing character, one monster', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      runImportMonsterTest(roll20, monsters, {},
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

      runImportMonsterTest(roll20, monsters, {},
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

      runImportMonsterTest(roll20, monsters, { overwrite: true },
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

      runImportMonsterTest(roll20, monsters, { replace: true },
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

      runImportMonsterTest(roll20, monsters, { replace: true },
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

  describe('#triggerChatWatchers', function () {
    it('trigger hd watcher', function () {
      sinon.stub(roll20);
      const characterStub = { id: 'myid' };
      roll20.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      const shapedScript = new ShapedScripts(logger, { config: { updateAmmo: true } }, roll20, null, null,
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

  describe('#getTokenVisionConfigurer', function () {
    let shapedScript;
    before(function () {
      shapedScript = new ShapedScripts(logger, { version: 0 }, roll20, null, null, new Reporter(),
        { convertMonster: _.identity }, _.identity, _.identity);
    });

    it('should configure senses correctly', function () {
      const token = new Roll20Object('graphic');
      shapedScript.getTokenVisionConfigurer(token, 'blindsight 80ft. tremorsense 60ft.')();
      expect(token.props).to.have.property('light_radius', 80);
      expect(token.props).to.have.property('light_dimradius', 80);
    });

    it('should handle senses with conditions', function () {
      const token = new Roll20Object('graphic');
      shapedScript.getTokenVisionConfigurer(token,
        'blindsight 30 ft. or 10 ft. while deafened (blind beyond this radius)')();
      expect(token.props).to.have.property('light_radius', 30);
      expect(token.props).to.have.property('light_dimradius', 30);
    });

    it('should handle darkvision with another sense', function () {
      const token = new Roll20Object('graphic');
      shapedScript.getTokenVisionConfigurer(token,
        'darkvision 40ft., tremorsense 20ft.')();
      expect(token.props).to.have.property('light_radius', 40 * 1.1666666);
      expect(token.props).to.have.property('light_dimradius', 20);
    });

    it('should handle darkvision with another better sense', function () {
      const token = new Roll20Object('graphic');
      shapedScript.getTokenVisionConfigurer(token,
        'darkvision 30ft., tremorsense 40ft.')();
      expect(token.props).to.have.property('light_radius', 40);
      expect(token.props).to.have.property('light_dimradius', 40);
    });

    it('should handle darkvision on its own', function () {
      const token = new Roll20Object('graphic');
      shapedScript.getTokenVisionConfigurer(token, 'darkvision 30ft.')();
      expect(token.props).to.have.property('light_radius', 30 * 1.1666666);
      expect(token.props).to.have.property('light_dimradius', -5);
    });
  });
});


function runImportMonsterTest(roll20, monsters, options, preConfigure, expectationChecker) {
  'use strict';
  sinon.stub(roll20, 'createObj');
  sinon.stub(roll20, 'findObjs');
  sinon.stub(roll20, 'getAttrByName');
  sinon.stub(roll20, 'sendChat');
  sinon.stub(roll20, 'getObj');
  const shapedScript = new ShapedScripts(logger, { version: 0 }, roll20, null, null, new Reporter(),
    { convertMonster: _.identity }, _.identity, _.identity);
  shapedScript.checkInstall();

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
    return attr;
  });
  roll20.getAttrByName.withArgs(character.id, 'locked').returns(null);

  shapedScript.importMonsters(monsters, options, token, []);
  expect(attributes.import_data_present.props.current).to.equal('on');
  expectationChecker(character, attributes, token);
}
