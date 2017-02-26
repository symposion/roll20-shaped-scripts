'use strict';

/* globals describe: false, it:false */
const expect = require('chai').expect;
const utils = require('../lib/utils');

describe('utils', function () {
  describe('#deepExtend', function () {
    it('parse options correctly', function () {
      const result = utils.deepExtend({ foo: 'bar', blort: ['wibble'] }, {
        foo: 'barprime',
        blort: [undefined, 'bumble'],
        newVal: { funky: 'raw' },
      });
      expect(result).to.deep.equal({
        blort: [
          'wibble',
          'bumble',
        ],
        foo: 'barprime',
        newVal: {
          funky: 'raw',
        },
      });
    });


    it('should extend arrays properly', function () {
      const result = utils.deepExtend({ foo: ['one', 'two'] }, { foo: [undefined, undefined, 'three'] });
      expect(result).to.deep.equal({ foo: ['one', 'two', 'three'] });
    });
  });

  describe('#createObjectFromPath', function () {
    it('create from path correctly', function () {
      const result = utils.createObjectFromPath('foo.bar[1].blort[2]', 'testVal');
      const expected = {
        foo: {
          bar: [],
        },
      };
      expected.foo.bar[1] = {
        blort: [],
      };
      expected.foo.bar[1].blort[2] = 'testVal';
      expect(result).to.deep.equal(expected);
    });
  });

  describe('flattenObject', function () {
    it('flattens object correctly', function () {
      const input = {
        key1: 'value1',
        key2: 'value2',
        key3: {
          innerKey1: 'innerValue1',
          innerKey2: {
            innermostKey1: 'innermostValue1',
            innermostKey2: 'innermostValue2',
          },
        },
        key4: 'value4',
        key5: {
          innerKey3: 'innerValue3',
        },
        key6: 'value6',
      };

      expect(utils.flattenObject(input)).to.deep.equal({
        key1: 'value1',
        key2: 'value2',
        innerKey1: 'innerValue1',
        innermostKey1: 'innermostValue1',
        innermostKey2: 'innermostValue2',
        key4: 'value4',
        innerKey3: 'innerValue3',
        key6: 'value6',
      });
    });
  });

  describe('versionCompare', function () {
    it('checks versions correctly', function () {
      expect(utils.versionCompare('1.2.2', '2.2.2')).to.be.below(0);
      expect(utils.versionCompare('10.2.2', '2.2.2')).to.be.above(0);
      expect(utils.versionCompare('1.2.20', '1.1.21')).to.be.above(0);
      expect(utils.versionCompare('1.2.2', '1.2.2')).to.equal(0);
      expect(utils.versionCompare('1.20.2', '1.19.0')).to.be.above(0);
      expect(utils.versionCompare(undefined, undefined)).to.equal(0);
      expect(utils.versionCompare(undefined, '9.2.2')).to.equal(-1);
    });
  });
});
