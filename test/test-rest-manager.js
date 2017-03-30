/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const _ = require('underscore');
const Roll20 = require('roll20-wrapper');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Roll20Object = require('./dummy-roll20-object');
const RestManager = require('../lib/modules/rest-manager');
const cp = require('./dummy-command-parser');
const Reporter = require('./dummy-reporter');

describe('rest-manager', function () {
  let restManager;
  let roll20;
  let char;
  let myState;
  let reporter;

  beforeEach(function () {
    roll20 = new Roll20();
    myState = { config: { variants: { rests: {} } } };
    reporter = new Reporter();
    restManager = new RestManager({
      roll20, reporter, logger, myState,
    });
    sinon.stub(roll20);

    char = new Roll20Object('character', { name: 'character' });
    restManager.configure(cp, null, { registerEventHandler: _.noop, registerAttributeChangeHandler: _.noop });
    this.skip();
  });


  describe('recoverUses', function () {
    it('deals with recharge-type uses for turn recharge', function () {
      const attributes = [
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_name', current: 'attack1' }),
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_recharge', current: 'TURN' }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_name', current: 'attack2' }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_recharge', current: 'RECHARGE_5_6' }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_name', current: 'attack3' }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_recharge', current: 'LONG_REST' }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_name', current: 'attack4' }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_uses', current: 1 }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_recharge', current: 'TURN' }),
        new Roll20Object('attribute', { name: 'repeating_foo_VVV_name', current: 'attack5' }),
        new Roll20Object('attribute', { name: 'repeating_foo_VVV_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_VVV_recharge', current: 'RECHARGE_6' }),
      ];
      roll20.findObjs.returns(attributes);
      roll20.randomInteger.returns(5);
      const result = restManager.recoverUses(char, 'turn', 'turn');
      expect(attributes[1].props).to.have.property('current', 3);
      expect(attributes[4].props).to.have.property('current', 3);
      expect(attributes[7].props).to.have.property('current', 1);
      expect(attributes[10].props).to.have.property('current', 1);
      expect(result.uses).to.deep.equal(['attack1', 'attack2 (Rolled a 5)']);
      expect(result.usesNotRecharged).to.deep.equal(['attack5 (Rolled a 5)']);
    });

    it('deals with recharge-type uses for short rest', function () {
      const attributes = [
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_name', current: 'attack1' }),
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_XXX_recharge', current: 'TURN' }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_name', current: 'attack2' }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_YYY_recharge', current: 'RECHARGE_5_6' }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_name', current: 'attack3' }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_uses', current: 1, max: 3 }),
        new Roll20Object('attribute', { name: 'repeating_foo_ZZZ_recharge', current: 'LONG_REST' }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_name', current: 'attack4' }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_uses', current: 1 }),
        new Roll20Object('attribute', { name: 'repeating_foo_WWW_recharge', current: 'TURN' }),
      ];
      roll20.findObjs.returns(attributes);
      restManager.recoverUses(char, 'turn', 'short');
      expect(attributes[1].props).to.have.property('current', 3);
      expect(attributes[4].props).to.have.property('current', 3);
      expect(attributes[7].props).to.have.property('current', 1);
      expect(attributes[10].props).to.have.property('current', 1);
    });
  });
});
