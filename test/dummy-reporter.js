'use strict';


class Reporter {
  constructor() {
    this.messages = [];
  }

  // noinspection JSUnusedGlobalSymbols
  report(title, message) {
    this.messages.push(`${title}:${message}`);
  }

  // noinspection JSUnusedGlobalSymbols
  reportError(message) {
    this.messages.push(message);
  }
}

module.exports = Reporter;
