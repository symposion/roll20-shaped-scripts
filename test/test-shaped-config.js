/* globals describe: false, it:false, beforeEach:false */
'use strict';
const expect = require('chai').expect;
const ShapedConfig = require('../lib/shaped-config.js');
const dl = require('./dummy-logger');
const Reporter = require('./dummy-reporter');
const cp = require('./dummy-command-parser');


describe('ShapedConfig', function () {
  let sc;
  let myState;

  beforeEach(function () {
    myState = {
      version: 0.1,
      config: {},
    };
    sc = new ShapedConfig({
      reporter: new Reporter(),
      logger: dl,
      myState,
    });
  });

  it('upgrades old Shaped Config correctly', function () {
    myState.config = {
      genderPronouns: [
        'someStuff',
      ],
    };
    sc.configure(cp);
    sc.upgradeConfig();

    expect(myState.config.genderPronouns).to.have.lengthOf(3);
  });

  it('upgrades recent Shaped Config correctly', function () {
    myState.config = {
      newCharSettings: {
        savingThrowsHalfProf: false,
        mediumArmorMaxDex: 2,
      },
    };
    sc.upgradeConfig();


    const result = myState.config;
    expect(result.newCharSettings).to.have.property('houserules');
    expect(result.newCharSettings.houserules.saves).to.have.property('savingThrowsHalfProf', false);
    expect(result.newCharSettings.houserules).to.have.property('mediumArmorMaxDex', 2);
    expect(result.newCharSettings).not.to.have.property('savingThrowsHalfProf');
  });
});
