/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
const Roll20 = require('roll20-wrapper');
const expect = require('chai').expect;
const AbilityMaker = require('../lib/modules/ability-maker');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const cp = require('./dummy-command-parser');
const Roll20Object = require('./dummy-roll20-object');

describe('ability-maker', function () {
  let roll20;

  beforeEach(function () {
    roll20 = new Roll20();
  });


  describe('ability creation', function () {
    it('should create save ability', function () {
      sinon.stub(roll20);
      const characterStub = new Roll20Object('character');
      characterStub.set('name', 'Bob');
      const abilityStub = new Roll20Object('ability');
      roll20.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves',
      }).returns(abilityStub);
      const abilityMaker = new AbilityMaker({
        roll20, reporter: new Reporter(), logger, myState: {},
      });
      abilityMaker.configure(cp);
      abilityMaker.addAbility({
        selected: { character: [characterStub] },
        abilities: [abilityMaker.staticAbilityOptions.saves],
      });

      expect(roll20.getOrCreateObj.withArgs('ability', {
        characterid: characterStub.id,
        name: 'Saves',
      }).callCount).to.equal(1);
    });
  });
});
