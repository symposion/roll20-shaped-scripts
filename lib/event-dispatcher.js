'use strict';
/* globals GroupInitiative: false */
const _ = require('underscore');

module.exports = class EventDispatcher {

  constructor(roll20, errorHandler, logger) {
    this.roll20 = roll20;
    this.addedTokenIds = [];
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.addTokenListeners = [];
    this.attributeChangeHandlers = {};
    this.turnOrderChangeListeners = [];
    logger.wrapModule(this);
    roll20.on('add:token', this.handleAddToken.bind(this));
    roll20.on('change:token', this.handleChangeTokenForAdd.bind(this));
    roll20.on('change:campaign:turnorder', (obj, prev) => {
      const prevOrder = JSON.parse(prev.turnorder);
      const objOrder = JSON.parse(obj.get('turnorder'));

      if (_.isArray(prevOrder) && _.isArray(objOrder) && prevOrder.length && objOrder.length &&
        objOrder[0].id !== prevOrder[0].id) {
        this.handleTurnOrderChange();
      }
    });
    if (typeof GroupInitiative !== 'undefined' && GroupInitiative.ObserveTurnOrderChange) {
      /* eslint-disable new-cap */
      // noinspection JSUnresolvedFunction
      GroupInitiative.ObserveTurnOrderChange(this.handleTurnOrderChange.bind(this));
      /* eslint-enable new-cap */
    }
    roll20.on('chat:message', (msg) => {
      if (msg.type === 'api' && msg.content === '!eot') {
        _.defer(this.handleTurnOrderChange.bind(this));
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
    }
  }

  handleTurnOrderChange() {
    const turnOrderString = this.roll20.getCampaign().get('turnorder');
    const turnOrder = _.isEmpty(turnOrderString) ? [] : JSON.parse(turnOrderString);
    this.turnOrderChangeListeners.forEach(listener => listener(turnOrder));
  }

  registerEventHandler(eventType, handler) {
    switch (eventType) {
      case 'add:token':
        this.addTokenListeners.push(this.wrapHandler(handler));
        break;
      case 'change:campaign:turnorder':
        this.turnOrderChangeListeners.push(this.wrapHandler(handler));
        break;
      default:
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
