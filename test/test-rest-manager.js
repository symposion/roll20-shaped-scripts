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

const testRests = [
  {
    name: 'rest1',
    operations: [
      _.constant({ result1: 1 }),
      _.constant({ result2: 2 }),
      _.constant({ result1: 3 }),
    ],
    displayName: 'Rest Type 1',
  },
  {
    name: 'rest2',
    operations: [
      _.constant({ result2: 4 }),
      _.constant({ result3: 5 }),
      _.constant(null),
      (char, type) => ({ result3: `${char.get('name')}: ${type}` }),
    ],
    displayName: 'Rest Type 2',
  },
  {
    name: 'rest3',
    operations: [
      _.constant({ result4: 6 }),
      _.constant({}),
      (char, type) => ({ result3: `${char.get('name')}: ${type}` }),
      _.constant({ result4: [] }),
      _.constant({ result4: null }),
    ],
    displayName: 'Rest Type 3',
  },
];

const testTemplates = {
  result1: _.template('Result1: <%= result1 %>'),
  result2: _.template('Result2: <%= result2 %>'),
  result3: _.template('Result3: <%= result3 %>'),
  result4: _.template('Result4: <%= result4 %>'),
};

const expectedResultsAllRests = {
  result1: [1, 3],
  result2: [2, 4],
  result3: [5, 'character: rest2', 'character: rest3'],
  result4: 6,
};

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
    restManager.configure(cp, null, { registerEventHandler: _.noop });
    this.skip();
  });

  describe('doRest', function () {
    beforeEach(function () {
      restManager.rests = testRests;
      restManager.displayTemplates = testTemplates;
    });

    it('only runs first rest operations for first rest', function () {
      const results = restManager.doRest(char, 'rest1');
      expect(results).to.deep.equal({
        result1: [1, 3],
        result2: 2,
      });
    });

    it('runs all operations for last rest', function () {
      const results = restManager.doRest(char, 'rest3');
      expect(results).to.deep.equal(expectedResultsAllRests);
    });
  });

  describe('buildMessage', function () {
    beforeEach(function () {
      restManager.rests = testRests;
      restManager.displayTemplates = testTemplates;
    });
    it('builds message correctly', function () {
      roll20.getAttrByName.returns('@{show_character_name_yes}');
      const msg = restManager.buildMessage(char, 'rest3', expectedResultsAllRests);
      expect(msg).to.equal(
        '&{template:5e-shaped} {{title=Rest Type 3}} {{character_name=character}}{{show_character_name=1}}' +
        'Result1: 1,3Result2: 2,4Result3: 5,character: rest2,character: rest3Result4: 6');
    });
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

  describe('recoverHP', function () {
    it('recoversForHalfHP', function () {
      myState.config.variants.rests.longRestHPRecovery = 0.5;
      const hpAttr = new Roll20Object('attribute', { current: 20, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(45);
    });

    it('recoversForFullHP', function () {
      myState.config.variants.rests.longRestHPRecovery = 1;
      const hpAttr = new Roll20Object('attribute', { current: 30, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(50);
    });

    it('recoversForNoHP', function () {
      myState.config.variants.rests.longRestHPRecovery = 0;
      const hpAttr = new Roll20Object('attribute', { current: 30, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(30);
    });

    it('errorsForNoMaxHP', function () {
      myState.config.variants.rests.longRestHPRecovery = 1;
      const hpAttr = new Roll20Object('attribute', { current: 30 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(30);
    });

    it('dealsWithMissingCurrent', function () {
      myState.config.variants.rests.longRestHPRecovery = 0.5;
      const hpAttr = new Roll20Object('attribute', { max: 30 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(15);
    });
  });

  describe('recoverHD', function () {
    it('recoversForHalfHD', function () {
      myState.config.variants.rests.longRestHDRecovery = 0.5;
      const hdAttrs = [new Roll20Object('attribute', { name: 'hd_d8', current: 1, max: 5 })];
      roll20.findObjs.withArgs({ type: 'attribute', characterid: char.id }).returns(hdAttrs);
      restManager.recoverHD(char);
      expect(hdAttrs[0].props.current).to.equal(3);
    });

    it('ignoresHDForZeroMultiplier', function () {
      myState.config.variants.rests.longRestHDRecovery = 0;
      const hdAttrs = [
        new Roll20Object('attribute', { name: 'hd_d8', current: 1, max: 5 }),
        new Roll20Object('attribute', { name: 'hd_d10', current: 3, max: 5 }),
      ];
      roll20.findObjs.withArgs({ type: 'attribute', characterid: char.id }).returns(hdAttrs);
      restManager.recoverHD(char);
      expect(hdAttrs[0].props.current).to.equal(1);
      expect(hdAttrs[1].props.current).to.equal(3);
    });

    it('recoversFullHD', function () {
      myState.config.variants.rests.longRestHDRecovery = 1;
      const hdAttrs = [
        new Roll20Object('attribute', { name: 'hd_d8', current: 1, max: 5 }),
        new Roll20Object('attribute', { name: 'hd_d10', current: 3, max: 10 }),
      ];
      roll20.findObjs.withArgs({ type: 'attribute', characterid: char.id }).returns(hdAttrs);
      restManager.recoverHD(char);
      expect(hdAttrs[0].props.current).to.equal(5);
      expect(hdAttrs[1].props.current).to.equal(10);
    });
  });
});
