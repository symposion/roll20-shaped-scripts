'use strict';
const _ = require('underscore');
const utils = require('./utils');
const UserError = require('./user-error');


function getParser(optionString, validator) {
  return function parseOptions(arg, errors, options) {
    const argParts = arg.split(/\s+/);
    if (argParts[0].toLowerCase() === optionString.toLowerCase()) {
      const value = argParts.length === 1 ? true : argParts.slice(1).join(' ');
      const result = validator(value);
      if (result.valid) {
        options[argParts[0]] = result.converted;
      }
      else {
        errors.push(`Invalid value [${value}] for option [${argParts[0]}]`);
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
  constructor(root, handler, roll20, name, gmOnly) {
    this.root = root;
    this.handler = handler;
    this.parsers = [];
    this.roll20 = roll20;
    this.name = name;
    this.gmOnly = gmOnly;
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
      const singleResolved = lookup(arg, options);
      if (singleResolved) {
        options[groupName] = options[groupName] || [];
        options[groupName].push.apply(options[groupName],
          _.isArray(singleResolved) ? singleResolved : [singleResolved]);
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

  handle(args, selection, cmdString, playerIsGM, playerId, requiredCharVersion) {
    if (!playerIsGM && this.gmOnly) {
      throw new UserError('You must be a GM to run this command');
    }
    const caches = {};
    const startOptions = {
      errors: [],
    };
    Object.defineProperty(startOptions, 'getCache', {
      enumerable: false,
      value: function getCache(key) {
        return (caches[key] = caches[key] || {});
      },
    });

    startOptions.selected =
      this.selectionSpec && processSelection(selection || [], this.selectionSpec, this.roll20, requiredCharVersion);
    const finalOptions = _.chain(args)
      .reduce((options, arg) => {
        if (!_.some(this.parsers, parser => parser(arg, options.errors, options))) {
          options.errors.push(`Unrecognised or poorly formed option ${arg}`);
        }

        return options;
      }, startOptions)
      .each((propVal, propName, obj) => {
        // NB Cannot use omit or it will remove the getCache property
        if (_.isUndefined(propVal)) {
          delete obj[propName];
        }
      })
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

    if (!playerIsGM) {
      const characters = _.compact([].concat(finalOptions.selected && finalOptions.selected.character)
        .concat(finalOptions.character));
      characters.forEach((character) => {
        const controlledby = character.get('controlledby');
        if (!controlledby || (controlledby.indexOf(playerId) === -1 && controlledby.indexOf('all') === -1)) {
          throw new UserError(`You do not have permission to make changes to character ${character.get('name')}`);
        }
      });
    }
    finalOptions.playerId = playerId;
    return this.handler(finalOptions);
  }

  withSelection(selectionSpec) {
    this.selectionSpec = selectionSpec;
    return this;
  }


  addCommand() {
    return this.root.addCommand.apply(this.root, arguments);
  }

  addModule() {
    return this.root.addModule.apply(this.root, arguments);
  }

  processCommand() {
    return this.root.processCommand.apply(this.root, arguments);
  }

  get logWrap() {
    return `command [${this.name}]`;
  }
}

function processSelection(selection, constraints, roll20, requiredCharVersion) {
  return _.reduce(constraints, (result, constraintDetails, type) => {
    const objects = _.chain(selection)
      .where({ _type: type === 'character' ? 'graphic' : type })
      .map(selected => roll20.getObj(selected._type, selected._id))
      .map((object) => {
        if (type === 'character' && object) {
          const char = roll20.getObj('character', object.get('represents'));
          if (!constraintDetails.anyVersion) {
            const version = roll20.getAttrByName(char.id, 'version');
            if (version !== requiredCharVersion) {
              throw new UserError(`Character ${char.get('name')} is not at the required sheet version ` +
                `[${requiredCharVersion}], but instead [${version}]. Try opening the character sheet or running ` +
                '!shaped-update-character to update it.');
            }
          }
          return char;
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


module.exports = function commandParser(rootCommand, roll20, errorHandler, eventDispatcher,
  requiredCharVersion) {
  const commands = {};
  let defaultHandler = null;

  const cp = {
    processCommand(msg) {
      const prefix = `!${rootCommand}-`;
      if (msg.type === 'api' && msg.content.indexOf(prefix) === 0) {
        const cmdString = msg.content.slice(prefix.length);
        const parts = cmdString.split(/\s+--/);
        const cmdName = parts.shift();
        const cmd = commands[cmdName];
        if (!cmd) {
          if (defaultHandler) {
            defaultHandler(`${prefix}${cmdName}`);
          }
          return;
        }
        const returnVal = cmd.handle(parts, msg.selected, `${prefix}${cmdName}`,
          roll20.playerIsGM(msg.playerid), msg.playerid, requiredCharVersion);
        if (returnVal instanceof Promise) {
          returnVal.catch(errorHandler);
        }
      }
    },

    setDefaultCommandHandler(handler) {
      defaultHandler = handler;
    },

    addCommand(cmds, handler, gmOnly) {
      const command = new Command(this, handler, roll20, _.isArray(cmds) ? cmds.join(',') : cmds,
        gmOnly);
      (_.isArray(cmds) ? cmds : [cmds]).forEach(cmdString => (commands[cmdString] = command));
      return command;
    },

    logWrap: 'commandParser',
  };
  eventDispatcher.registerEventHandler('chat:message', cp.processCommand.bind(cp));
  return cp;
};
