'use strict';

module.exports = class ShapedModule {
  configure(roll20, reporter, logger, myState, commandProcessor) {
    this.roll20 = roll20;
    this.reporter = reporter;
    this.logger = logger;
    this.myState = myState;
    logger.wrapModule(this);
    this.addCommands(commandProcessor);
  }

  addCommands(/* commandProcessor */) {
    throw new Error('Subclasses must implement addCommands');
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
