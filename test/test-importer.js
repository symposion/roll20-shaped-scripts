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
const Importer = require('../lib/modules/importer');
const cp = require('./dummy-command-parser');

describe('importer', function () {
  let roll20;
  let importer;

  beforeEach(function () {
    roll20 = new Roll20();
    importer = new Importer({
      roll20,
      reporter: new Reporter(),
      logger,
    });
    importer.configure(cp, null, { registerEventHandler: _.noop });
  });

  describe('fixRoll20Brokenness', function () {
    it('debrokens', function () {
      sinon.stub(roll20);
      const attributes = [
        new Roll20Object('attribute', { name: 'foo', current: 1 }),
        new Roll20Object('attribute', { name: 'foo', max: 2 }),
        new Roll20Object('attribute', { name: 'bar', current: 1, max: 2 }),
        new Roll20Object('attribute', { name: 'blort', current: 1 }),
        new Roll20Object('attribute', { name: 'wibble', max: 1 }),
      ];
      let removed = false;
      attributes[1].remove = function remove() {
        removed = true;
      };
      roll20.findObjs.returns(attributes);
      importer.fixRoll20Brokenness(new Roll20Object('character'), { name: 'Char' });
      expect(removed).to.equal(true);
      expect(attributes[0].props).to.have.property('current', 1);
      expect(attributes[0].props).to.have.property('max', 2);
    });
  });
});
