'use strict';
const _ = require('underscore');
const utils = require('./utils');


module.exports = class EntityLookup {
  constructor() {
    this.entities = {};
    this.noWhiteSpaceEntities = {};
    this.entityProcessors = {};
    this.versionCheckers = {};
  }


  configureEntity(entityName, processors, versionChecker) {
    this.entities[entityName] = {};
    this.noWhiteSpaceEntities[entityName] = {};
    this.entityProcessors[entityName] = processors;
    this.versionCheckers[entityName] = versionChecker;
  }

  addEntities(entitiesObject) {
    const results = {
      errors: [],
    };


    _.chain(entitiesObject)
      .omit('version', 'patch')
      .each((entityArray, type) => {
        results[type] = {
          withErrors: [],
          skipped: [],
          deleted: [],
          patched: [],
          added: [],
        };

        if (!this.entities[type]) {
          results.errors.push({ entity: 'general', errors: [`Unrecognised entity type ${type}`] });
          return;
        }

        if (!this.versionCheckers[type](entitiesObject.version, results.errors)) {
          return;
        }


        _.each(entityArray, (entity) => {
          let key = entity.name.toLowerCase();
          let operation = !!this.entities[type][key] ? (entitiesObject.patch ? 'patched' : 'skipped') : 'added';

          if (operation === 'patched') {
            entity = patchEntity(this.entities[type][key], entity);
            if (!entity) {
              operation = 'deleted';
              delete this.entities[type][key];
              delete this.noWhiteSpaceEntities[type][key.replace(/\s+/g, '')];
            }
          }

          if (_.contains(['patched', 'added'], operation)) {
            const processed = _.reduce(this.entityProcessors[type], utils.executor, {
              entity,
              type,
              version: entitiesObject.version,
              errors: [],
            });
            if (!_.isEmpty(processed.errors)) {
              processed.entity = processed.entity.name;
              results.errors.push(processed);
              operation = 'withErrors';
            }
            else {
              if (processed.entity.name.toLowerCase() !== key) {
                results[type].deleted.push(key);
                delete this.entities[type][key];
                delete this.noWhiteSpaceEntities[type][key.replace(/\s+/g, '')];
                key = processed.entity.name.toLowerCase();
              }
              this.entities[type][key] = processed.entity;
              this.noWhiteSpaceEntities[type][key.replace(/\s+/g, '')] = processed.entity;
            }
          }


          results[type][operation].push(key);
        });
      });

    return results;
  }

  findEntity(type, name, tryWithoutWhitespace) {
    const key = name.toLowerCase();
    if (!this.entities[type]) {
      throw new Error(`Unrecognised entity type ${type}`);
    }
    let found = this.entities[type][key];
    if (!found && tryWithoutWhitespace) {
      found = this.noWhiteSpaceEntities[type][key.replace(/\s+/g, '')];
    }
    return found && utils.deepClone(found);
  }

  getAll(type) {
    if (!this.entities[type]) {
      throw new Error(`Unrecognised entity type: ${type}`);
    }
    return utils.deepClone(_.values(this.entities[type]));
  }

  /**
   * Gets all of the keys for the specified entity type
   * @param {string} type - The entity type to retrieve keys for (either 'monster' or 'spell')
   * @param {boolean} sort - True if the returned array should be sorted alphabetically; false otherwise
   * @function
   * @public
   * @name EntityLookup#getKeys
   * @return {Array} An array containing all keys for the specified entity type
   */
  getKeys(type, sort) {
    if (!this.entities[type]) {
      throw new Error(`Unrecognised entity type: ${type}`);
    }
    const keys = _.keys(this.entities[type]);
    if (sort) {
      keys.sort();
    }
    return keys;
  }


  /**
   * Gets spell hydrator
   * @function
   * @public
   * @name EntityLookup#getSpellHydrator
   * @return {function}
   */
  getSpellHydrator() {
    const self = this;
    return function spellHydrator(monsterInfo) {
      const monster = monsterInfo.entity;
      if (monster.spells) {
        const spellArray = monster.spells.split(', ');
        monster.spells = _.map(spellArray, spellName => self.findEntity('spells', spellName) || spellName);
      }
      return monsterInfo;
    };
  }

  getMonsterSpellUpdater() {
    const self = this;
    return function spellUpdater(spellInfo) {
      const spell = spellInfo.entity;
      _.chain(self.entities.monsters)
        .pluck('spells')
        .compact()
        .each(spellArray => {
          const spellIndex = _.findIndex(spellArray, monsterSpell => {
            if (typeof monsterSpell === 'string') {
              return monsterSpell.toLowerCase() === spell.name.toLowerCase();
            }

            return monsterSpell !== spell && monsterSpell.name.toLowerCase() === spell.name.toLowerCase();
          });
          if (spellIndex !== -1) {
            spellArray[spellIndex] = spell;
          }
        });
      return spellInfo;
    };
  }


  toJSON() {
    return { monsterCount: _.size(this.entities.monsters), spellCount: _.size(this.entities.spells) };
  }

  get logWrap() {
    return 'entityLookup';
  }

  static jsonValidatorAsEntityProcessor(jsonValidator) {
    return function jsonValidatorEntityProcessor(entityInfo) {
      const wrapper = {
        version: entityInfo.version,
      };
      wrapper[entityInfo.type] = [entityInfo.entity];
      const errors = jsonValidator.validate(wrapper);
      const flattenedErrors = _.chain(errors).values().flatten().value();
      entityInfo.errors = entityInfo.errors.concat(flattenedErrors);
      return entityInfo;
    };
  }

  static jsonValidatorAsVersionChecker(jsonValidator) {
    return EntityLookup.getVersionChecker(jsonValidator.getVersionNumber());
  }

  static getVersionChecker(requiredVersion) {
    return function versionChecker(version, errorsArray) {
      const valid = version === requiredVersion;
      if (!valid) {
        errorsArray.push({
          entity: 'general',
          errors: [`Incorrect entity objects version: [${version}]. Required is: ${requiredVersion}`],
        });
      }
      return valid;
    };
  }
};

function patchEntity(original, patch) {
  if (patch.remove) {
    return undefined;
  }
  return _.mapObject(original, (propVal, propName) => {
    if (propName === 'name' && patch.newName) {
      return patch.newName;
    }
    return patch[propName] || propVal;
  });
}
