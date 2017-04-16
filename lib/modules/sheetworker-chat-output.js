'use strict';
const ShapedModule = require('./../shaped-module');

module.exports = class SheetWorkerChatOutput extends ShapedModule {
  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerAttributeChangeHandler('sheet_chat_output', this.displaySheetChatOutput.bind(this));
  }

  displaySheetChatOutput(chatAttr, prev, characterId, additionalOutput) {
    this.logger.debug('Chat output received: $$$', chatAttr);
    const sheetOutput = (chatAttr && chatAttr.get('current')) || '';
    characterId = characterId || chatAttr.get('characterid');
    additionalOutput = additionalOutput || '';
    const text = `${sheetOutput}${additionalOutput}`;
    if (text && text.length > 0) {
      const templateText = `&{template:5e-shaped} ${text}`;
      this.reporter.sendCharacter(characterId, templateText);
      if (chatAttr) {
        chatAttr.set('current', '');
      }
    }
  }
};
