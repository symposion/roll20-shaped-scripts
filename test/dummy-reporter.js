'use strict';
const _ = require('underscore');

class Reporter {
  constructor() {
    this.messages = [];
    this.errors = [];
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

  getMessageStreamer() {
    return {
      stream: _.noop,
      finish: _.noop,
    };
  }

  // noinspection JSUnusedGlobalSymbols
  reportError(message) {
    this.errors.push(message);
  }
}

module.exports = Reporter;
