'use strict';
const _ = require('underscore');
const parseModule = require('./parser');
const makeCommandProc = require('./command-parser');
const UserError = require('./user-error');
const Migrator = require('./migrations');
// Modules
const AbilityMaker = require('./ability-maker');
const ConfigUI = require('./config-ui');
const AdvantageTracker = require('./advantage-tracker');
const RestManager = require('./rest-manager');
const UsesManager = require('./uses-manager');
const AmmoManager = require('./ammo-manager');
const Importer = require('./importer');
const srdConverter = require('./srd-converter');

/**
 * @typedef {Object} ChatMessage
 * @property {string} content
 * @property {string} type
 * @property {SelectedItem[]} selected
 * @property {string} rolltemplate
 */


/**
 *
 * @typedef {Object} SelectedItem
 * @property {string} _id
 * @property (string _type
 */


module.exports = ShapedScripts;

function ShapedScripts(logger, myState, roll20, parser, entityLookup, reporter) {
  let addedTokenIds = [];
  const reportPublic = reporter.reportPublic.bind(reporter);
  const reportError = reporter.reportError.bind(reporter);
  const commandProc = makeCommandProc('shaped', roll20);
  const chatWatchers = [];
  const advantageTracker = new AdvantageTracker();
  const usesManager = new UsesManager();
  const ammoManager = new AmmoManager();
  const abilityMaker = new AbilityMaker();
  const importer = new Importer(entityLookup, parser, abilityMaker, srdConverter);
  const errorHandler = function errorHandler(e) {
    if (typeof e === 'string' || e instanceof parseModule.ParserError || e instanceof UserError) {
      reportError(e);
      logger.error('Error: $$$', e.toString());
    }
    else {
      logger.error(e.toString());
      logger.error(e.stack);
      reportError('An error occurred. Please see the log for more details.');
    }
  };
  const modules = [
    abilityMaker,
    new ConfigUI(),
    advantageTracker,
    usesManager,
    new RestManager(),
    ammoManager,
    importer,
  ];

  modules.forEach(module => module.configure(roll20, reporter, logger, myState, errorHandler, commandProc));

  /**
   *
   * @param {ChatMessage} msg
   */
  this.handleInput = function handleInput(msg) {
    logger.debug(msg);
    if (msg.playerid === 'API') {
      return;
    }

    reporter.setPlayer(msg.playerid);
    if (msg.type !== 'api') {
      this.triggerChatWatchers(msg);
      return;
    }

    commandProc.processCommand(msg);
  };

  /////////////////////////////////////////////////
  // Event Handlers
  /////////////////////////////////////////////////
  this.handleAddToken = function handleAddToken(token) {
    const represents = token.get('represents');
    if (_.isEmpty(represents)) {
      return;
    }
    const character = roll20.getObj('character', represents);
    if (!character) {
      return;
    }
    addedTokenIds.push(token.id);

    const wrappedChangeToken = this.wrapHandler(this.handleChangeToken);

    // URGH. Thanks Roll20.
    setTimeout((function wrapper(id) {
      return function innerWrapper() {
        const addedToken = roll20.getObj('graphic', id);
        if (addedToken) {
          wrappedChangeToken(addedToken);
        }
      };
      /* eslint-disable no-spaced-func */
    }(token.id)), 100);
    /* eslint-enable no-spaced-func */
  };

  this.handleChangeToken = function handleChangeToken(token) {
    if (_.contains(addedTokenIds, token.id)) {
      addedTokenIds = _.without(addedTokenIds, token.id);
      this.setTokenBarsOnDrop(token, true);
      advantageTracker.handleTokenChange(token);
    }
  };

  this.handleAddCharacter = function handleAddCharacter(character) {
    if (myState.config.newCharSettings.applyToAll) {
      importer.applyCharacterDefaults(character);
    }
  };

  this.setTokenBarsOnDrop = function setTokenBarsOnDrop(token, overwrite) {
    const character = roll20.getObj('character', token.get('represents'));
    if (!character) {
      return;
    }

    function setBar(barName, bar, value) {
      if (value) {
        token.set(`${barName}_value`, value);
        if (bar.max) {
          token.set(`${barName}_max`, value);
        }
      }
    }

    _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .each((bar, barName) => {
        if (bar.attribute && !token.get(`${barName}_link`) && (!token.get(`${barName}_value`) || overwrite)) {
          if (bar.attribute === 'HP' && myState.config.sheetEnhancements.rollHPOnDrop) {
            // Guard against characters that aren't properly configured - i.e. ones used for templates and system
            // things rather than actual characters
            if (_.isEmpty(roll20.getAttrByName(character.id, 'hp_formula'))) {
              logger.debug('Ignoring character $$$ for rolling HP - has no hp_formula attribute',
                character.get('name'));
              return;
            }
            roll20.sendChat('', `%{${character.get('name')}|shaped_npc_hp}`, (results) => {
              if (results && results.length === 1) {
                const message = this.processInlinerolls(results[0]);
                if (!results[0].inlinerolls || !results[0].inlinerolls[0]) {
                  logger.warn('HP roll didn\'t have the expected structure. This is what we got back: $$$',
                    results[0]);
                }
                else {
                  roll20.sendChat('HP Roller', `/w GM &{template:5e-shaped} ${message}`, null, { noarchive: true });
                  setBar(barName, bar, results[0].inlinerolls[0].results.total);
                }
              }
            });
          }
          else {
            setBar(barName, bar, roll20.getAttrByName(character.id, bar.attribute));
          }
        }
      });
  };

  this.registerChatWatcher = function registerChatWatcher(handler, triggerFields) {
    const matchers = [];
    if (triggerFields && !_.isEmpty(triggerFields)) {
      matchers.push((msg, options) => {
        logger.debug('Matching options: $$$ against triggerFields $$$', options, triggerFields);
        return _.intersection(triggerFields, _.keys(options)).length === triggerFields.length;
      });
    }
    chatWatchers.push({ matchers, handler: handler.bind(this) });
  };

  this.triggerChatWatchers = function triggerChatWatchers(msg) {
    const options = this.getRollTemplateOptions(msg);
    logger.debug('Roll template options: $$$', options);
    _.each(chatWatchers, (watcher) => {
      if (_.every(watcher.matchers, matcher => matcher(msg, options))) {
        watcher.handler(options, msg);
      }
    });
  };

  this.handleHD = function handleHD(options, msg) {
    const match = options.title.match(/(\d+)d(\d+) HIT_DICE/);
    if (match && myState.config.sheetEnhancements.autoHD) {
      const hdCount = parseInt(match[1], 10);
      const hdSize = match[2];
      const hdAttr = roll20.getAttrObjectByName(options.character.id, `hd_d${hdSize}`);
      const hpAttr = roll20.getOrCreateAttr(options.character.id, 'HP');
      const newHp = Math.min(parseInt(hpAttr.get('current') || 0, 10) +
        this.getRollValue(msg, options.roll1), hpAttr.get('max') || Infinity);

      if (hdAttr) {
        if (hdCount <= hdAttr.get('current')) {
          hdAttr.setWithWorker('current', hdAttr.get('current') - hdCount);
          hpAttr.setWithWorker('current', newHp);
          if (!hpAttr.get('max')) {
            hpAttr.setWithWorker('max', newHp);
          }
        }
        else {
          reportPublic('HD Police', `${options.characterName} can't use ${hdCount}d${hdSize} hit dice because they ` +
            `only have ${hdAttr.get('current')} left`);
        }
      }
    }
  };

  this.handleD20Roll = function handleD20Roll(options) {
    const autoRevertOptions = roll20.getAttrByName(options.character.id, 'auto_revert_advantage');
    if (autoRevertOptions === 1) {
      advantageTracker.setRollOption('normal', [options.character]);
    }
  };

  this.handleDeathSave = function handleDeathSave(options, msg) {
    if (roll20.getAttrByName(options.character.id, 'shaped_d20') === '1d20') {
      return;
    }
    const currentHP = roll20.getAttrByName(options.character.id, 'HP');
    if (currentHP !== 0 && currentHP !== '0') {
      reportPublic('Death Saves', `${options.character.get('name')} has more than 0 HP and shouldn't be rolling death` +
        ' saves');
      return;
    }

    const successes = roll20.getAttrObjectByName(options.character.id, 'death_saving_throw_successes');
    let successCount = successes.get('current');
    const failures = roll20.getAttrObjectByName(options.character.id, 'death_saving_throw_failures');
    let failureCount = failures.get('current');
    const result = this.getRollValue(msg, options.roll1);

    switch (result) {
      case 1:
        failureCount += 2;
        break;
      case 20:
        failureCount = 0;
        successCount = 0;

        roll20.setAttrWithWorker(options.character.id, 'HP', 1);
        reportPublic('Death Saves', `${options.character.get('name')} has recovered to 1 HP`);
        break;
      default:
        if (result >= 10) {
          successCount++;
        }
        else {
          failureCount++;
        }
    }

    if (failureCount >= 3) {
      failureCount = 3;
      reportPublic('Death Saves', `${options.character.get('name')} has failed 3` +
        ' death saves and is now dead');
    }
    else if (successCount >= 3) {
      reportPublic('Death Saves', `${options.character.get('name')} has succeeded 3` +
        ' death saves and is now stable');
      failureCount = 0;
      successCount = 0;
    }
    successes.setWithWorker({ current: successCount });
    failures.setWithWorker({ current: failureCount });
  };

  this.handleFX = function handleFX(options, msg) {
    const parts = options.fx.split(' ');
    if (parts.length < 2 || _.some(parts.slice(0, 2), _.isEmpty)) {
      logger.warn('FX roll template variable is not formated correctly: [$$$]', options.fx);
      return;
    }


    const fxType = parts[0];
    const pointsOfOrigin = parts[1];
    let targetTokenId;
    const sourceCoords = {};
    const targetCoords = {};
    let fxCoords = [];
    let pageId;

    // noinspection FallThroughInSwitchStatementJS
    switch (pointsOfOrigin) {
      case 'sourceToTarget':
      case 'source':
        targetTokenId = parts[2];
        fxCoords.push(sourceCoords, targetCoords);
        break;
      case 'targetToSource':
      case 'target':
        targetTokenId = parts[2];
        fxCoords.push(targetCoords, sourceCoords);
        break;
      default:
        throw new Error(`Unrecognised pointsOfOrigin type in fx spec: ${pointsOfOrigin}`);
    }

    if (targetTokenId) {
      const targetToken = roll20.getObj('graphic', targetTokenId);
      pageId = targetToken.get('_pageid');
      targetCoords.x = targetToken.get('left');
      targetCoords.y = targetToken.get('top');
    }
    else {
      pageId = roll20.getCurrentPage(msg.playerid).id;
    }


    const casterTokens = roll20.findObjs({ type: 'graphic', pageid: pageId, represents: options.character.id });

    if (casterTokens.length) {
      // If there are multiple tokens for the character on this page, then try and find one of them that is selected
      // This doesn't work without a selected token, and the only way we can get this is to use @{selected} which is a
      // pain for people who want to launch without a token selected if(casterTokens.length > 1) { const selected =
      // _.findWhere(casterTokens, {id: sourceTokenId}); if (selected) { casterTokens = [selected]; } }
      sourceCoords.x = casterTokens[0].get('left');
      sourceCoords.y = casterTokens[0].get('top');
    }


    if (!fxCoords[0]) {
      logger.warn('Couldn\'t find required point for fx for character $$$, casterTokens: $$$, fxSpec: $$$ ',
        options.character.id, casterTokens, options.fx);
      return;
    }
    else if (!fxCoords[1]) {
      fxCoords = fxCoords.slice(0, 1);
    }

    roll20.spawnFx(fxCoords, fxType, pageId);
  };

  this.getRollValue = function getRollValue(msg, rollOutputExpr) {
    const rollIndex = rollOutputExpr.match(/\$\[\[(\d+)]]/)[1];
    return msg.inlinerolls[rollIndex].results.total;
  };

  this.handleSpellCast = function handleSpellCast(options) {
    if (options.ritual || !myState.config.sheetEnhancements.autoSpellSlots) {
      return;
    }

    const castingLevel = parseInt(options.castAsLevel, 10);
    if (_.isNaN(castingLevel)) {
      logger.error('Bad casting level [$$$]', options.castAsLevel);
      reportError('An error occured with spell slots, see the log for more details');
      return;
    }

    const spellSlotAttr = roll20.getAttrObjectByName(options.character.id, `spell_slots_l${options.castAsLevel}`);
    const warlockSlotsAttr = roll20.getAttrObjectByName(options.character.id, 'warlock_spell_slots');
    if (warlockSlotsAttr.get('current')) {
      const warlockSlotsLevelString = roll20.getAttrByName(options.character.id, 'warlock_spells_max_level');
      logger.debug('Warlock slots level: $$$', warlockSlotsLevelString);
      const warlockSlotsLevel = warlockSlotsLevelString ? parseInt(warlockSlotsLevelString.substring(0, 1), 10) : 0;
      logger.debug('Parsed warlock slots level: $$$', warlockSlotsLevel);
      if (warlockSlotsLevel === castingLevel) {
        logger.debug('Decrementing warlock spell slots attribute $$$', warlockSlotsAttr);
        warlockSlotsAttr.setWithWorker('current', warlockSlotsAttr.get('current') - 1);
        return;
      }
    }

    if (spellSlotAttr.get('current')) {
      logger.debug('Decrementing normal spell slots attribute $$$', spellSlotAttr);
      spellSlotAttr.setWithWorker('current', spellSlotAttr.get('current') - 1);
    }
    else {
      reportPublic('Slots Police', `${options.characterName} cannot cast ${options.title} at level ` +
        `${options.castAsLevel} because they don't have enough spell slots.`);
    }
  };

  /**
   *
   * @returns {*}
   */
  this.getRollTemplateOptions = function getRollTemplateOptions(msg) {
    if (msg.rolltemplate === '5e-shaped') {
      const regex = /\{\{(.*?)}}/g;
      let match;
      const options = {};
      while ((match = regex.exec(msg.content))) {
        if (match[1]) {
          const splitAttr = match[1].split('=');
          const propertyName = splitAttr[0].replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
          options[propertyName] = splitAttr.length === 2 ? splitAttr[1].replace(/\^\{/, '') : '';
        }
      }
      if (options.characterName) {
        options.character = roll20.findObjs({
          _type: 'character',
          name: options.characterName,
        })[0];
      }
      return options;
    }
    return {};
  };

  this.processInlinerolls = function processInlinerolls(msg) {
    if (_.has(msg, 'inlinerolls')) {
      return _.chain(msg.inlinerolls)
        .reduce((previous, current, index) => {
          previous[`$[[${index}]]`] = current.results.total || 0;
          return previous;
        }, {})
        .reduce((previous, current, index) => previous.replace(index.toString(), current), msg.content)
        .value();
    }

    return msg.content;
  };

  this.checkInstall = function checkInstall() {
    logger.info('-=> ShapedScripts %%GULP_INJECT_VERSION%% <=-');
    Migrator.migrateShapedConfig(myState, logger);
  };

  this.wrapHandler = function wrapHandler(handler) {
    const self = this;
    return function handlerWrapper() {
      try {
        handler.apply(self, arguments);
      }
      catch (e) {
        errorHandler(e);
      }
      finally {
        logger.prefixString = '';
      }
    };
  };

  this.updateBarsForCharacterTokens = function updateBarsForCharacterTokens(curr) {
    roll20.findObjs({ type: 'graphic', represents: curr.get('characterid') })
      .forEach(token => this.setTokenBarsOnDrop(token, false));
  };

  this.getAttributeChangeHandler = function getAttributeChangeHandler(attributeName) {
    const handlers = {
      shaped_d20: advantageTracker.handleRollOptionChange.bind(advantageTracker),
    };

    _.chain(myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .pluck('attribute')
      .each((attrName) => {
        if (attrName === 'HP') {
          attrName = 'hp_formula';
        }
        handlers[attrName] = this.updateBarsForCharacterTokens.bind(this);
      });

    return handlers[attributeName];
  };

  this.registerEventHandlers = function registerEventHandlers() {
    roll20.on('chat:message', this.wrapHandler(this.handleInput));
    roll20.on('add:token', this.wrapHandler(this.handleAddToken));
    roll20.on('change:token', this.wrapHandler(this.handleChangeToken));
    roll20.on('change:attribute', this.wrapHandler((curr, prev) => {
      const handler = this.getAttributeChangeHandler(curr.get('name'));
      if (handler) {
        handler(curr, prev);
      }
    }));
    roll20.on('add:character', this.wrapHandler(this.handleAddCharacter));
    this.registerChatWatcher(this.handleDeathSave, ['deathSavingThrow', 'character', 'roll1']);
    this.registerChatWatcher(ammoManager.consumeAmmo.bind(ammoManager), ['ammoName', 'character']);
    this.registerChatWatcher(this.handleFX, ['fx', 'character']);
    this.registerChatWatcher(this.handleHD, ['character', 'title']);
    this.registerChatWatcher(this.handleD20Roll, ['character', '2d20kh1']);
    this.registerChatWatcher(this.handleD20Roll, ['character', '2d20kl1']);
    this.registerChatWatcher(usesManager.handleUses.bind(usesManager), ['character', 'uses', 'repeatingItem']);
    this.registerChatWatcher(this.handleSpellCast, ['character', 'spell', 'castAsLevel']);
  };

  logger.wrapModule(this);
}

ShapedScripts.prototype.logWrap = 'ShapedScripts';
