'use strict';

/* globals describe: false, it:false, before:false */
require('chai').should();
const srdConverter = require('../lib/srd-converter');
const fs = require('fs');
const glob = require('glob');

describe('srd-converter', function () {
  describe('#convertMonster', function () {
    const fullObject = {
      name: 'Wobbler',
      traits: [
        { name: 'Trait One', recharge: '1/day', text: 'trait text blah blah\nblah' },
        { name: 'Trait Two', text: 'trait 2 text blah blah\nblah' },
      ],
      actions: [
        { name: 'Action One', recharge: '5-6', text: 'action text blah blah\nblah' },
        { name: 'Action Two', text: 'action 2 text blah blah\nblah' },
      ],
      reactions: [
        { name: 'Reaction One', recharge: '5-6', text: 'reaction text blah blah\nblah' },
        { name: 'Reaction Two', text: 'reaction 2 text blah blah\nblah' },
      ],
      legendaryPoints: 3,
      legendaryActions: [
        { name: 'Legendary Action One', cost: 1, text: 'legendary text blah blah\nblah' },
        { name: 'Legendary Action Two', cost: 2, text: 'legendary 2 text blah blah\nblah' },
      ],
    };

    const emptyObject = {
      name: 'Wobbler',
    };

    const emptyArrayObject = {
      name: 'Wobbler',
      traits: [],
      actions: [],
      reactions: [],
      legendaryActions: [],
    };

    const someMissing = {
      name: 'Wobbler',
      traits: [
        { name: 'Trait Two', text: 'trait 2 text blah blah\nblah' },
      ],
      actions: [
        { name: 'Action One', recharge: '5-6', text: 'action text blah blah\nblah' },
        { name: 'Action Two', text: 'action 2 text blah blah\nblah' },
      ],
    };


    it('correctly concatenates a full object', function () {
      // noinspection JSUnresolvedVariable
      const converted = srdConverter.convertMonster(fullObject);
      converted.should.have.property('content_srd',
        '\n Traits\n' +
        '**Trait One (1/day)**: trait text blah blah\nblah\n' +
        '**Trait Two**: trait 2 text blah blah\nblah\n' +
        '\n Actions\n' +
        '**Action One (5-6)**: action text blah blah\nblah\n' +
        '**Action Two**: action 2 text blah blah\nblah\n' +
        '\n Reactions\n' +
        '**Reaction One (5-6)**: reaction text blah blah\nblah\n' +
        '**Reaction Two**: reaction 2 text blah blah\nblah\n' +
        '\n Legendary Actions\n' +
        'The Wobbler can take 3 legendary actions, choosing from the options below. ' +
        'It can take only one legendary action at a time and only at the end of another creature\'s turn. ' +
        'The Wobbler regains spent legendary actions at the start of its turn.\n' +
        '**Legendary Action One**: legendary text blah blah\nblah\n' +
        '**Legendary Action Two (Costs 2 actions)**: legendary 2 text blah blah\nblah');

      converted.should.not.have.any.keys('traits', 'actions', 'reactions', 'legendaryActions', 'legendary_actions');
    });

    it('correctly adds extra fields', function () {
      // noinspection JSUnresolvedVariable
      const converted = srdConverter.convertMonster(fullObject);
      converted.should.have.property('is_npc', 1);
      converted.should.have.property('edit_mode', 0);
      converted.should.not.contain.any.keys('traits', 'actions', 'reactions', 'legendaryActions', 'legendary_actions');
    });

    it('correctly concatenates an empty object', function () {
      // noinspection JSUnresolvedVariable
      const converted = srdConverter.convertMonster(emptyObject);
      converted.should.have.property('content_srd', '');
      converted.should.not.contain.any.keys('traits', 'actions', 'reactions', 'legendaryActions', 'legendary_actions');
    });

    it('correctly concatenates an object with empty arrays', function () {
      // noinspection JSUnresolvedVariable
      const converted = srdConverter.convertMonster(emptyArrayObject);
      converted.should.have.property('content_srd', '');
      converted.should.not.have.any.keys('traits', 'actions', 'reactions', 'legendaryActions', 'legendary_actions');
    });

    it('correctly concatenates a medium object', function () {
      // noinspection JSUnresolvedVariable
      const converted = srdConverter.convertMonster(someMissing);
      converted.should.have.property('content_srd',
        '\n Traits\n' +
        '**Trait Two**: trait 2 text blah blah\nblah\n' +
        '\n Actions\n' +
        '**Action One (5-6)**: action text blah blah\nblah\n' +
        '**Action Two**: action 2 text blah blah\nblah');
      converted.should.not.have.any.keys('traits', 'actions', 'reactions', 'legendaryActions', 'legendary_actions');
    });
  });

  describe('#convertJson', function () {
    if (process.env.CI) {
      return;
    }

    const monsterFiles = glob.sync('../5eshapedscriptdata/sources/{public,private}/*.json');
    monsterFiles.should.not.be.empty;
    monsterFiles.forEach(function (jsonFile) {
      describe(`JSON file:  ${jsonFile}`, function () {
        const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        if (json.monsters) {
          json.monsters.forEach(function (monster) {
            it(`convert ${monster.name}`, function () {
              srdConverter.convertMonster(monster);
            });
          });
        }
        if (json.spells) {
          it('should parse spell correctly', function () {
            srdConverter.convertSpells(json.spells.filter(spell => !spell.newName), 'female');
          });
        }
      });
    });
  });
});
