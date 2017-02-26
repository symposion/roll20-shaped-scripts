'use strict';
const Roll20 = require('roll20-wrapper');
const parseModule = require('./parser');
const mmFormat = require('../resources/mmFormatSpec.json');
const Logger = require('roll20-logger');
const EntityLookup = require('./entity-lookup');
const JSONValidator = require('./json-validator');
const EntityLookupResultReporter = require('./entity-lookup-result-reporter');
const Reporter = require('./reporter');
const makeCommandProc = require('./command-parser');
const AbilityMaker = require('./modules/ability-maker');
const ConfigUI = require('./modules/config-ui');
const AdvantageTracker = require('./modules/advantage-tracker');
const RestManager = require('./modules/rest-manager');
const UsesManager = require('./modules/uses-manager');
const AmmoManager = require('./modules/ammo-manager');
const Importer = require('./modules/importer');
const DeathSaveManager = require('./modules/death-save-manager');
const HDManager = require('./modules/hd-manager');
const FXManager = require('./modules/fx-manager');
const SpellManager = require('./modules/spell-manager');
const TokenBarConfigurer = require('./modules/token-bar-configurer');
const srdConverter = require('./srd-converter');
const UserError = require('./user-error');
const Migrator = require('./migrations');
const EventDispatcher = require('./event-dispatcher');
const ChatWatcher = require('./chat-watcher');
const utils = require('./utils');


const roll20 = new Roll20();
const myState = roll20.getState('ShapedScripts');
const logger = new Logger('5eShapedCompanion', roll20);
const el = new EntityLookup();
const reporter = new Reporter(roll20, 'Shaped Scripts');

const errorHandler = function errorHandler(e) {
  if (typeof e === 'string' || e instanceof parseModule.ParserError || e instanceof UserError) {
    reporter.reportError(e);
    logger.error('Error: $$$', e.toString());
  }
  else {
    logger.error(e.toString());
    logger.error(e.stack);
    reporter.reportError('An error occurred. Please see the log for more details.');
  }
};

const elrr = new EntityLookupResultReporter(logger, reporter);

const MINIMUM_SHEET_VERSION = '9.2.2';


roll20.logWrap = 'roll20';
logger.wrapModule(el);
logger.wrapModule(roll20);

const jsonValidator = new JSONValidator(mmFormat);
el.configureEntity('monsters', [EntityLookup.jsonValidatorAsEntityProcessor(jsonValidator)],
  EntityLookup.jsonValidatorAsVersionChecker(jsonValidator, 'monsters'));
el.configureEntity('spells', [], EntityLookup.getVersionChecker('1.0.0', 'spells'));

roll20.on('ready', () => {
  logger.info('-=> ShapedScripts %%GULP_INJECT_VERSION%% <=-');
  Migrator.migrateShapedConfig(myState, logger);
  const character = roll20.createObj('character', { name: 'SHAPED_VERSION_TESTER' });
  setTimeout(() => {
    roll20.createAttrWithWorker(character.id, 'sheet_opened', 1, () => {
      const version = roll20.getAttrByName(character.id, 'version');
      setTimeout(() => {
        character.remove();
      }, 1000);
      logger.info('Detected sheet version as : $$$', version);
      if (utils.versionCompare(version, MINIMUM_SHEET_VERSION) < 0) {
        reporter.reportError(`Incompatible sheet version. You need at least version ${MINIMUM_SHEET_VERSION} to use ` +
          'this script.');
        return;
      }
      const ed = new EventDispatcher(roll20, errorHandler, logger, reporter);
      const cw = new ChatWatcher(roll20, logger, ed);
      const commandProc = makeCommandProc('shaped', roll20, errorHandler, ed, version);
      getModuleList().forEach(module => module.configure(roll20, reporter, logger, myState, commandProc, cw, ed));
    });
  }, 400);
});

module.exports = {
  addEntities(entities) {
    try {
      if (typeof entities === 'string') {
        entities = JSON.parse(entities);
      }
      // Suppress excessive logging when adding big lists of entities
      const prevLogLevel = logger.getLogLevel();
      logger.setLogLevel(Logger.levels.INFO);
      el.addEntities(entities, elrr);
      logger.setLogLevel(prevLogLevel);
    }
    catch (e) {
      reporter.reportError('JSON parse error, please see log for more information');
      logger.error(e.toString());
      logger.error(e.stack);
    }
  },
};

function getModuleList() {
  const abilityMaker = new AbilityMaker();
  return [
    abilityMaker,
    new ConfigUI(),
    new AdvantageTracker(),
    new UsesManager(),
    new RestManager(),
    new AmmoManager(),
    new Importer(el, parseModule.getParser(mmFormat, logger), abilityMaker, srdConverter),
    new DeathSaveManager(),
    new HDManager(),
    new FXManager(),
    new SpellManager(),
    new TokenBarConfigurer(),
  ];
}
