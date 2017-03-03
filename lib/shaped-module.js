'use strict';

module.exports = class ShapedModule {

  configure(roll20, reporter, logger, myState, commandProcessor, chatWatcher, eventDispatcher) {
    this.roll20 = roll20;
    this.reporter = reporter;
    this.logger = logger;
    this.myState = myState;
    logger.wrapModule(this);
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
};
