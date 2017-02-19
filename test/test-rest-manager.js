/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const _ = require('underscore');
const Roll20 = require('roll20-wrapper');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Roll20Object = require('./dummy-roll20-object');
const RestManager = require('../lib/rest-manager');
const cp = require('./dummy-command-parser');

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

  beforeEach(function () {
    roll20 = new Roll20();
    restManager = new RestManager();
    sinon.stub(roll20);
    char = new Roll20Object('character', { name: 'character' });
    restManager.configure(roll20, null, logger, null, cp);
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
});
