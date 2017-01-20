'use strict';
const _ = require('underscore');

function getRenameMapper(newName, upperCaseValue) {
  return function renameMapper(key, value, output) {
    output[newName] = upperCaseValue && value ? value.toUpperCase() : value;
  };
}

function upperCaseMapper(key, value, output) {
  output[key] = value ? value.toUpperCase() : value;
}

function identityMapper(key, value, output) {
  output[key] = value;
}

function booleanMapper(key, value, output) {
  if (value) {
    output[key] = 'Yes';
  }
}

function durationMapper(key, value, output, spellObj) {
  let newDuration = spellObj.concentration ? 'CONCENTRATION_' : '';
  newDuration += value.toUpperCase().replace(/\s/g, '_');
  output[key] = newDuration;
}

function spellLevelMapper(key, value, output) {
  let spellLevel;
  if (value === 0) {
    spellLevel = 'CANTRIP';
  }
  else {
    switch (value % 10) {
      case 1:
        spellLevel = `${value}ST_LEVEL`;
        break;
      case 2:
        spellLevel = `${value}ND_LEVEL`;
        break;
      case 3:
        spellLevel = `${value}RD_LEVEL`;
        break;
      default:
        spellLevel = `${value}TH_LEVEL`;
        break;
    }
  }
  output.spell_level = spellLevel;
}

function camelCaseFixMapper(key, value, output) {
  const newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  output[newKey] = value;
}

function castingStatMapper(key, value, output) {
  if (value) {
    output.add_casting_modifier = 'Yes';
  }
}

function castingTimeMapper(key, value, output) {
  output.casting_time = value && value.toUpperCase().replace(/\s/g, '_');
}

function secondaryCastingStatMapper(key, value, output) {
  if (value) {
    output.add_second_casting_modifier = 'Yes';
  }
}

function componentMapper(key, value, output) {
  const components = _.chain(value)
    .omit('materialCost')
    .map((propValue, propName) => {
      if (propName !== 'materialMaterial') {
        return propName.toUpperCase().slice(0, 1);
      }

      output.materials = propValue;
      return null;
    })
    .compact()
    .value()
    .join('_');

  if (components) {
    output.components = `COMPONENTS_${components}`;
  }
}
const saveAttackMappings = {
  ability: getRenameMapper('saving_throw_vs_ability', true),
  type: identityMapper,
  damage: identityMapper,
  damageBonus: camelCaseFixMapper,
  damageType: camelCaseFixMapper,
  saveSuccess: getRenameMapper('saving_throw_success'),
  saveFailure: getRenameMapper('saving_throw_failure'),
  higherLevelDice: camelCaseFixMapper,
  higherLevelDie: camelCaseFixMapper,
  secondaryDamage: getRenameMapper('second_damage'),
  secondaryDamageBonus: getRenameMapper('second_damage_bonus'),
  secondaryDamageType: getRenameMapper('second_damage_type'),
  higherLevelSecondaryDice: getRenameMapper('second_higher_level_dice'),
  higherLevelSecondaryDie: getRenameMapper('second_higher_level_die'),
  condition: getRenameMapper('saving_throw_condition'),
  castingStat: castingStatMapper,
  secondaryCastingStat: secondaryCastingStatMapper,
};

function getObjectMapper(mappings) {
  return function objectMapper(key, value, output) {
    _.each(value, (propVal, propName) => {
      const mapper = mappings[propName];
      if (!mapper) {
        throw new Error('Unrecognised property when attempting to convert to srd format: ' +
          `[${propName}] ${JSON.stringify(output)}`);
      }
      mapper(propName, propVal, output, value);
    });
  };
}

const spellMapper = getObjectMapper({
  name: identityMapper,
  duration: durationMapper,
  level: spellLevelMapper,
  school: upperCaseMapper,
  emote: identityMapper,
  range: identityMapper,
  castingTime: castingTimeMapper,
  target: identityMapper,
  description: getRenameMapper('content'),
  higherLevel: camelCaseFixMapper,
  ritual: booleanMapper,
  concentration: booleanMapper,
  save: getObjectMapper(saveAttackMappings),
  attack: getObjectMapper(saveAttackMappings),
  damage: getObjectMapper(saveAttackMappings),
  heal: getObjectMapper({
    amount: getRenameMapper('heal'),
    castingStat: castingStatMapper,
    higherLevelDice: camelCaseFixMapper,
    higherLevelDie: camelCaseFixMapper,
    higherLevelAmount: getRenameMapper('higher_level_heal'),
    bonus: getRenameMapper('heal_bonus'),
  }),
  components: componentMapper,
  prepared(key, value, output) {
    if (value) {
      output.is_prepared = 'on';
    }
  },
  classes: _.noop,
  aoe: _.noop,
  source: _.noop,
  effects: _.noop,
  domains: _.noop,
  oaths: _.noop,
  circles: _.noop,
  patrons: _.noop,
});


