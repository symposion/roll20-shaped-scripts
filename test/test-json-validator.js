'use strict';


/* globals describe: false, it:false */
const expect = require('chai').expect;
const JSONValidator = require('../lib/json-validator');
const spec = require('../resources/mmFormatSpec.json');
const data = require('../samples/monsterSample.json');
const glob = require('glob');
const fs = require('fs');

describe('json-validator', function () {
  const jv = new JSONValidator(spec);

  it('validates correctly', function () {
    expect(jv.validate(data)).to.deep.equal({});
  });


  glob.sync('../roll20/data/monsterSourceFiles/*.json').forEach(function (jsonFile) {
    const monsters = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    it(`validates ${jsonFile} correctly`, function () {
      expect(jv.validate(monsters)).to.deep.equal({});
    });
  });
});
