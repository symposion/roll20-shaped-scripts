'use strict';

function chainer() {
  return this;
}

module.exports = {
  addCommand: chainer,
  options: chainer,
  option: chainer,
  withSelection: chainer,
  optionLookup: chainer,
};