const monsterMapper = getObjectMapper({
  name: getRenameMapper('character_name'),
  size: identityMapper,
  type: identityMapper,
  alignment: identityMapper,
  AC: getRenameMapper('ac_srd'),
  HP: getRenameMapper('hp_srd'),
  speed: getRenameMapper('npc_speed'),
  strength: identityMapper,
  dexterity: identityMapper,
  constitution: identityMapper,
  intelligence: identityMapper,
  wisdom: identityMapper,
  charisma: identityMapper,
  skills: getRenameMapper('skills_srd'),
  spells(key, value, output) {
    const splitSpells = _.partition(value, _.isObject);
    if (!_.isEmpty(splitSpells[1])) {
      output.spells_srd = splitSpells[1].join(', ');
    }
    if (!_.isEmpty(splitSpells[0])) {
      output.spells = splitSpells[0];
      _.each(output.spells, spell => (spell.prepared = true));
    }
  },
  savingThrows: getRenameMapper('saving_throws_srd'),
  damageResistances: getRenameMapper('damage_resistances'),
  damageImmunities: getRenameMapper('damage_immunities'),
  conditionImmunities: getRenameMapper('condition_immunities'),
  damageVulnerabilities: getRenameMapper('damage_vulnerabilities'),
  senses: identityMapper,
  languages: identityMapper,
  challenge: identityMapper,
  traits: identityMapper,
  actions: identityMapper,
  reactions: identityMapper,
  regionalEffects: identityMapper,
  regionalEffectsFade: identityMapper,
  legendaryPoints: identityMapper,
  legendaryActions: identityMapper,
  lairActions: identityMapper,
});

const pronounTokens = {
  '{{GENDER_PRONOUN_HE_SHE}}': 'nominative',
  '{{GENDER_PRONOUN_HIM_HER}}': 'accusative',
  '{{GENDER_PRONOUN_HIS_HER}}': 'possessive',
  '{{GENDER_PRONOUN_HIMSELF_HERSELF}}': 'reflexive',
};


module.exports = {

  convertMonster(npcObject) {
    const output = {};
    monsterMapper(null, npcObject, output);

    const actionTraitTemplate = _.template('**<%=data.name%>' +
      '<% if(data.recharge) { print(" (" + data.recharge + ")") } %>**: <%=data.text%>', { variable: 'data' });
    const legendaryTemplate = _.template('**<%=data.name%>' +
      '<% if(data.cost && data.cost > 1){ print(" (Costs " + data.cost + " actions)") }%>**: <%=data.text%>',
      { variable: 'data' });

    function lairRegionalTemplate(item) {
      return `**${item}`;
    }

    const simpleSectionTemplate = _.template('<%=data.title%>\n<% print(data.items.join("\\n")); %>',
      { variable: 'data' });
    const legendarySectionTemplate = _.template('<%=data.title%>\n' +
      'The <%=data.name%> can take <%=data.legendaryPoints%> legendary actions, choosing from the options below. ' +
      'It can take only one legendary action at a time and only at the end of another creature\'s turn. ' +
      'The <%=data.name%> regains spent legendary actions at the start of its turn.\n' +
      '<% print(data.items.join("\\n")) %>', { variable: 'data' });
    const regionalSectionTemplate = _.template('<%=data.title%>\n<% print(data.items.join("\\n")); %>\n' +
      '**<%=data.regionalEffectsFade%>', { variable: 'data' });

    const srdContentSections = [
      { prop: 'traits', itemTemplate: actionTraitTemplate, sectionTemplate: simpleSectionTemplate },
      { prop: 'actions', itemTemplate: actionTraitTemplate, sectionTemplate: simpleSectionTemplate },
      { prop: 'reactions', itemTemplate: actionTraitTemplate, sectionTemplate: simpleSectionTemplate },
      { prop: 'legendaryActions', itemTemplate: legendaryTemplate, sectionTemplate: legendarySectionTemplate },
      { prop: 'lairActions', itemTemplate: lairRegionalTemplate, sectionTemplate: simpleSectionTemplate },
      { prop: 'regionalEffects', itemTemplate: lairRegionalTemplate, sectionTemplate: regionalSectionTemplate },
    ];

    function makeDataObject(propertyName, itemList) {
      return {
        title: propertyName.replace(/([A-Z])/g, ' $1').replace(/^[a-z]/, letter => letter.toUpperCase()),
        name: output.character_name,
        legendaryPoints: output.legendaryPoints,
        regionalEffectsFade: output.regionalEffectsFade,
        items: itemList,
      };
    }

    output.is_npc = 1;
    output.edit_mode = 'off';

    output.content_srd = _.chain(srdContentSections)
      .map((sectionSpec) => {
        const items = output[sectionSpec.prop];
        delete output[sectionSpec.prop];
        return _.map(items, sectionSpec.itemTemplate);
      })
      .map((sectionItems, sectionIndex) => {
        const sectionSpec = srdContentSections[sectionIndex];
        if (!_.isEmpty(sectionItems)) {
          return sectionSpec.sectionTemplate(makeDataObject(sectionSpec.prop, sectionItems));
        }

        return null;
      })
      .compact()
      .value()
      .join('\n');

    delete output.legendaryPoints;

    return output;
  },


  convertSpells(spellObjects, pronounInfo) {
    return _.map(spellObjects, (spellObject) => {
      const converted = {};
      spellMapper(null, spellObject, converted);
      converted.toggle_details = 0;
      if (converted.emote) {
        _.each(pronounTokens, (pronounType, token) => {
          const replacement = pronounInfo[pronounType];
          converted.emote = converted.emote.replace(new RegExp(token, 'g'), replacement);
        });
      }
      return converted;
    });
  },
};
