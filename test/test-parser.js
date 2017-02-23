'use strict';

/* globals describe: false, before:false, it:false */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
require('chai').should();
const Promise = require('bluebird'); // jshint ignore:line
const fs = require('fs');

const glob = require('glob');
const parseModule = require('../lib/parser');
const logger = require('./dummy-logger');
const sanitise = require('../lib/sanitise');

Promise.promisifyAll(fs);

/**
 * @name readFileAsync
 * @memberOf fs
 */

/**
 * @name sync
 * @memberOf glob
 */


describe('Monster Manual tests', function () {
  let parser;

  before(function () {
    return fs.readFileAsync('./resources/mmFormatSpec.json', 'utf-8')
      .then(function (specText) {
        const parsed = JSON.parse(specText);
        parser = parseModule.getParser(parsed, logger);
      });
  });


  const files = glob.sync('./test/data/*.txt');
  files.forEach(function (file) {
    it(`correctly parses ${file.replace(/\.txt$/, '')}`, function () {
      return Promise.join(runTestForFile(parser, file),
        getExpectedOutputForFile(file),
        function (test, expected) {
          if (!expected) {
            return fs.writeFileSync(file.replace(/\.txt$/, '.json'), JSON.stringify(test, undefined, 2), 'utf8');
          }
          // noinspection JSUnresolvedVariable
          return test.should.deep.equal(expected);
        });
    });
  });
});


function runTestForFile(parser, file) {
  return fs.readFileAsync(file, 'utf-8').then(function (statblockText) {
    return runParse(parser, statblockText);
  });
}

function getExpectedOutputForFile(file) {
  const filename = file.replace(/\.txt$/, '.json');
  return fs.readFileAsync(filename, 'utf-8')
    .catch(() => null)
    .then(JSON.parse);
}


function runParse(parser, statBlockText) {
  try {
    return parser.parse(sanitise(statBlockText, logger));
  }
  catch (e) {
    console.log(e.stack);
    return e;
  }
}
