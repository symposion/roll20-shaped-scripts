'use strict';

const _ = require('underscore');

module.exports = class ChatWatcher {
  constructor(roll20, logger, eventDispatcher) {
    this.roll20 = roll20;
    this.logger = logger;
    this.eventDispatcher = eventDispatcher;
    this.chatListeners = [];
    logger.wrapModule(this);
    eventDispatcher.registerEventHandler('chat:message', (msg) => {
      if (msg.type !== 'api') {
        this.logger.debug('Processing message $$$', msg);
        this.triggerChatListeners(msg);
      }
    });
  }

  registerChatListener(triggerFields, handler) {
    const matchers = [];
    if (triggerFields && !_.isEmpty(triggerFields)) {
      matchers.push((msg, options) => _.intersection(triggerFields, _.keys(options)).length === triggerFields.length);
    }
    this.chatListeners.push({ matchers, handler });
  }

  triggerChatListeners(msg) {
    const options = this.getRollTemplateOptions(msg);
    this.logger.debug('Roll template options: $$$', options);
    options.playerId = msg.playerid;
    options.whisper = msg.type === 'whisper';
    _.each(this.chatListeners, (listener) => {
      if (_.every(listener.matchers, matcher => matcher(msg, options))) {
        listener.handler(options);
      }
    });
  }

  /**
   *
   * @returns {*}
   */
  getRollTemplateOptions(msg) {
    if (msg.rolltemplate === '5e-shaped') {
      const regex = /\{\{(.*?)}}/g;
      let match;
      const options = {};
      while ((match = regex.exec(ChatWatcher.processInlinerolls(msg)))) {
        if (match[1]) {
          const splitAttr = match[1].split('=');
          const propertyName = splitAttr[0].replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
          options[propertyName] = splitAttr.length === 2 ? splitAttr[1].replace(/\^\{/, '') : '';
        }
      }
      if (options.characterName) {
        options.character = this.roll20.findObjs({
          _type: 'character',
          name: options.characterName,
        })[0];
      }
      return options;
    }
    return {};
  }

  static processInlinerolls(msg) {
    if (_.has(msg, 'inlinerolls')) {
      return _.chain(msg.inlinerolls)
        .reduce((previous, current, index) => {
          previous[`$[[${index}]]`] = current.results.total || 0;
          return previous;
        }, {})
        .reduce((previous, current, index) => previous.replace(index.toString(), current), msg.content)
        .value();
    }

    return msg.content;
  }

  get logWrap() {
    return 'ChatWatcher';
  }
};
