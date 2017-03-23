'use strict';
const _ = require('underscore');
const Utils = require('./utils');


module.exports = class EntityLookup {
  constructor(logger) {
    this.entities = {};
    this.noWhiteSpaceEntities = {};
    this.entityProcessors = {};
    this.versionCheckers = {};
    this.processedEntityGroupNames = [];
    this.deferredEntityGroups = [];
    this.lastEntityLoadTime = 0;
    this.timerId = null;
    this.logger = logger;
  }


  configureEntity(entityName, processors, versionChecker) {
    this.entities[entityName] = {};
    this.noWhiteSpaceEntities[entityName] = {};
    this.entityProcessors[entityName] = processors || [];
    this.versionCheckers[entityName] = versionChecker || _.constant(true);
    this.entityProcessors[entityName].push((entityInfo) => {
      entityInfo.entity.source = entityInfo.source;
      return entityInfo;
    });
  }

  addEntities(entitiesObject, resultReporter) {
    try {
      entitiesObject.name = entitiesObject.name || 'unnamed';
      const results = {
        errors: [],
        entityGroupName: entitiesObject.name,
      };
      this.logger.debug('Attempting to add entity group $$$', entitiesObject.name);

      if (entitiesObject.dependencies && !_.isEmpty(entitiesObject.dependencies)) {
        if (typeof entitiesObject.dependencies === 'string') {
          entitiesObject.dependencies = entitiesObject.dependencies.split(/,/)
            .map(Function.prototype.call, String.prototype.trim);
        }
        if (!_.isEmpty(_.difference(entitiesObject.dependencies, this.processedEntityGroupNames))) {
          this.logger.debug('Deferring processing of $$$ as deps aren\'t met', entitiesObject.name);
          this.deferredEntityGroups.push(entitiesObject);
          return;
        }
      }

      _.chain(entitiesObject)
        .omit('version', 'patch', 'name', 'dependencies')
        .each((entityArray, type) => {
          results[type] = {
            withErrors: [],
            skipped: [],
            deleted: [],
            patched: [],
            merged: [],
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
            let operation = this.entities[type][key] ? (entitiesObject.patch ? 'patched' : 'merged') : 'added';

            if (operation === 'patched') {
              entity = patchEntity(this.entities[type][key], entity);
              if (!entity) {
                operation = 'deleted';
                delete this.entities[type][key];
                delete this.noWhiteSpaceEntities[type][key.replace(/\s+/g, '')];
              }
            }
            else if (operation === 'merged') {
              entity = mergeEntity(this.entities[type][key], entity);
              if (!entity) {
                operation = 'skipped';
              }
            }

            if (_.contains(['patched', 'added', 'merged'], operation)) {
              const processed = _.reduce(this.entityProcessors[type], Utils.executor, {
                entity,
                lookup: (otherType, name) =>
                  (name ? this.entities[otherType][name.toLowerCase()] : _.values(this.entities[otherType])),
                type,
                source: entitiesObject.name,
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

      this.processedEntityGroupNames.push(entitiesObject.name);
      if (resultReporter) {
        resultReporter.report(results);
      }
      this.deferredEntityGroups = _.without(this.deferredEntityGroups, entitiesObject);
    }
    finally {
      this.lastEntityLoadTime = Date.now();
      this.checkForUnresolvedDependencies(resultReporter);
    }
  }

  checkForUnresolvedDependencies(resultReporter, timerExpired) {
    if (this.checkingDeps) {
      return;
    }
    try {
      this.logger.debug('Checking for newly met deps');
      this.checkingDeps = true;
      this.deferredEntityGroups.forEach((deferred) => {
        if (_.isEmpty(_.difference(deferred.dependencies, this.processedEntityGroupNames))) {
          this.addEntities(deferred, resultReporter);
        }
      });

      if (!timerExpired) {
        clearTimeout(this.timerId);
        this.timerId = _.delay(this.checkForUnresolvedDependencies.bind(this), 10000, resultReporter, true);
      }
      else if (resultReporter) {
        this.deferredEntityGroups.forEach((deferred) => {
          const missingDeps = _.difference(deferred.dependencies, this.processedEntityGroupNames);
          resultReporter.report({
            errors: [
              {
                entity: 'Missing dependencies',
                errors: [`Entity group is missing dependencies [${missingDeps.join(', ')}]`],
              },
            ],
            entityGroupName: deferred.name,
          });
        });
      }
    }
    finally {
      this.checkingDeps = false;
    }
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
    return found && Utils.deepClone(found);
  }

  hasEntities(type) {
    return !!this.entities[type];
  }

  searchEntities(type, criteria) {
    function containsSomeIgnoreCase(array, testValues) {
      testValues = (_.isArray(testValues) ? testValues : [testValues]).map(s => s.toLowerCase());
      return !!_.chain(array)
        .map(s => s.toLowerCase())
        .intersection(testValues)
        .value().length;
    }

    return _.reduce(criteria, (results, criterionValue, criterionField) => {
      const stringMatcher = (value) => {
        const matchers = (_.isArray(criterionValue) ? criterionValue : [criterionValue])
          .map(cv => new RegExp(cv, 'i'));
        return matchers.some(matcher => value.match(matcher));
      };
      const matcher = (entity) => {
        const value = entity[criterionField];
        switch (typeof value) {
          case 'string':
            return stringMatcher(value);
          case 'boolean':
          case 'number':
            return _.isArray(criterionValue) ? _.contains(criterionValue, value) : value === criterionValue;
          case 'object':
            return _.isArray(value) && containsSomeIgnoreCase(value, criterionValue);
          case 'undefined':
            return _.isArray(criterionValue) ? _.contains(criterionValue, false) :
              _.isBoolean(criterionValue) && !criterionValue;
          default:
            return false;
        }
      };
      return results.filter(matcher);
    }, this.getAll(type));
  }

  getAll(type) {
    if (!this.entities[type]) {
      throw new Error(`Unrecognised entity type: ${type}`);
    }
    return Utils.deepClone(_.values(this.entities[type]).sort((e1, e2) => e1.name.localeCompare(e2.name)));
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

  toJSON() {
    return { monsterCount: _.size(this.entities.monsters), spellCount: _.size(this.entities.spells) };
  }

  get logWrap() {
    return 'entityLookup';
  }

  static jsonValidatorAsEntityProcessor(jsonValidator, removeFields) {
    return function jsonValidatorEntityProcessor(entityInfo) {
      const wrapper = {
        version: entityInfo.version,
      };
      wrapper[entityInfo.type] = [_.omit(entityInfo.entity, removeFields)];
      const errors = jsonValidator.validate(wrapper);
      const flattenedErrors = _.chain(errors).values().flatten().value();
      entityInfo.errors = entityInfo.errors.concat(flattenedErrors);
      return entityInfo;
    };
  }

  static jsonValidatorAsVersionChecker(jsonValidator, entityType) {
    return EntityLookup.getVersionChecker(jsonValidator.getVersionNumber(), entityType);
  }

  static getVersionChecker(requiredVersion, entityType) {
    function pruneToMinor(versionString) {
      return versionString.split('.', 2).join('.');
    }

    return function versionChecker(version, errorsArray) {
      const prunedVersion = pruneToMinor(version);
      const prunedRequiredVersion = pruneToMinor(requiredVersion);
      const valid = prunedVersion === prunedRequiredVersion;
      if (!valid) {
        errorsArray.push({
          entity: 'general',
          errors: [
            `Incorrect ${entityType} data format version: [${version}]. Required is: ${requiredVersion}.` +
            'This probably means you need to download an updated version to be compatible with the latest version of' +
            ' the Companion Script.',
          ],
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

function mergeEntity(original, toMerge) {
  let failed = false;
  const merged = _.mapObject(original, (propVal, propName) => {
    if (propName !== 'name' && toMerge[propName]) {
      if (_.isArray(toMerge[propName]) && _.isArray(propVal)) {
        const partition = _.partition(toMerge[propName],
          entry => propVal.find(existing => existing.name && (existing.name === entry.name)));
        const updates = partition[0];
        const additions = partition[1];

        const newList = propVal.map((existing) => {
          const update = updates.find(entry => entry.name === existing.name);
          if (update) {
            const innerMerged = mergeEntity(existing, update);
            if (!innerMerged) {
              failed = true;
            }
            return failed ? null : innerMerged;
          }
          return existing;
        });
        newList.push.apply(newList, additions);
        return newList;
      }
      failed = true;
    }
    return original[propName];
  });
  _.defaults(merged, toMerge);
  return failed ? null : merged;
}

