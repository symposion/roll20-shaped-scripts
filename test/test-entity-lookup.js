'use strict';

/* globals describe: false, it:false, before:false, after:false */
const expect = require('chai').expect;
const EntityLookup = require('../lib/entity-lookup');
const JSONValidator = require('../lib/json-validator');
const spec = require('../resources/mmFormatSpec.json');
const glob = require('glob');
const fs = require('fs');
const sinon = require('sinon');
const SpellManager = require('../lib/modules/spell-manager');
const EntityCriteriaCollector = require('../lib/entity-criteria-collector');
const ShapedConfig = require('../lib/shaped-config');
const logger = require('./dummy-logger');
const _ = require('underscore');

class DummyResultReporter {
  constructor() {
    this.results = {};
  }

  report(result) {
    this.results[result.entityGroupName] = result;
  }
}

describe('entity-lookup', function () {
  const spell1 = { name: 'spell1' };
  const spell2 = { name: 'spell2' };


  describe('#lookupEntity', function () {
    const el = new EntityLookup(logger);
    el.configureEntity('spells', []);
    el.configureEntity('monsters', []);
    el.addEntities({ version: '0.2', spells: [spell1, spell2] });
    it('finds entity by name', function () {
      expect(el.findEntity('spells', 'SPell1')).to.deep.equal(spell1);
    });


    it('no match with bad whitespace', function () {
      expect(el.findEntity('spells', 'spel l2')).to.be.undefined;
    });

    it('matches ignoring whitespace', function () {
      expect(el.findEntity('spells', 'spel l2', true)).to.deep.equal(spell2);
    });
  });


  describe('#entitySearch', function () {
    const el = new EntityLookup(logger);
    el.configureEntity('spells');
    el.addEntities({
      spells: [
        {
          name: 'spell1',
          attribute: 'att1',
          multiAttribute: 'val1, val2',
          boolVal: true,
          intVal: 1,
          arrayVal: ['one', 'two', 'three'],
        },
        {
          name: 'spell2',
          attribute: 'att2',
          multiAttribute: 'val3, val2',
          boolVal: false,
          intVal: 10,
        },
      ],
    });

    it('should filter entities in search correctly', function () {
      let results = el.searchEntities('spells', { multiAttribute: 'val2' });
      expect(results).to.have.lengthOf(2);
      results = el.searchEntities('spells', { multiAttribute: 'val2', attribute: 'att1' });
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property('name', 'spell1');
    });

    it('should filter by boolean properly', function () {
      let results = el.searchEntities('spells', { boolVal: true });
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property('name', 'spell1');
      results = el.searchEntities('spells', { boolVal: false });
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property('name', 'spell2');
    });

    it('should filter by integer properly', function () {
      const results = el.searchEntities('spells', { intVal: 1 });
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property('name', 'spell1');
    });

    it('should filter by array properly', function () {
      const results = el.searchEntities('spells', { arrayVal: ['one'] });
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property('name', 'spell1');
    });

    it('should return empty for unknown properties', function () {
      expect(el.searchEntities('spells', 'fooVal')).to.have.lengthOf(0);
    });
  });

  describe('dependencies', function () {
    let clock;
    before(function () {
      clock = sinon.useFakeTimers();
    });

    it('fails for unmet dependency', function () {
      const el = new EntityLookup(logger);
      const rr = new DummyResultReporter();

      el.configureEntity('spells');
      el.addEntities({ version: '1.0', name: 'derivative', spells: [], dependencies: 'base' }, rr);
      expect(rr.results).to.be.empty;
      clock.tick(10001);
      expect(rr.results.derivative.errors).to.deep.equal([
        {
          entity: 'Missing dependencies',
          errors: [
            'Entity group is missing dependencies [base]',
          ],
        },
      ]);
    });

    it('works for met dependency', function () {
      const el = new EntityLookup(logger);
      const rr = new DummyResultReporter();
      el.configureEntity('spells');
      el.addEntities({ version: '1.0', name: 'derivative', spells: [], dependencies: 'base' }, rr);
      expect(rr.results).to.be.empty;
      el.addEntities({ version: '1.0', name: 'base', spells: [] }, rr);
      expect(rr.results).to.have.property('base');
      expect(rr.results).to.have.property('derivative');
      expect(rr.results.base.errors).to.be.empty;
      expect(rr.results.derivative.errors).to.be.empty;
    });

    after(function () {
      clock.restore();
    });
  });

  describe('functional test', function () {

    if (process.env.CI) {
      return;
    }

    const el = new EntityLookup(logger);
    const jv = new JSONValidator(spec);
    const spellListGrouper = SpellManager.getSpellListGrouper();
    const spellCriteria = new EntityCriteriaCollector([
      { name: 'lists', buildListEntry: spellListGrouper.buildListEntry },
      { name: 'school' },
      { name: 'level', validator: ShapedConfig.integerValidator },
    ], logger, el, 'spells');

    el.configureEntity('spells', [SpellManager.getSpellListEntityUpdater(), spellCriteria.getEntityProcessor()],
      EntityLookup.getVersionChecker('2.0.0', 'spells'));
    el.configureEntity('monsters', [
      EntityLookup.jsonValidatorAsEntityProcessor(jv, ['source']),
    ], EntityLookup.jsonValidatorAsVersionChecker(jv));
    el.configureEntity('classes', [SpellManager.getSpellDenormaliser(), spellListGrouper.entityProcessor],
      EntityLookup.getVersionChecker('2.0.0', 'classes'));

    let jsonFiles = glob.sync('../5eshapedscriptdata/sources/{public,private}/*.json');
    expect(jsonFiles).to.not.be.empty;
    const phb = jsonFiles.find(file => file.indexOf('PlayersHandbook') !== -1);
    const srd = jsonFiles.find(file => file.indexOf('SRD') !== -1);
    jsonFiles = _.without(jsonFiles, phb, srd);
    jsonFiles.unshift(phb);
    jsonFiles.unshift(srd);

    jsonFiles.forEach(function (jsonFile) {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const name = jsonFile.replace(/.*\/([^.]+)\.json/, '$1');
      it(`loads ${name} correctly`, function () {
        const rr = new DummyResultReporter();

        data.name = name;
        el.addEntities(data, rr);
        const results = rr.results[name];
        if (data.spells) {
          expect(results.spells.withErrors).to.be.empty;
          expect(results.errors).to.be.empty;
          expect(results.spells.added.length + results.spells.patched.length).to.equal(data.spells.length);
        }
        if (data.monsters) {
          expect(results.monsters.deleted).to.be.empty;
          expect(results.monsters.withErrors).to.be.empty;
          expect(results.monsters.added.length + results.monsters.patched.length).to.equal(data.monsters.length);
        }
      });
    });
  });
});

