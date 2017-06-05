/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const Roll20 = require('roll20-wrapper');
const AmmoManager = require('../lib/modules/ammo-manager');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const cp = require('./dummy-command-parser');
const _ = require('underscore');
const Roll20Object = require('./dummy-roll20-object');

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

const ammoUses = new Attribute('repeating_ammo_YYY_uses', 50);

const attributeArray = [
  new Attribute('normalAttr', 'someVal'),
  new Attribute('anotherNormalAttr', 'someVal'),
  new Attribute('repeating_foo_XXX_something', 'someVal'),
  new Attribute('repeating_foo_XXX_other', 'someVal'),
  new Attribute('repeating_foo_YYY_something', 'someVal'),
  new Attribute('repeating_foo_YYY_other', 'someVal'),
  new Attribute('repeating_ammo_XXX_uses', 20),
  new Attribute('repeating_ammo_XXX_weight', 0.25),
  new Attribute('repeating_ammo_XXX_name', 'bolts'),
  ammoUses,
  new Attribute('repeating_ammo_YYY_name', 'arrows'),
  new Attribute('repeating_ammo_YYY_weight', 0.1),
];

describe('ammo-manager', function () {
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
      roll20.checkCharacterFlag.withArgs(characterStub.id, 'ammo_auto_use').returns(true);
      roll20.getCampaign.returns(new Roll20Object('campaign'));

      const ammoManager = new AmmoManager({
        roll20, reporter: new Reporter(), logger, myState: { config: { updateAmmo: true } },
      });
      ammoManager.configure(cp, { registerChatListener: _.noop }, { registerEventHandler: _.noop });


      const options = { ammoName: 'arrows', ammo: '48', character: characterStub };

      const setVals = {};

      ammoUses.setWithWorker = function (propName, value) {
        setVals[propName] = value;
      };

      ammoManager.consumeAmmo(options);
      // noinspection JSUnresolvedVariable
      return setVals.should.deep.equal({ current: 48 });
    });
  });
});
