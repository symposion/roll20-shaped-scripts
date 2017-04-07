'use strict';

const _ = require('underscore');

module.exports = {
  error: _.noop,
  warn: _.noop,
  info: _.noop,
  debug: _.noop,
  trace: _.noop,
  wrapModule: _.noop,
  wrapFunction: _.noop,
  getLogLevel: _.constant(1),
  levels: {},
};
