'use strict';
const _ = require('underscore');

const levelStrings = ['Cantrips ', '1st level ', '2nd level ', '3rd level '];
_.each(_.range(4, 10), level => (levelStrings[level] = `${level}th level `));

const spellcastingHandler = {
  splitRegex: /(Cantrips|(?:1st|2nd|3rd|[4-9]th)\s*level)\.?\s*(?:\(([^)]+)\))?\s*:/i,

  makeLevelDetailsObject(match) {
    const levelMatch = match[1].match(/\d/);
    return {
      level: levelMatch ? parseInt(levelMatch[0], 10) : 0,
      slots: match[2],
    };
  },

  setLevelDetailsString(levelDetails) {
    levelDetails.newText = `${levelStrings[levelDetails.level]}(${levelDetails.slots}): `;
    levelDetails.newText += levelDetails.spells.join(', ');
  },

};

const innateHandler = {
  splitRegex: /(At\s?will|\d\s?\/\s?(?:day|week|rest)(?:\s?each)?)\s?:/i,

  makeLevelDetailsObject(match) {
    return {
      uses: match[1],
    };
  },

  setLevelDetailsString(levelDetails) {
    levelDetails.newText = levelDetails.uses;
    levelDetails.newText += ': ';
    levelDetails.newText += levelDetails.spells.join(', ');
  },

};


function processSpellcastingTrait(monster, traitName, traitHandler, entityLookup) {
  const trait = _.findWhere(monster.traits, { name: traitName });
  if (trait) {
    let spellList = trait.text.substring(trait.text.indexOf(':') + 1).replace('\n', ' ');
    const castingDetails = trait.text.substring(0, trait.text.indexOf(':'));
    const levelDetails = [];
    let match;
    while ((match = traitHandler.splitRegex.exec(spellList)) !== null) {
      if (_.last(levelDetails)) {
        _.last(levelDetails).spells = spellList.slice(0, match.index);
      }
      levelDetails.push(traitHandler.makeLevelDetailsObject(match));
      spellList = spellList.slice(match.index + match[0].length);
    }
    if (_.last(levelDetails)) {
      _.last(levelDetails).spells = spellList;
    }

    let hasCastBeforeCombat = false;
    const spellDetailsByLevel = _.chain(levelDetails)
      .each((perLevelDetails) => {
        perLevelDetails.spells =
          _.chain(perLevelDetails.spells.replace(',*', '*,').split(','))
            .map(_.partial(_.result, _, 'trim'))
            .map((spellName) => {
              const spellNameMatch = spellName.match(/([^(*]+)(?:\(([^)]+)\))?(\*)?/);
              hasCastBeforeCombat = hasCastBeforeCombat || !!spellNameMatch[3];
              return {
                name: spellNameMatch[1].trim(),
                restriction: spellNameMatch[2],
                castBeforeCombat: !!spellNameMatch[3],
                toString() {
                  return this.name +
                    (this.restriction ? ` (${this.restriction})` : '') +
                    (this.castBeforeCombat ? '*' : '');
                },
                toSpellArrayItem() {
                  return this.name;
                },
              };
            })
            .each((spell) => {
              spell.object = entityLookup.findEntity('spells', spell.name, true);
              if (spell.object) {
                spell.name = spell.object.name;
                spell.toSpellArrayItem = function toSpellArrayItem() {
                  return this.object;
                };
              }
            })
            .value();
      })
      .each(traitHandler.setLevelDetailsString)
      .value();


    trait.text = `${castingDetails}:\n${_.pluck(spellDetailsByLevel, 'newText').join('\n')}`;
    if (hasCastBeforeCombat) {
      trait.text += `\n* The ${monster.name.toLowerCase()} casts these spells on itself before combat.`;
    }
    const spells = _.chain(spellDetailsByLevel)
      .pluck('spells')
      .flatten()
      .map(_.partial(_.result, _, 'toSpellArrayItem'))
      .union(monster.spells ? monster.spells : [])
      .sortBy('name')
      .sortBy('level')
      .value();

    if (!_.isEmpty(spells)) {
      monster.spells = spells;
    }
  }
  return [];
}


module.exports = function mpp(monsters, entityLookup) {
  _.each(monsters, (monster) => {
    processSpellcastingTrait(monster, 'Spellcasting', spellcastingHandler, entityLookup);
    processSpellcastingTrait(monster, 'Innate Spellcasting', innateHandler, entityLookup);
  });
};

