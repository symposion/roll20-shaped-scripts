/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
require('chai').should();
const expect = require('chai').expect;
const Roll20 = require('roll20-wrapper');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const Roll20Object = require('./dummy-roll20-object');
const UsesManager = require('../lib/modules/uses-manager');
const cp = require('./dummy-command-parser');
const Reporter = require('./dummy-reporter');
const _ = require('underscore');


describe('uses-manager', function () {
  let usesManager;
  let roll20;
  let char;
  let reporter;

  beforeEach(function () {
    roll20 = new Roll20();
    reporter = new Reporter();
    usesManager = new UsesManager();
    sinon.stub(roll20);
    char = new Roll20Object('character', { name: 'character' });
    usesManager.configure(roll20, reporter, logger, { config: { sheetEnhancements: { autoTraits: true } } }, cp,
      { registerChatListener: _.noop });
  });

  describe('handleUses', function () {
    it('reports error for bad per_uses value', function () {
      usesManager.handleUses({ character: char, repeatingItem: 'repItem', perUse: 'Fibble' });
      expect(reporter.errors).to.have.lengthOf(1);
    });

    it('defaults to 1 for no per_use', function () {
      const attr = new Roll20Object('attribute', { name: 'uses', max: 3, current: 1 });
      roll20.getAttrObjectByName.returns(attr);
      usesManager.handleUses({ character: char, repeatingItem: 'repItem' });
      expect(attr.props).to.have.property('current', 0);
    });

    it('defaults to 1 for 0 per_use', function () {
      const attr = new Roll20Object('attribute', { name: 'uses', max: 3, current: 1 });
      roll20.getAttrObjectByName.returns(attr);
      usesManager.handleUses({ character: char, repeatingItem: 'repItem', perUse: 0 });
      expect(attr.props).to.have.property('current', 0);
    });

    it('decrements multiple for peruse > 1', function () {
      const attr = new Roll20Object('attribute', { name: 'uses', max: 3, current: 2 });
      roll20.getAttrObjectByName.returns(attr);
      usesManager.handleUses({ character: char, repeatingItem: 'repItem', perUse: 2 });
      expect(attr.props).to.have.property('current', 0);
    });


    it('fails for insufficient uses', function () {
      const attr = new Roll20Object('attribute', { name: 'uses', max: 3, current: 1 });
      roll20.getAttrObjectByName.returns(attr);
      usesManager.handleUses({ character: char, repeatingItem: 'repItem', perUse: 2 });
      expect(attr.props).to.have.property('current', 1);
      expect(reporter.messages).to.have.lengthOf(1);
    });

    it('ignores traits with no max uses', function () {
      const attr = new Roll20Object('attribute', { name: 'uses', current: 1 });
      roll20.getAttrObjectByName.returns(attr);
      usesManager.handleUses({ character: char, repeatingItem: 'repItem', perUse: 2 });
      expect(attr.props).to.have.property('current', 1);
      expect(reporter.messages).to.have.lengthOf(0);
    });
  });
});
