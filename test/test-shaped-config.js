/* globals describe: false, it:false */
'use strict';
const expect = require('chai').expect;
const ShapedConfig = require('../lib/shaped-config.js');
const dl = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const cp = require('./dummy-command-parser');


describe('ShapedConfig', function () {
  it('upgrades old Shaped Config correctly', function () {
    const state = {
      version: 0.1,
      config: {
        genderPronouns: [
          'someStuff',
        ],
      },
    };
    const sc = new ShapedConfig();
    sc.configure(null, new Reporter(), dl, state, cp);
    sc.upgradeConfig();

    expect(state.config.genderPronouns).to.have.lengthOf(3);
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
    const sc = new ShapedConfig();
    sc.configure(null, new Reporter(), dl, config, cp);
    sc.upgradeConfig();


    const result = config.config;
    expect(result.newCharSettings).to.have.property('houserules');
    expect(result.newCharSettings.houserules.saves).to.have.property('savingThrowsHalfProf', false);
    expect(result.newCharSettings.houserules).to.have.property('mediumArmorMaxDex', 2);
    expect(result.newCharSettings).not.to.have.property('savingThrowsHalfProf');
  });
});
