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
    this.logger.debug('$$$ has no commands', this.constructor.name);
  }

  registerChatListeners(/* chatWatcher */) {
    this.logger.debug('$$$ has no chat watchers', this.constructor.name);
  }

  registerEventListeners(/* eventDispatcher */) {
    this.logger.debug('$$$ has no event listeners', this.constructor.name);
  }

  reportPublic(heading, text) {
    this.reporter.reportPublic(heading, text);
  }

  reportPlayer(heading, text) {
    this.reporter.reportPlayer(heading, text);
  }

  reportError(text) {
    this.reporter.reportError(text);
  }

  get logWrap() {
    return this.constructor.name;
  }
};
