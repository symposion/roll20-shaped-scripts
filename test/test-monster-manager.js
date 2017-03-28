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
const MonsterManager = require('../lib/modules/monster-manager');
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

describe('monster-manager', function () {
  let roll20;
  let monsterManager;

  beforeEach(function () {
    roll20 = new Roll20();
    monsterManager = new MonsterManager({
      roll20,
      reporter: new Reporter(),
      logger,
      myState: { config: { tokenSettings: { light: {} } } },
      entityLookup: el.entityLookup,
      parseModule: {
        getParser() {
          return null;
        },
      },
      srdConverter: { convertMonster: _.identity, convertSpells: _.identity },
      newCharacterConfigurer: { configureCharacter(token, character) { return character; } },
      entityLister: { addEntity: _.noop },
    });
    monsterManager.configure(cp, null, { registerEventHandler: _.noop, registerAttributeChangeHandler: _.noop });
  });

  // after(function() {
  //   sinon.restore
  // });

  describe('#importMonsters', function () {
    it('token, no existing character, one monster', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(monsters, {},
        function (token, character) {
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
        });
    });

    it('token, existing character, one monster', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(monsters, {},
        function (token, character) {
          token.set('represents', character.id);
          roll20.createObj.withArgs('character', { name: 'monster' }).returns(character);
        },
        function (character, attributes, token) {
        });
    });

    it('token, existing character, one monster, overwrite', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(monsters, { overwrite: true },
        function (token, character) {
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
        });
    });

    it('token, existing character, one monster, replace', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(monsters, { replace: true },
        function (token, character) {
          character.set('name', 'monster2');
          token.set('represents', character.id);
          roll20.getObj.withArgs('character', character.id).returns(character);
        },
        function (character, attributes, token) {
        });
    });

    it('token, existing character, one monster, replace', function () {
      const monsters = [
        {
          name: 'monster',
        },
      ];

      return runImportMonsterTest(monsters, { replace: true },
        function (token, character) {
          character.set('name', 'monster');
          roll20.findObjs.withArgs({ type: 'character', name: 'monster' }).returns([character]);
        },
        function (character, attributes, token) {
        });
    });
  });

  // describe('#getTokenVisionConfigurer', function () {
  //   it('should configure senses correctly', function () {
  //     const token = new Roll20Object('graphic');
  //     monsterManager.getTokenVisionConfigurer(token, 'blindsight 80ft. tremorsense 60ft.')();
  //     expect(token.props).to.have.property('light_radius', 80);
  //     expect(token.props).to.have.property('light_dimradius', 80);
  //   });
  //
  //   it('should handle senses with conditions', function () {
  //     const token = new Roll20Object('graphic');
  //     monsterManager.getTokenVisionConfigurer(token,
  //       'blindsight 30 ft. or 10 ft. while deafened (blind beyond this radius)')();
  //     expect(token.props).to.have.property('light_radius', 30);
  //     expect(token.props).to.have.property('light_dimradius', 30);
  //   });
  //
  //   it('should handle darkvision with another sense', function () {
  //     const token = new Roll20Object('graphic');
  //     monsterManager.getTokenVisionConfigurer(token,
  //       'darkvision 40ft., tremorsense 20ft.')();
  //     expect(token.props).to.have.property('light_radius', Math.round(40 * 1.1666666));
  //     expect(token.props).to.have.property('light_dimradius', 20);
  //   });
  //
  //   it('should handle darkvision with another better sense', function () {
  //     const token = new Roll20Object('graphic');
  //     monsterManager.getTokenVisionConfigurer(token,
  //       'darkvision 30ft., tremorsense 40ft.')();
  //     expect(token.props).to.have.property('light_radius', 40);
  //     expect(token.props).to.have.property('light_dimradius', 40);
  //   });
  //
  //   it('should handle darkvision on its own', function () {
  //     const token = new Roll20Object('graphic');
  //     monsterManager.getTokenVisionConfigurer(token, 'darkvision 30ft.')();
  //     expect(token.props).to.have.property('light_radius', Math.round(30 * 1.1666666));
  //     expect(token.props).to.have.property('light_dimradius', -5);
  //   });
  // });


  function runImportMonsterTest(monsters, options, preConfigure, expectationChecker) {
    sinon.stub(roll20, 'createObj');
    sinon.stub(roll20, 'findObjs');
    sinon.stub(roll20, 'getAttrByName');
    sinon.stub(roll20, 'sendChat');
    sinon.stub(roll20, 'getObj');

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

    sinon.stub(roll20, 'getOrCreateAttr', function (characterId, name) {
      expect(characterId).to.equal(character.id);
      const attr = new Roll20Object('attribute');
      attributes[name] = attr;
      attr.remove = _.noop;
      return attr;
    });
    roll20.getAttrByName.withArgs(character.id, 'locked', 'current', true).returns(null);
    sinon.stub(monsterManager, 'monsterDataPopulator').returns(character);

    return monsterManager.importMonsters(monsters, options, token, []).then(() => {
      expectationChecker(character, attributes, token);
    });
  }
});

