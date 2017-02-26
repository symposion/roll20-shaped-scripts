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

      const ammoManager = new AmmoManager();
      ammoManager.configure(roll20, new Reporter(), logger, { config: { updateAmmo: true } }, cp,
        { registerChatListener: _.noop });

      const msg = {
        rolltemplate: '5e-shaped',
        content: '{{ammo_name=arrows}}{{character_name=Bob}}{{ammo=$[[0]]}}',
        inlinerolls: [{ expression: '50-2' }],
      };

      const options = { ammoName: 'arrows', ammo: '$[[0]]', character: characterStub };

      const setVals = {};

      arrowsQty.setWithWorker = function (propName, value) {
        setVals[propName] = value;
      };

      ammoManager.consumeAmmo(options, msg);
      // noinspection JSUnresolvedVariable
      return setVals.should.deep.equal({ current: 48 });
    });
  });
});
