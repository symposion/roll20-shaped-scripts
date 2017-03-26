'use strict';
const ShapedModule = require('./../shaped-module');

module.exports = class SheetWorkerChatOutput extends ShapedModule {
  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerAttributeChangeHandler('sheet_chat_output', (curr) => {
      const text = curr.get('current');
      if (text && text.length > 0) {
        this.reporter.sendCharacter(curr.get('characterid'), `&{template:5e-shaped} ${text}`);
        curr.set('current', '');
      }
    });
  }
};
