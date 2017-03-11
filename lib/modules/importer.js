/* globals unescape */
'use strict';
const ShapedModule = require('./../shaped-module');
const _ = require('underscore');
const Logger = require('roll20-logger');

class Importer extends ShapedModule {

  fixRoll20Brokenness(character) {
    _.chain(this.roll20.findObjs({ characterid: character.id, type: 'attribute' }))
      .groupBy(attr => attr.get('name'))
      .pick(attrGroup => attrGroup.length > 1)
      .each((attrGroup) => {
        this.logger.warn('Found duplicate attributes from character $$$: $$$', character.get('name'),
          attrGroup.map(attr => [attr.get('name'), attr.get('current'), attr.get('max'), attr.id]));
        attrGroup.reduce((previous, attr) => {
          if (attr.get('current')) {
            previous.setWithWorker({ current: attr.get('current') });
          }
          else if (attr.get('max')) {
            previous.setWithWorker({ max: attr.get('max') });
          }
          attr.remove();
          return previous;
        });
      });
    return character;
  }

  runImportStage(character, attributes, name, msgStreamer) {
    const initialPromise = Promise.resolve(character);
    if (!_.isEmpty(attributes)) {
      this.logger.debug('Importing attributes for stage $$$: $$$', name, attributes);
      msgStreamer.stream(name);
      this.logger.debug(`${name} start`);
      if (this.logger.getLogLevel() >= Logger.levels.DEBUG) {
        this.logger.debug('Character attributes at start: $$$',
          this.roll20.findObjs({ type: 'attribute', characterid: character.id }));
      }

      const newPromise = new Promise(resolve => this.roll20.onSheetWorkerCompleted(() => {
        this.logger.debug(`Sheet worker completed for ${name}`);
        resolve(character);
      }));
      _.each(attributes, (attrVal, attrName) => {
        this.roll20.setAttrWithWorker(character.id, attrName, attrVal);
      });

      return newPromise.then(newChar => this.fixRoll20Brokenness(newChar));
    }
    return initialPromise;
  }
}

module.exports = Importer;
