/* globals describe: false, it:false */
'use strict';
const expect = require('chai').expect;
const Migrator = require('../lib/migrations.js');
const dl = require('./dummy-logger');


describe('Migrator', function () {
  it('fails for missing version', function () {
    const mig = new Migrator();
    const config = {};
    mig.nextVersion().addProperty('test', 'testVal');

    expect(function () {
      mig.migrateConfig(config, dl);
    }).to.throw(Error);
  });

  it('migrates correctly', function () {
    const mig = new Migrator();
    const config = {
      version: 0.1,
      foo: 'foo',
      bar: 'bar',
      blort: {
        wibble: 'test',
        wibblePrime: 'test2',
      },
    };
    mig.nextVersion()
      .addProperty('newProp', 'newValue')
      .moveProperty('blort.wibble', 'newChild.newGrandChild')
      .nextVersion()
      .moveProperty('foo', 'blort.foo');

    expect(mig.migrateConfig(config, dl)).to.deep.equal({
      version: 0.3,
      bar: 'bar',
      blort: {
        wibblePrime: 'test2',
        foo: 'foo',
      },
      newProp: 'newValue',
      newChild: {
        newGrandChild: 'test',
      },
    });
  });

  it('upgrades old Shaped Config correctly', function () {
    const state = {
      version: 0.1,
      config: {
        genderPronouns: [
          'someStuff',
        ],
      },
    };

    expect(Migrator.migrateShapedConfig(state, dl).config.genderPronouns).to.have.lengthOf(3);
  });

  it('upgrades recent Shaped Config correctly', function () {
    const config = {
      version: 0.1,
      config: {
        newCharSettings: {
          savingThrowsHalfProf: false,
          mediumArmorMaxDex: 2,
        },
      },
    };

    const result = Migrator.migrateShapedConfig(config, dl).config;
    expect(result.newCharSettings).to.have.property('houserules');
    expect(result.newCharSettings.houserules).to.have.property('savingThrowsHalfProf', false);
    expect(result.newCharSettings.houserules).to.have.property('mediumArmorMaxDex', 2);
    expect(result.newCharSettings).not.to.have.property('savingThrowsHalfProf');
  });
})
;
