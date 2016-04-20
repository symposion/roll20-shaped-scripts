'use strict';


class UserError extends Error {
  constructor(message) {
    // noinspection JSUnusedGlobalSymbols
    this.message = message;
  }
}

module.exports = UserError;
