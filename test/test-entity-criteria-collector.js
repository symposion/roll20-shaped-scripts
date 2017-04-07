/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
const expect = require('chai').expect;
const EntityCriteriaCollector = require('../lib/entity-criteria-collector');
const logger = require('./dummy-logger');
const EntityLookup = require('../lib/entity-lookup');
const _ = require('underscore');

describe('entity-criteria-collector', function () {
  let ecc;
  describe('test', function () {
    beforeEach(function () {
      const el = new EntityLookup(logger);
      ecc = new EntityCriteriaCollector([{ name: 'propTwo' }, { name: 'propOne' }], logger, el, 'spells');
      el.configureEntity('spells', [ecc.getEntityProcessor()], _.constant(true));
      el.addEntities({
        version: '1.0',
        spells: [
          { name: 'spell1', propOne: 'valOne', propTwo: 'valOne' },
          { name: 'spell2', propOne: 'valTwo', propTwo: 'valOne' },
          { name: 'spell3', propTwo: 'valTwo' },
        ],
      });
    });

    it('works', function () {
      expect(ecc.criteria).to.deep.equal([
        {
          name: 'propTwo',
          displayName: 'propTwo',
          values: [
            'valOne',
            'valTwo',
          ],
        },
        {
          name: 'propOne',
          displayName: 'propOne',
          values: [
            'valOne',
            'valTwo',
          ],
        },
      ]);
      expect(
        ecc.getCriteriaToDisplay({ propOne: ['valOne'] })).to.deep
        .equal([
          {
            name: 'propTwo',
            displayName: 'propTwo',
            values: ['valOne'],
          },
          {
            name: 'propOne',
            displayName: 'propOne',
            values: ['valOne', 'valTwo'],
          }
        ]);
    });

    it('maintains original sort order', function () {
      expect(
        ecc.getCriteriaToDisplay({ propOne: ['valTwo', 'valOne'] })).to.deep
        .equal([
          {
            name: 'propTwo',
            displayName: 'propTwo',
            values: ['valOne'],
          },
          {
            name: 'propOne',
            displayName: 'propOne',
            values: ['valOne', 'valTwo'],
          }
        ]);
    });
  });

  describe('test with integers', function () {
    beforeEach(function () {
      const el = new EntityLookup(logger);
      ecc = new EntityCriteriaCollector([{ name: 'propTwo' }, { name: 'propOne' }], logger, el, 'spells');
      el.configureEntity('spells', [ecc.getEntityProcessor()], _.constant(true));
      el.addEntities({
        version: '1.0',
        spells: [
          { name: 'spell1', propOne: 3, propTwo: 1 },
          { name: 'spell2', propOne: 4, propTwo: 1 },
          { name: 'spell3', propTwo: 2 },
        ],
      });
    });

    it('matches integer criteria', function () {
      expect(ecc.getCriteriaToDisplay({ propOne: [3] })).to.deep.equal(
        [
          {
            name: 'propTwo',
            displayName: 'propTwo',
            values: [1],
          },
          {
            name: 'propOne',
            displayName: 'propOne',
            values: [3, 4],
          }
        ]);
    });
  });
});
