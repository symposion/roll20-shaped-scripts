/* globals unescape */
'use strict';
const ShapedModule = require('./../shaped-module');
const _ = require('underscore');
const Logger = require('roll20-logger');

class Importer extends ShapedModule {

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

      return newPromise;
    }
    return initialPromise;
  }
}

module.exports = Importer;
