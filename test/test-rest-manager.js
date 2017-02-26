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
  let state;
  let reporter;

  beforeEach(function () {
    roll20 = new Roll20();
    state = { config: { variants: { rests: {} } } };
    restManager = new RestManager();
    sinon.stub(roll20);
    reporter = new Reporter();
    char = new Roll20Object('character', { name: 'character' });
    restManager.configure(roll20, reporter, logger, state, cp);
    restManager.rests = testRests;
    restManager.displayTemplates = testTemplates;
  });

  describe('doRest', function () {
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
    it('builds message correctly', function () {
      roll20.getAttrByName.returns('@{show_character_name_yes}');
      const msg = restManager.buildMessage(char, 'rest3', expectedResultsAllRests);
      expect(msg).to.equal(
        '&{template:5e-shaped} {{title=Rest Type 3}} {{character_name=character}}{{show_character_name=1}}' +
        'Result1: 1,3Result2: 2,4Result3: 5,character: rest2,character: rest3Result4: 6');
    });
  });

  describe('recoverHP', function () {
    it('recoversForHalfHP', function () {
      state.config.variants.rests.longRestHPRecovery = 0.5;
      const hpAttr = new Roll20Object('attribute', { current: 20, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(45);
    });

    it('recoversForFullHP', function () {
      state.config.variants.rests.longRestHPRecovery = 1;
      const hpAttr = new Roll20Object('attribute', { current: 30, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(50);
    });

    it('recoversForNoHP', function () {
      state.config.variants.rests.longRestHPRecovery = 0;
      const hpAttr = new Roll20Object('attribute', { current: 30, max: 50 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(30);
    });

    it('errorsForNoMaxHP', function () {
      state.config.variants.rests.longRestHPRecovery = 1;
      const hpAttr = new Roll20Object('attribute', { current: 30 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(30);
      expect(reporter.errors).to.have.lengthOf(1);
    });

    it('dealsWithMissingCurrent', function () {
      state.config.variants.rests.longRestHPRecovery = 0.5;
      const hpAttr = new Roll20Object('attribute', { max: 30 });
      roll20.getAttrObjectByName.withArgs(char.id, 'HP').returns(hpAttr);
      restManager.recoverHP(char);
      expect(hpAttr.props.current).to.equal(15);
    });
  });

  describe('recoverHD', function () {
    it('recoversForHalfHD', function () {
      state.config.variants.rests.longRestHDRecovery = 0.5;
      const hdAttrs = [new Roll20Object('attribute', { name: 'hd_d8', current: 1, max: 5 })];
      roll20.findObjs.withArgs({ type: 'attribute', characterid: char.id }).returns(hdAttrs);
      restManager.recoverHD(char);
      expect(hdAttrs[0].props.current).to.equal(3);
    });

    it('ignoresHDForZeroMultiplier', function () {
      state.config.variants.rests.longRestHDRecovery = 0;
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
      state.config.variants.rests.longRestHDRecovery = 1;
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
