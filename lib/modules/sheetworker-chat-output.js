'use strict';
const ShapedModule = require('./../shaped-module');

module.exports = class SheetWorkerChatOutput extends ShapedModule {
  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerAttributeChangeHandler('sheet_chat_output', this.displaySheetChatOutput.bind(this));
  }

  displaySheetChatOutput(chatAttr, additonalOutput) {
    const text = chatAttr.get('current');
    if (text && text.length > 0) {
      const characterId = chatAttr.get('characterid');
      const templateText = `&{template:5e-shaped} ${text}${additonalOutput}`;
      this.reporter.sendCharacter(characterId, templateText);
      chatAttr.set('current', '');
    }
  }
};
