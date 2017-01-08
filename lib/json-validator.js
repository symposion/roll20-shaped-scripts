'use strict';
const _ = require('underscore');

// noinspection JSUnusedGlobalSymbols
const validatorFactories = {
  orderedContent(spec) {
    return makeContentModelValidator(spec);
  },

  unorderedContent(spec) {
    return makeContentModelValidator(spec);
  },

  string(spec) {
    if (spec.pattern) {
      if (spec.matchGroup) {
        return regExValidator(spec.name, extractRegexPart(spec.pattern, spec.matchGroup), spec.caseSensitive);
      }

      return regExValidator(spec.name, spec.pattern, spec.caseSensitive);
    }
    return function noop() {
    };
  },

  enumType(spec) {
    return function enumValidator(value, errors) {
      if (!_.some(spec.enumValues, enumVal => new RegExp(`^${enumVal}$`, 'i').test(value))) {
        errors.add(`Value "${value}" should have been one of [${spec.enumValues.join(',')}]`);
      }
    };
  },

  ability(spec) {
    return regExValidator(spec.name, '\\d+');
  },

  heading() {
    // Do not replace with _.noop, these functions get annotated
    return function noop() {
    };
  },

  number() {
    return function numberValidator(value, errors) {
      if (typeof value !== 'number') {
        errors.add(`Value "${value}" should have been a number`);
      }
    };
  },
};

function extractRegexPart(regexp, matchIndex) {
  let braceCount = 0;
  let startIndex = _.findIndex(regexp, (character, index) => {
    if (character === '(' &&
      (index < 2 || regexp[index - 1] !== '\\') &&
      regexp[index + 1] !== '?') {
      return ++braceCount === matchIndex;
    }
    return false;
  });

  if (startIndex === -1) {
    throw new Error(`Can't find matchgroup ${matchIndex} in regular expression ${regexp}`);
  }

  // Lose the bracket
  startIndex++;

  let openCount = 1;
  const endIndex = _.findIndex(regexp.slice(startIndex), (character, index, regexpPart) => {
    if (character === '(' && regexpPart[index - 1] !== '\\') {
      openCount++;
    }
    if (character === ')' && regexpPart[index - 1] !== '\\') {
      return --openCount === 0;
    }
    return false;
  });

  if (endIndex === -1) {
    throw new Error(`matchgroup ${matchIndex} seems not to have closing brace in regular expression ${regexp}`);
  }

  return regexp.slice(startIndex, startIndex + endIndex);
}

function regExValidator(fieldName, regexp, caseSensitive) {
  const re = new RegExp(`^${regexp}$`, caseSensitive ? undefined : 'i');
  return function regexpValidate(value, errors) {
    if (!re.test(value)) {
      errors.add(`Value "${value}" doesn't match pattern /${regexp}/`);
    }
  };
}

function makeValidator(spec) {
  const validator = validatorFactories[spec.type](spec);
  validator.max = _.isUndefined(spec.maxOccurs) ? 1 : spec.maxOccurs;
  validator.min = _.isUndefined(spec.minOccurs) ? 1 : spec.minOccurs;
  validator.fieldName = spec.name;
  return validator;
}

function makeContentModelValidator(spec) {
  const parts = _.chain(spec.contentModel)
    .reject({ type: 'heading' })
    .partition({ flatten: true })
    .value();
  const flattened = _.map(parts[0], makeValidator);

  const subValidators = _.reduce(parts[1], (subVals, field) => {
    subVals[field.name] = makeValidator(field);
    return subVals;
  }, {});

  return function contentModelValidator(object, errors, isFlatten) {
    let completed = _.reduce(object, (completedMemo, fieldValue, fieldName) => {
      const validator = subValidators[fieldName];
      if (validator) {
        completedMemo.push(fieldName);
        errors.pushPath(fieldName);
        if (_.isArray(fieldValue)) {
          if (fieldValue.length > validator.max) {
            errors.add(`Number of entries [${fieldValue.length}] exceeds maximum allowed: ${validator.max}`);
          }
          else if (fieldValue.length < validator.min) {
            errors.add(`Number of entries [${fieldValue.length}] is less than minimum allowed: ${validator.min}`);
          }
          else {
            _.each(fieldValue, (arrayItem, index) => {
              errors.pushIndex(arrayItem.name ? arrayItem.name : index);
              validator(arrayItem, errors);
              errors.popIndex();
            });
          }
        }
        else {
          validator(fieldValue, errors);
        }
        errors.popPath();
      }
      return completedMemo;
    }, []);

    let toValidate = _.omit(object, completed);

    _.chain(flattened)
      .map((validator) => {
        const subCompleted = validator(toValidate, errors, true);
        if (subCompleted.length === 0) {
          return validator;
        }

        completed = completed.concat(subCompleted);
        toValidate = _.omit(toValidate, completed);
        return null;
      })
      .compact()
      .each((validator) => {
        if (validator.min > 0) {
          errors.pushPath(validator.fieldName);
          errors.add('Section is missing');
          errors.popPath();
        }
      });

    // If we're a flattened validator (our content is injected directly into the parent content model)
    // Then we should only report missing fields if there was some match in our content model - otherwise
    // the parent content model will check the cardinality of this model as a whole
    if (!isFlatten || !_.isEmpty(completed)) {
      _.chain(subValidators)
        .omit(completed)
        .each((validator) => {
          if (validator.min > 0) {
            errors.pushPath(validator.fieldName);
            errors.add('Field is missing');
            errors.popPath();
          }
        });
    }

    // Flattened content models shouldn't check for unrecognised fields since they're only parsing
    // part of the current content model.
    if (!isFlatten) {
      _.chain(object)
        .omit(completed)
        .each((value, key) => {
          errors.pushPath(key);
          errors.add('Unrecognised field');
          errors.popPath();
        });
    }


    return completed;
  };
}

class Errors {
  constructor() {
    this.errors = [];
    this.currentPath = [];
  }

  pushPath(path) {
    this.currentPath.push(path);
  }

  popPath() {
    return this.currentPath.pop();
  }

  pushIndex(index) {
    this.currentPath[this.currentPath.length - 1] = `${this.currentPath[this.currentPath.length - 1]}[${index}]`;
  }

  popIndex() {
    this.currentPath[this.currentPath.length - 1] = this.currentPath[this.currentPath.length -
    1].replace(/\[[^\]]+\]/, '');
  }

  add(msg) {
    this.errors.push({ msg, path: _.clone(this.currentPath) });
  }

  getErrors() {
    return _.chain(this.errors)
      .groupBy(error => error.path[0])
      .mapObject(errorList =>
        _.map(errorList, error => `${error.path.slice(1).join('.')}: ${error.msg}`)
      )
      .value();
  }
}

module.exports = class JSONValidator {
  constructor(spec) {
    this.versionProp = {
      type: 'string',
      name: 'version',
    };
    this.spec = spec;
    this.contentValidator = makeValidator({ type: 'unorderedContent', contentModel: [spec, this.versionProp] });
  }

  validate(object) {
    const errors = new Errors();
    this.contentValidator(object, errors);
    return errors.getErrors();
  }

  getVersionNumber() {
    return this.spec.formatVersion;
  }
};
