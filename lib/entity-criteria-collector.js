'use strict';
const _ = require('underscore');
const ShapedConfig = require('./shaped-config');
const Utils = require('./utils');

function makeKey(criterionName, value) {
  return `${criterionName}|${value}`;
}


module.exports = class EntityCriteriaCollector {

  constructor(criteriaList, logger, entityLookup, entityType) {
    this._criteria = criteriaList;
    this._entityLookup = entityLookup;
    this._criteriaFilters = {};
    this._dirty = true;
    this._entityType = entityType;
    this.logger = logger;
    criteriaList.forEach((criterion) => {
      criterion.values = [];
      criterion.displayName = _.isUndefined(criterion.displayName) ? criterion.name : criterion.displayName;
    });
  }

  getEntityProcessor() {
    return (entityInfo) => {
      this._dirty = true;
      return entityInfo;
    };
  }

  getCriteriaToDisplay(currentCriteria) {
    this.rebuildCriteria();
    let filteredCriteria = this.criteria;
    if (!_.isEmpty(currentCriteria)) {
      filteredCriteria = this._criteria
        .map((criterionToFilter) => {
          let baseKeySets = this._criteria
            .filter(criterion => currentCriteria[criterion.name] && criterion !== criterionToFilter)
            .map(criterion =>
              criterion.values
                .filter(value => _.contains(currentCriteria[criterion.name], value))
                .map(value => makeKey(criterion.name, value)))
            .concat([[undefined]]);

          baseKeySets = Utils.cartesianProductOf.apply(this, baseKeySets).map(keySet => _.compact(keySet));

          const filteredValues = criterionToFilter.values.filter((value) => {
            const testKey = makeKey(criterionToFilter.name, value);
            return baseKeySets.some(keySet => this._criteriaFilters[keySet.concat(testKey).sort().join(';')]);
          });
          const criterion = {
            name: criterionToFilter.name,
            values: filteredValues,
            displayName: criterionToFilter.displayName,
          };
          Object.defineProperties(criterion, {
            buildListEntry: { enumerable: false, value: criterionToFilter.buildListEntry },
            compare: { enumerable: false, value: criterionToFilter.compare },
            getValueText: { enumerable: false, value: criterionToFilter.getValueText },
          });
          return criterion;
        })
        .filter(criterion => !_.isEmpty(criterion.values));
    }

    filteredCriteria
      .forEach((criterion) => {
        criterion.values.sort(criterion.compare);
      });

    return filteredCriteria;
  }

  get criteria() {
    this.rebuildCriteria();
    return this._criteria;
  }

  get criteriaOptionsValidator() {
    this.rebuildCriteria();
    return _.object(this._criteria.map(criterion => [criterion.name, getValidator(criterion.validator)]));
  }

  rebuildCriteria() {
    if (!this._dirty) {
      return;
    }

    this.logger.debug('Rebuilding entity criteria for entity $$$', this._entityType);
    this._entityLookup.getAll(this._entityType).forEach((entity) => {
      const criteriaKeys = [];
      _.each(this._criteria, (criterion) => {
        const value = entity[criterion.name];
        (_.isArray(value) ? value : [value]).forEach((innerValue) => {
          innerValue = (criterion.transformer || _.identity)(innerValue);
          if (!_.isUndefined(innerValue)) {
            const criterionKey = makeKey(criterion.name, innerValue);
            criteriaKeys.push(criterionKey);

            if (!_.contains(criterion.values, innerValue)) {
              criterion.values.push(innerValue);
            }
          }
        });
        criterion.values.sort(criterion.compare);
      });

      criteriaKeys.sort();
      Utils.combine(criteriaKeys).forEach(key => (this._criteriaFilters[key] = 1));
    });
    this._dirty = false;
  }
};

function getValidator(validator) {
  if (!validator) {
    return ShapedConfig.arrayValidator;
  }

  return (value) => {
    const arrayResult = ShapedConfig.arrayValidator(value);
    arrayResult.converted = arrayResult.converted.map((val) => {
      const result = validator(val);
      arrayResult.valid = arrayResult.valid && result.valid;
      return result.converted;
    });
    return arrayResult;
  };
}
