'use strict';
const _ = require('underscore');

module.exports = class EventDispatcher {

  constructor(roll20, errorHandler, logger, reporter) {
    this.roll20 = roll20;
    this.addedTokenIds = [];
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.reporter = reporter;
    this.addTokenListeners = [];
    this.attributeChangeHandlers = {};
    logger.wrapModule(this);
    roll20.on('add:token', this.handleAddToken.bind(this));
    roll20.on('change:token', this.handleChangeTokenForAdd.bind(this));
    roll20.on('chat:message', (msg) => {
      if (msg.playerid !== 'API') {
        reporter.setPlayer(msg.playerid);
      }
    });
    roll20.on('change:attribute', (curr, prev) => {
      (this.attributeChangeHandlers[curr.get('name')] || []).forEach(handler => handler(curr, prev));
    });
  }

  /////////////////////////////////////////////////
  // Event Handlers
  /////////////////////////////////////////////////
  handleAddToken(token) {
    const represents = token.get('represents');
    if (_.isEmpty(represents)) {
      return;
    }
    const character = this.roll20.getObj('character', represents);
    if (!character) {
      return;
    }
    this.addedTokenIds.push(token.id);

    // URGH. Thanks Roll20.
    setTimeout(() => {
      const addedToken = this.roll20.getObj('graphic', token.id);
      if (addedToken) {
        this.handleChangeTokenForAdd(addedToken);
      }
    }, 100);
  }

  handleChangeTokenForAdd(token) {
    if (_.contains(this.addedTokenIds, token.id)) {
      this.addedTokenIds = _.without(this.addedTokenIds, token.id);
      this.addTokenListeners.forEach(listener => listener(token));
      // this.setTokenBarsOnDrop(token, true);
    }
  }

  registerEventHandler(eventType, handler) {
    if (eventType === 'add:token') {
      this.addTokenListeners.push(this.wrapHandler(handler));
    }
    else {
      this.roll20.on(eventType, this.wrapHandler(handler));
    }
  }

  registerAttributeChangeHandler(attributeName, handler) {
    this.attributeChangeHandlers[attributeName] = this.attributeChangeHandlers[attributeName] || [];
    this.attributeChangeHandlers[attributeName].push(this.wrapHandler(handler));
  }

  wrapHandler(handler) {
    const self = this;
    return function handlerWrapper() {
      try {
        handler.apply(null, arguments);
      }
      catch (e) {
        self.errorHandler(e);
      }
      finally {
        self.logger.prefixString = '';
      }
    };
  }

  get logWrap() {
    return 'EventDispatcher';
  }
};
