'use strict';
const _ = require('underscore');
const utils = require('./../utils.js');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');

const rollOptions = {
  normal: {
    message: 'normally',
    shaped_d20: 'd20',
  },
  advantage: {
    message: 'with advantage',
    shaped_d20: '2d20kh1',
  },
  disadvantage: {
    message: 'with disadvantage',
    shaped_d20: '2d20kl1',
  },
  roll2: {
    message: 'two dice',
    shaped_d20: '1d20',
  },
};

class AdvantageTracker extends ShapedModule {

  addCommands(commandProcessor) {
    return commandProcessor.addCommand('at', this.process.bind(this), false)
      .option('advantage', ShapedConfig.booleanValidator)
      .option('disadvantage', ShapedConfig.booleanValidator)
      .option('normal', ShapedConfig.booleanValidator)
      .option('revert', ShapedConfig.booleanValidator)
      .option('persist', ShapedConfig.booleanValidator)
      .option('id', ShapedConfig.getCharacterValidator(this.roll20), false)
      .withSelection({
        character: {
          min: 0,
          max: Infinity,
        },
      });
  }

  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerEventHandler('add:token', this.handleTokenAdded.bind(this));
    eventDispatcher.registerAttributeChangeHandler('shaped_d20', this.handleRollOptionChange.bind(this));
  }

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', '2d20kh1'], this.handleD20Roll.bind(this));
    chatWatcher.registerChatListener(['character', '2d20kl1'], this.handleD20Roll.bind(this));
  }

  handleD20Roll(options) {
    const autoRevertOptions = this.roll20.getAttrByName(options.character.id, 'auto_revert_advantage');
    if (autoRevertOptions === 1 || autoRevertOptions === '1') {
      this.setRollOption('normal', [options.character]);
    }
  }

  process(options) {
    let type;

    // const at = new AdvantageTracker(this.logger, this.myState, this.roll20);

    if (!_.isUndefined(options.id)) {
      // if an ID is passed, overwrite any selection, and only process for the passed charId
      options.selected.character = [options.id];
    }

    if (_.isEmpty(options.selected.character)) {
      this.reportError('Advantage Tracker was called, but no token was selected, and no character id was passed.');
    }
    else {
      if (options.normal) {
        type = 'normal';
      }
      else if (options.advantage) {
        type = 'advantage';
      }
      else if (options.disadvantage) {
        type = 'disadvantage';
      }

      if (!_.isUndefined(type)) {
        this.setRollOption(type, options.selected.character);
      }

      if (options.revert) {
        this.setAutoRevert(true, options.selected.character);
      }
      else if (options.persist) {
        this.setAutoRevert(false, options.selected.character);
      }
    }
  }

  handleRollOptionChange(msg) {
    const char = [];
    char.push(msg.get('_characterid'));
    const br = this.buildResources(_.uniq(_.union(char)));

    if (!_.isEmpty(br)) {
      this.setStatusMarkers(br[0].tokens,
        msg.get('current') === rollOptions.advantage.shaped_d20,
        msg.get('current') === rollOptions.disadvantage.shaped_d20);

      switch (msg.get('current')) {
        case rollOptions.normal.shaped_d20:
          this.sendChatNotification(br[0], 'normal');
          break;
        case rollOptions.advantage.shaped_d20:
          this.sendChatNotification(br[0], 'advantage');
          break;
        case rollOptions.disadvantage.shaped_d20:
          this.sendChatNotification(br[0], 'disadvantage');
          break;
        default:
          break;
      }
    }
  }

  handleTokenAdded(token) {
    this.logger.debug('AT: Updating New Token');
    if (this.shouldShowMarkers() && token.get('represents') !== '') {
      const character = this.roll20.getObj('character', token.get('represents'));
      const setting = this.roll20.getAttrByName(character.id, 'shaped_d20');

      if (this.shouldIgnoreNpcs()) {
        if (this.roll20.getAttrByName(character.id, 'is_npc') === '1') {
          return;
        }
      }

      token.set(`status_${this.disadvantageMarker()}`, setting === rollOptions.disadvantage.shaped_d20);
      token.set(`status_${this.advantageMarker()}`, setting === rollOptions.advantage.shaped_d20);
    }
  }

  buildResources(characterIds) {
    let res = _.chain(characterIds)
      .map(charId => this.roll20.getObj('character', charId))
      .reject(_.isUndefined)
      .map(char => ({
        character: char,
        tokens: this.roll20.filterObjs(obj => obj.get('_type') === 'graphic' && char.id === obj.get('represents')),
      }))
      .value();

    if (this.shouldIgnoreNpcs()) {
      res = _.chain(res)
        .filter((c) => {
          const isNpc = this.roll20.getAttrByName(c.character.id, 'is_npc');
          return isNpc && parseInt(isNpc, 10) === 0;
        })
        .value();
    }

    return res;
  }

  setStatusMarkers(tokens, showAdvantage, showDisadvantage) {
    if (this.shouldShowMarkers()) {
      _.each(tokens, (token) => {
        token.set(`status_${this.advantageMarker()}`, showAdvantage);
        token.set(`status_${this.disadvantageMarker()}`, showDisadvantage);
      });
    }
  }

  setAutoRevert(value, selectedChars) {
    const resources = this.buildResources(_.chain(selectedChars).map(c => c.get('_id')).value());
    _.each(resources, (resource) => {
      const charId = resource.character.get('_id');
      this.roll20.setAttrByName(charId, 'auto_revert_advantage', value ? 1 : 0);
    });
  }

  setRollOption(type, selectedChars) {
    const resources = this.buildResources(_.chain(selectedChars).map(c => c.get('_id')).value());

    _.each(resources, (resource) => {
      const charId = resource.character.get('_id');

      this.setStatusMarkers(resource.tokens, type === 'advantage', type === 'disadvantage');

      if (this.roll20.getAttrByName(charId, 'shaped_d20') === rollOptions[type].shaped_d20) {
        return;
      }

      this.roll20.setAttrWithWorker(charId, 'shaped_d20', rollOptions[type].shaped_d20);

      this.sendChatNotification(resource, type);
    });
  }

  sendChatNotification(resource, type) {
    if (this.outputOption() !== 'silent') {
      let msg = ` &{template:5e-shaped} {{character_name=${resource.character.get('name')}}} ` +
        `@{${resource.character.get('name')}|show_character_name} {{title=${utils.toTitleCase(type)}}} ` +
        `{{text_top=${resource.character.get('name')} is rolling ${rollOptions[type].message}!}}`;
      if (this.outputOption() === 'whisper') {
        msg = `/w gm ${msg}`;
      }
      this.roll20.sendChat('Shaped AdvantageTracker', msg);
    }
  }

  outputOption() {
    return this.myState.config.advTrackerSettings.output;
  }

  shouldShowMarkers() {
    return this.myState.config.advTrackerSettings.showMarkers;
  }

  shouldIgnoreNpcs() {
    return this.myState.config.advTrackerSettings.ignoreNpcs;
  }

  advantageMarker() {
    return this.myState.config.advTrackerSettings.advantageMarker;
  }

  disadvantageMarker() {
    return this.myState.config.advTrackerSettings.disadvantageMarker;
  }
}

module.exports = AdvantageTracker;
