/* globals describe: false, it:false */
'use strict';
const expect = require('chai').expect;
const Migrator = require('../lib/migrator.js');
const dl = require('./dummy-logger');


describe('Migrator', function () {
  it('fails for missing version', function () {
    const mig = new Migrator();
    const config = { foo: 'bar' };
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
});
