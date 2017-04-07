'use strict';

module.exports = class ShapedModule {

  constructor(deps) {
    this.roll20 = deps.roll20;
    this.reporter = deps.reporter;
    this.logger = deps.logger;
    this.myState = deps.myState;
    deps[`${this.constructor.name.charAt(0).toLowerCase()}${this.constructor.name.slice(1)}`] = this;
    deps.logger.wrapModule(this);
  }

  configure(commandProcessor, chatWatcher, eventDispatcher) {
    this.addCommands(commandProcessor);
    this.registerChatListeners(chatWatcher);
    this.registerEventListeners(eventDispatcher);
  }

  addCommands(/* commandProcessor */) {
  }

  registerChatListeners(/* chatWatcher */) {
  }

  registerEventListeners(/* eventDispatcher */) {
  }

  reportPublic(heading, text) {
    this.reporter.reportPublic(heading, text);
  }

  reportPlayer(heading, text, playerId) {
    this.reporter.reportPlayer(heading, text, playerId);
  }

  reportResult(title, text, options) {
    const reporterName = options.whisper ? 'reportPlayer' : 'reportPublic';
    this[reporterName](title, text, options.playerId);
  }

  reportCharacter(heading, text, characterId) {
    this.reporter.reportCharacter(heading, text, characterId);
  }

  reportError(text, playerId) {
    this.reporter.reportError(text, playerId);
  }

  get logWrap() {
    return this.constructor.name;
  }

  toJSON() {
    return {
      name: this.constructor.name,
    };
  }
};
