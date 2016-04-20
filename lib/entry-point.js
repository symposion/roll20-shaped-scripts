'use strict';
const Roll20 = require('roll20-wrapper');
const roll20 = new Roll20();
const parseModule = require('./parser');
const mmFormat = require('../resources/mmFormatSpec.json');
const myState = roll20.getState('ShapedScripts');
const Logger = require('roll20-logger');
const logger = new Logger('5eShapedCompanion', myState.config, roll20);
const EntityLookup = require('./entity-lookup');
const JSONValidator = require('./json-validator');
const el = new EntityLookup();
const Reporter = require('./reporter');
const reporter = new Reporter(roll20, 'Shaped Scripts');
const ShapedScripts = require('./shaped-script');
const srdConverter = require('./srd-converter');
const sanitise = require('./sanitise');
const mpp = require('./monster-post-processor');
const shaped = new ShapedScripts(logger, myState, roll20, parseModule.getParser(mmFormat, logger), el, reporter,
  srdConverter, sanitise, mpp);
const _ = require('underscore');

// logger.wrapModule(el);
logger.wrapModule(roll20);

const jsonValidator = new JSONValidator(require('../resources/mmFormatSpec.json'));
el.configureEntity('monsters', [
  EntityLookup.jsonValidatorAsEntityProcessor(jsonValidator),
  el.getSpellHydrator(),
], EntityLookup.jsonValidatorAsVersionChecker(jsonValidator));
el.configureEntity('spells', [el.getMonsterSpellUpdater()], EntityLookup.getVersionChecker('0.2'));

roll20.on('ready', () => {
  shaped.checkInstall();
  shaped.registerEventHandlers();
});

module.exports = {
  addEntities(entities) {
    try {
      if (typeof entities === 'string') {
        entities = JSON.parse(entities);
      }
      const result = el.addEntities(entities);
      const summary = _.mapObject(result, (resultObject, type) => {
        if (type === 'errors') {
          return resultObject.length;
        }

        return _.mapObject(resultObject, operationResultArray => operationResultArray.length);
      });
      logger.info('Summary of adding entities to the lookup: $$$', summary);
      logger.info('Details: $$$', result);
      if (!_.isEmpty(result.errors)) {
        const message = _.chain(result.errors)
          .groupBy('entity')
          .mapObject(entityErrors =>
            _.chain(entityErrors)
              .pluck('errors')
              .flatten()
              .value()
          )
          .map((errors, entityName) => `<li>${entityName}:<ul><li>${errors.join('</li><li>')}</li></ul></li>`)
          .value();

        reporter.reportError(`JSON import error:<ul>${message}</ul>`);
      }
    }
    catch (e) {
      reporter.reportError('JSON parse error, please see log for more information');
      logger.error(e.toString());
      logger.error(e.stack);
    }
  },
};
