'use strict';

const fs = require('fs');
const parseModule = require('../lib/parser');
const sanitise = require('../lib/sanitise');
const mpp = require('../lib/monster-post-processor');
const EntityLookup = require('../lib/entity-lookup');
const formatSpec = require('../resources/mmFormatSpec.json');
const logger = require('../test/dummy-logger');

const el = new EntityLookup();
el.configureEntity('spells', [el.getMonsterSpellUpdater()], EntityLookup.getVersionChecker('0.2.1'));

const parser = parseModule.getParser(formatSpec, logger);
try {
  const json = parser.parse(sanitise(fs.readFileSync('./tob.txt', 'utf8'), logger, true));
  mpp(json.monsters, el);
  json.monsters.forEach((monster) => {
    if (monster.spells) {
      monster.spells = monster.spells.join(', ');
    }
  });
  fs.writeFileSync('./tob.json', JSON.stringify(json, null, 2), 'utf8');
}
catch (e) {
  /* eslint-disable no-console */
  console.log(e);
  console.log(e.message);
  console.log(e.statblock);
  /* eslint-enable no-console */
}
