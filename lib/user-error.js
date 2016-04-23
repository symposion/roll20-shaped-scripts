'use strict';


class UserError extends Error {
  constructor(message) {
    super();
    this.message = message;
  }
}

module.exports = UserError;
