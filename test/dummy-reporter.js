'use strict';


class Reporter {
  constructor() {
    this.messages = [];
  }

  // noinspection JSUnusedGlobalSymbols
  reportPlayer(title, message) {
    this.messages.push(`${title}:${message}`);
  }

  reportPublic(title, message) {
    this.reportPlayer(title, message);
  }

  setPlayer() {
  }

  // noinspection JSUnusedGlobalSymbols
  reportError(message) {
    this.messages.push(message);
  }
}

module.exports = Reporter;
