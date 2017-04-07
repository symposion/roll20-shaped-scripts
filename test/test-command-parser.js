/* globals describe: false, it:false */
'use strict';

const expect = require('chai').expect;
const cp = require('../lib/command-parser');
const sinon = require('sinon');
const Roll20 = require('roll20-wrapper');
const _ = require('underscore');
const logger = require('./dummy-logger');

function testValidator(value) {
  return {
    converted: value,
    valid: true,
  };
}

describe('command-parser', function () {
  const roll20 = sinon.createStubInstance(Roll20);
  roll20.playerIsGM.withArgs(sinon.match.any).returns(true);

  describe('#command', function () {
    it('parse options correctly', function () {
      let result = {};
      cp('shaped', roll20, null, { registerEventHandler: _.noop }, 1, logger)
        .addCommand('config', function (object) {
          result = object;
        })
        .option('foo', {
          subOne: [
            {
              tinky: testValidator,
              blort: testValidator,
            },
          ],
          subTwo: testValidator,
          subThree: {
            wibble: testValidator,
            flurb: [
              testValidator,
            ],
          },
        })
        .processCommand({ content: '!shaped-config --foo.subThree.flurb[1] splat', type: 'api', playerid: 1 });
      const expected = {
        foo: {
          subThree: {
            flurb: [],
          },
        },
        playerId: 1,
      };
      expected.foo.subThree.flurb[1] = 'splat';
      expect(result).to.deep.equal(expected);
    });
  });

  describe('#optionLookup', function () {
    const lookup = {
      key1: 'value1',
      key2: 'value2',
    };
    let result = {};
    const myCp = cp('shaped', roll20, null, { registerEventHandler: _.noop }, 1, logger)
      .addCommand('stuff', function (object) {
        result = object;
      })
      .optionLookup('spells', function (option) {
        return lookup[option];
      });

    it('handles comma-sep options', function () {
      myCp.processCommand({ content: '!shaped-stuff --key1, key2', type: 'api', playerid: 1 });
      expect(result).to.deep.equal({
        playerId: 1,
        spells: ['value1', 'value2'],
      });
    });

    it('handles partial error with comma-sep options', function () {
      expect(myCp.processCommand.bind(myCp, { content: '!shaped-stuff --key1, key4', type: 'api' }))
        .to.throw('Unrecognised item key4 for option group spells');
    });
  });

  describe('#missingParam', function () {
    it('accepts supplied required param', function () {
      let result = {};
      const myCp = cp('shaped', roll20, null, { registerEventHandler: _.noop }, 1, logger)
        .addCommand('stuff', function (object) {
          result = object;
        })
        .option('test', testValidator, true);

      myCp.processCommand({ content: '!shaped-stuff --test', type: 'api', playerid: 1 });
      expect(result).to.deep.equal({ test: true, playerId: 1 });
    });
  });
});
