'use strict';
const Roll20 = require('roll20-wrapper');
const parseModule = require('./parser');
const Logger = require('roll20-logger');
const EntityLookup = require('./entity-lookup');
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
const NewCharacterConfigurer = require('./modules/new-character-configurer');
const srdConverter = require('./srd-converter');
const UserError = require('./user-error');
const EventDispatcher = require('./event-dispatcher');
const ChatWatcher = require('./chat-watcher');
const Utils = require('./utils');
const _ = require('underscore');
const ShapedConfig = require('./shaped-config');
const EntityLister = require('./modules/entity-lister');
const MonsterManager = require('./modules/monster-manager');
const SheetWorkerChatOutput = require('./modules/sheetworker-chat-output');

const roll20 = new Roll20();
const myState = roll20.getState('ShapedScripts');
const logger = new Logger('5eShapedCompanion', roll20);
const entityLookup = new EntityLookup(logger);
const reporter = new Reporter(roll20, 'Shaped Scripts');

const MINIMUM_SHEET_VERSION = '11.2.0';
const SHEET_API_VERSION = '1';

const errorHandler = function errorHandler(e) {
  logger.prefixString = '';
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

roll20.logWrap = 'roll20';
logger.wrapModule(entityLookup);
logger.wrapModule(roll20);
logger.wrapModule(srdConverter);
const moduleList = getModuleList();

roll20.on('ready', () => {
  logger.info('-=> ShapedScripts %%GULP_INJECT_VERSION%% <=-');
  const character = roll20.createObj('character', { name: 'SHAPED_VERSION_TESTER' });
  const campaignSize = roll20.findObjs({}).length;
  logger.debug('Campaign size: $$$', campaignSize);
  roll20.createAttrWithWorker(character.id, 'sheet_opened', 1, () => {
    runStartup(character, 0);
  });
});

function runStartup(character, retryCount) {
  const version = roll20.getAttrByName(character.id, 'version', 'current', true);
  const ed = new EventDispatcher(roll20, errorHandler, logger, reporter);
  const cw = new ChatWatcher(roll20, logger, ed);
  const commandProc = makeCommandProc('shaped', roll20, errorHandler, ed, version, logger);
  if (!version) {
    if (retryCount > 4) {
      const error = 'Couldn\'t find Shaped Character Sheet. This Shaped Companion Script requires the Shaped ' +
        'Character Sheet to be installed in the campaign.';
      reporter.reportError(error);
      logger.error(error);
      commandProc.setDefaultCommandHandler(() => reporter.reportError(error));
      return;
    }

    logger.debug(`No version attribute found yet, delaying for another 4 seconds. Retry count ${retryCount}`);
    _.delay(runStartup.bind(null, character, ++retryCount), 4000);
    return;
  }
  const sheetAPIVersion = roll20.getAttrByName(character.id, 'script_compatibility_version');
  logger.info('Detected sheet version as : $$$', version);

  if (Utils.versionCompare(version, MINIMUM_SHEET_VERSION) < 0) {
    const error = `Incompatible sheet version ${version}. You need at least version ${MINIMUM_SHEET_VERSION} to ` +
      'use this script. Please install an updated sheet.';
    reporter.reportError(error);
    logger.error(error);
    commandProc.setDefaultCommandHandler(() => reporter.reportError(error));
    return;
  }


  if (SHEET_API_VERSION !== sheetAPIVersion) {
    const error = 'WARNING: Character sheet has been updated with breaking changes that this version of the ' +
      'Companion Script does not yet support. Some features may not work as expected. Please check for an ' +
      'updated version of the script.';
    reporter.reportError(error);
    logger.error(error);
  }

  const sc = new ShapedConfig({ roll20, reporter, logger, myState });
  sc.configure(commandProc, cw, ed);
  sc.runStartupSequence(commandProc, () => {
    commandProc.setDefaultCommandHandler(cmd =>
      reporter.reportError(`Unknown command ${cmd}`));
    moduleList.forEach(module => module.configure(commandProc, cw, ed));
    _.invoke(roll20.findObjs({ type: 'character', name: 'SHAPED_VERSION_TESTER' }), 'remove');
  });
}

module.exports = {
  addEntities(entities) {
    const elrr = new EntityLookupResultReporter(logger, reporter);
    try {
      if (typeof entities === 'string') {
        entities = JSON.parse(entities);
      }

      entityLookup.addEntities(entities, elrr);
    }
    catch (e) {
      reporter.reportError('JSON parse error, please see log for more information');
      logger.error(e.toString());
      logger.error(e.stack);
    }
  },
};

function getModuleList() {
  const deps = {
    roll20,
    reporter,
    logger,
    myState,
    parseModule,
    srdConverter,
    entityLookup,
  };


  return []
    .concat(new SheetWorkerChatOutput(deps))
    .concat(new AbilityMaker(deps))
    .concat(new EntityLister(deps))
    .concat(new Importer(deps))
    .concat(new SpellManager(deps))
    .concat(new NewCharacterConfigurer(deps))
    .concat(new ConfigUI(deps))
    .concat(new AdvantageTracker(deps))
    .concat(new UsesManager(deps))
    .concat(new RestManager(deps))
    .concat(new AmmoManager(deps))
    .concat(new MonsterManager(deps))
    .concat(new DeathSaveManager(deps))
    .concat(new HDManager(deps))
    .concat(new FXManager(deps));
}
