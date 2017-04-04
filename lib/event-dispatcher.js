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
    this.initPageListeners = [];
    logger.wrapModule(this);
    roll20.on('add:token', this.handleAddToken.bind(this));
    roll20.on('change:token', this.handleChangeTokenForAdd.bind(this));
    roll20.on('change:campaign:turnorder', (obj, prev) => {
      this.handleTurnOrderChange(obj.get('turnorder'), prev.turnorder);
    });
    roll20.on('change:campaign:initiativepage', (obj) => {
      this.initPageListeners.forEach(listener => listener(obj.get('initiativepage')));
    });
    if (typeof GroupInitiative !== 'undefined' && GroupInitiative.ObserveTurnOrderChange) {
      /* eslint-disable new-cap */
      // noinspection JSUnresolvedFunction
      GroupInitiative.ObserveTurnOrderChange(this.handleGroupInitTurnOrderChange.bind(this));
      /* eslint-enable new-cap */
    }
    if (typeof TurnMarker !== 'undefined') {
      roll20.on('chat:message', (msg) => {
        if (msg.type === 'api' && msg.content === '!eot') {
          const turnOrder = roll20.getCampaign().get('turnorder');
          _.defer(this.handleTurnOrderChange.bind(this, turnOrder));
        }
      });
    }
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

  handleTurnOrderChange(current, prev) {
    const prevOrder = prev ? JSON.parse(prev) : [];
    const currentOrder = current ? JSON.parse(current) : [];
    this.logger.debug('Turn order change, $$$, $$$', currentOrder, prevOrder);
    if (currentOrder.length > 0 &&
      (prevOrder.length === 0 || currentOrder[0].id !== prevOrder[0].id)) {
      this.turnOrderChangeListeners.forEach(listener => listener(currentOrder));
    }
  }

  handleGroupInitTurnOrderChange(current, prev) {
    this.handleTurnOrderChange(current, prev);
    if (current && current === '[]' && this.roll20.getCampaign().get('initiativepage') === false) {
      this.initPageListeners.forEach(listener => listener(false));
    }
    else if (prev && prev === '[]') {
      _.defer(() => {
        const initPage = this.roll20.getCampaign().get('initiativepage');
        if (initPage !== false) {
          this.initPageListeners.forEach(listener => listener(initPage));
        }
      });
    }
  }

  registerEventHandler(eventType, handler) {
    switch (eventType) {
      case 'add:token':
        this.addTokenListeners.push(this.wrapHandler(handler));
        break;
      case 'change:campaign:turnorder':
        this.turnOrderChangeListeners.push(this.wrapHandler(handler));
        break;
      case 'change:campaign:initiativepage':
        this.initPageListeners.push(this.wrapHandler(handler));
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
        const retVal = handler.apply(null, arguments);
        if (retVal instanceof Promise) {
          retVal.catch(self.errorHandler);
        }
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
