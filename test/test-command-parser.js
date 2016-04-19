/* globals describe: false, it:false */
var expect = require('chai').expect;
var cp = require('../lib/command-parser');

var testValidator = function (value) {
  'use strict';
  return {
    converted: value,
    valid: true
  };
};

describe('command-parser', function () {
  'use strict';

  describe('#command', function () {

    it('parse options correctly', function () {
      var result = {};
      cp('shaped')
        .addCommand('config', function (object) {
          result = object;
        })
        .option('foo', {
          subOne: [
            {
              tinky: testValidator,
              blort: testValidator
            }
          ],
          subTwo: testValidator,
          subThree: {
            wibble: testValidator,
            flurb: [
              testValidator
            ]
          }
        })
        .end()
        .processCommand({ content: '!shaped-config --foo.subThree.flurb[1] splat', type: 'api' });
      var expected = {
        foo: {
          subThree: {
            flurb: []
          }
        },
        selected: undefined
      };
      expected.foo.subThree.flurb[1] = 'splat';
      expect(result).to.deep.equal(expected);
    });

  });

  describe('#optionLookup', function () {
    var lookup = {
      key1: 'value1',
      key2: 'value2'
    };
    var result = {};
    const myCp = cp('shaped')
      .addCommand('stuff', function (object) {
        result = object;
      })
      .optionLookup('spells', function (option) {
        return lookup[option];
      })
      .end();

    it('handles comma-sep options', function () {
      myCp.processCommand({ content: '!shaped-stuff --key1, key2', type: 'api' });
      expect(result).to.deep.equal({
        selected: undefined,
        spells: ['value1', 'value2']
      });
    });

    it('handles partial error with comma-sep options', function () {
      expect(myCp.processCommand.bind(myCp, { content: '!shaped-stuff --key1, key4', type: 'api' }))
        .to.throw('Unrecognised item key4 for option group spells');
    });

  });
});
