'use strict';


/* globals describe: false, it:false, before:false */
const expect = require('chai').expect;
const JSONValidator = require('../lib/json-validator');
const spec = require('../resources/mmFormatSpec.json');
const data = require('../samples/monsterSample.json');
const glob = require('glob');
const fs = require('fs');
const _ = require('underscore');

describe('json-validator', function () {
  if (process.env.CI) {
    return;
  }


  const jv = new JSONValidator(spec);

  it('validates correctly', function () {
    expect(jv.validate(data)).to.deep.equal({});
  });


  const monsterFiles = glob.sync('../5eshapedscriptdata/sources/{public,private}/*.json')
    .filter(file => file.indexOf('MonsterManual') === -1);
  expect(monsterFiles).to.not.be.empty;
  monsterFiles.forEach(function (jsonFile) {
    const monsters = _.pick(JSON.parse(fs.readFileSync(jsonFile, 'utf8')), 'monsters', 'version');
    if (monsters.monsters) {
      it(`validates ${jsonFile} correctly`, function () {
        expect(jv.validate(monsters)).to.deep.equal({});
      });
    }
  });
});
