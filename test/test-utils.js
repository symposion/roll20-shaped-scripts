'use strict';

/* globals describe: false, it:false */
const expect = require('chai').expect;
const Utils = require('../lib/utils');

describe('utils', function () {
  describe('#deepExtend', function () {
    it('parse options correctly', function () {
      const result = Utils.deepExtend({ foo: 'bar', blort: ['wibble'] }, {
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
      const result = Utils.deepExtend({ foo: ['one', 'two'] }, { foo: [undefined, undefined, 'three'] });
      expect(result).to.deep.equal({ foo: ['one', 'two', 'three'] });
    });
  });

  describe('#createObjectFromPath', function () {
    it('create from path correctly', function () {
      const result = Utils.createObjectFromPath('foo.bar[1].blort[2]', 'testVal');
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

      expect(Utils.flattenObject(input)).to.deep.equal({
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
      expect(Utils.versionCompare('1.2.2', '2.2.2')).to.be.below(0);
      expect(Utils.versionCompare('10.2.2', '2.2.2')).to.be.above(0);
      expect(Utils.versionCompare('1.2.20', '1.1.21')).to.be.above(0);
      expect(Utils.versionCompare('1.2.2', '1.2.2')).to.equal(0);
      expect(Utils.versionCompare('1.20.2', '1.19.0')).to.be.above(0);
      expect(Utils.versionCompare(undefined, undefined)).to.equal(0);
      expect(Utils.versionCompare(undefined, '9.2.2')).to.equal(-1);
    });
  });

  describe('combine', function () {
    it('combines correctly', function () {
      expect(Utils.combine([1, 2, 3, 4])).to.deep.equal([
        '1',
        '1;2',
        '1;2;3',
        '1;2;3;4',
        '1;2;4',
        '1;3',
        '1;3;4',
        '1;4',
        '2',
        '2;3',
        '2;3;4',
        '2;4',
        '3',
        '3;4',
        '4',
      ]);
    });
  });

  describe('cartesianProductOf', function () {
    it('combined correctly', function () {
      expect(Utils.cartesianProductOf([1, 2], [3, 4, 5], [6, 7])).to.deep.equal([
        [1, 3, 6],
        [1, 3, 7],
        [1, 4, 6],
        [1, 4, 7],
        [1, 5, 6],
        [1, 5, 7],
        [2, 3, 6],
        [2, 3, 7],
        [2, 4, 6],
        [2, 4, 7],
        [2, 5, 6],
        [2, 5, 7],
      ]);
      expect(Utils.cartesianProductOf([], [1, 2], [3])).to.deep.equal([]);
    });
  });
});
