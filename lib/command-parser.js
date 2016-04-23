'use strict';
const _ = require('underscore');
const utils = require('./utils');
const UserError = require('./user-error');


function getParser(optionString, validator) {
  return function parseOptions(arg, errors, options) {
    const argParts = arg.split(/\s+/);
    if (argParts[0].toLowerCase() === optionString.toLowerCase()) {
      if (argParts.length <= 2) {
        // Allow for bare switches
        const value = argParts.length === 2 ? argParts[1] : true;
        const result = validator(value);
        if (result.valid) {
          options[argParts[0]] = result.converted;
        }
        else {
          errors.push(`Invalid value [${value}] for option [${argParts[0]}]`);
        }
      }
      return true;
    }
    return false;
  };
}

function getObjectParser(specObject) {
  return function parseOptions(arg, errors, options) {
    const argParts = arg.split(/\s+/);
    const newObject = utils.createObjectFromPath(argParts[0], argParts.slice(1).join(' '));

    const comparison = { spec: specObject, actual: newObject };
    while (comparison.spec) {
      const key = _.keys(comparison.actual)[0];
      const spec = comparison.spec[key];
      if (!spec) {
        return false;
      }
      if (_.isFunction(comparison.spec[key])) {
        const result = comparison.spec[key](comparison.actual[key]);
        if (result.valid) {
          comparison.actual[key] = result.converted;
          utils.deepExtend(options, newObject);
        }
        else {
          errors.push(`Invalid value [${comparison.actual[key]}] for option [${argParts[0]}]`);
        }
        return true;
      }
      else if (_.isArray(comparison.actual[key])) {
        const newVal = [];
        newVal[comparison.actual[key].length - 1] = comparison.spec[key][0];
        comparison.spec = newVal;
        comparison.actual = comparison.actual[key];
      }
      else {
        comparison.spec = comparison.spec[key];
        comparison.actual = comparison.actual[key];
      }
    }
    return false;
  };
}

/**
 * @constructor
 */

class Command {
  constructor(root, handler, roll20) {
    this.root = root;
    this.handler = handler;
    this.parsers = [];
    this.roll20 = roll20;
  }


  option(optionString, validator, required) {
    let parser;
    if (_.isFunction(validator)) {
      parser = getParser(optionString, validator);
    }
    else if (_.isObject(validator)) {
      const dummy = {};
      dummy[optionString] = validator;
      parser = getObjectParser(dummy);
    }
    else {
      throw new Error(`Bad validator [${validator}] specified for option ${optionString}`);
    }
    parser.required = required;
    parser.optName = optionString;
    this.parsers.push(parser);
    return this;
  }

  options(optsSpec) {
    _.each(optsSpec, (validator, key) => this.option(key, validator));
    return this;
  }

  optionLookup(groupName, lookup, required) {
    if (typeof lookup !== 'function') {
      lookup = _.propertyOf(lookup);
    }
    const parser = (arg, errors, options) => {
      options[groupName] = options[groupName] || [];
      const singleResolved = lookup(arg, options);
      if (singleResolved) {
        options[groupName].push(singleResolved);
        return true;
      }


      const results = _.chain(arg.split(','))
        .map(_.partial(_.result, _, 'trim'))
        .uniq()
        .reduce((memo, name) => {
          const resolvedPart = lookup(name, options);
          if (resolvedPart) {
            memo.resolved.push(resolvedPart);
          }
          else {
            memo.errors.push(`Unrecognised item ${name} for option group ${groupName}`);
          }
          return memo;
        }, { errors: [], resolved: [] })
        .value();

      if (!_.isEmpty(results.resolved)) {
        options[groupName] = results.resolved;
        errors.push.apply(errors, results.errors);
        return true;
      }
      return false;
    };
    parser.optName = groupName;
    parser.required = required;
    this.parsers.push(parser);
    return this;
  }

  handle(args, selection, cmdString) {
    const startOptions = { errors: [] };
    startOptions.selected = this.selectionSpec && processSelection(selection || [], this.selectionSpec, this.roll20);
    const finalOptions = _.chain(args)
      .reduce((options, arg) => {
        if (!_.some(this.parsers, parser => parser(arg, options.errors, options))) {
          options.errors.push(`Unrecognised or poorly formed option ${arg}`);
        }

        return options;
      }, startOptions)
      .omit(_.isUndefined)
      .value();

    if (finalOptions.errors.length > 0) {
      throw finalOptions.errors.join('\n');
    }
    delete finalOptions.errors;


    const missingOpts = _.chain(this.parsers)
      .where({ required: true })
      .pluck('optName')
      .difference(_.keys(finalOptions))
      .value();

    if (!_.isEmpty(missingOpts)) {
      throw new UserError(`Command ${cmdString} was missing options: [${missingOpts.join(',')}]`);
    }

    this.handler(finalOptions);
  }

  withSelection(selectionSpec) {
    this.selectionSpec = selectionSpec;
    return this;
  }


  addCommand(cmdString, handler) {
    return this.root.addCommand(cmdString, handler);
  }

  end() {
    return this.root;
  }
}

function processSelection(selection, constraints, roll20) {
  return _.reduce(constraints, (result, constraintDetails, type) => {
    const objects = _.chain(selection)
      .where({ _type: type === 'character' ? 'graphic' : type })
      .map(selected => roll20.getObj(selected._type, selected._id))
      .map(object => {
        if (type === 'character' && object) {
          return roll20.getObj('character', object.get('represents'));
        }
        return object;
      })
      .compact()
      .uniq()
      .value();
    if (_.size(objects) < constraintDetails.min || _.size(objects) > constraintDetails.max) {
      throw new UserError(`Wrong number of objects of type [${type}] selected, should be between ` +
        `${constraintDetails.min} and ${constraintDetails.max}`);
    }
    switch (_.size(objects)) {
      case 0:
        break;
      case 1:
        if (constraintDetails.max === 1) {
          result[type] = objects[0];
        }
        else {
          result[type] = objects;
        }
        break;
      default:
        result[type] = objects;
    }
    return result;
  }, {});
}

module.exports = function commandParser(rootCommand, roll20) {
  const commands = {};
  return {
    addCommand(cmds, handler) {
      const command = new Command(this, handler, roll20);
      (_.isArray(cmds) ? cmds : [cmds]).forEach(cmdString => (commands[cmdString] = command));
      return command;
    },

    processCommand(msg) {
      const prefix = `!${rootCommand}-`;
      if (msg.type === 'api' && msg.content.indexOf(prefix) === 0) {
        const cmdString = msg.content.slice(prefix.length);
        const parts = cmdString.split(/\s+--/);
        const cmdName = parts.shift();
        const cmd = commands[cmdName];
        if (!cmd) {
          throw new UserError(`Unrecognised command ${prefix}${cmdName}`);
        }
        cmd.handle(parts, msg.selected, `${prefix}${cmdName}`);
      }
    },
  };
};
