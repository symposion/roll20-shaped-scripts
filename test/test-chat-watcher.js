/* globals describe: false, it:false, beforeEach:false, before:false */
'use strict';
const Roll20 = require('roll20-wrapper');
const ChatWatcher = require('../lib/chat-watcher');
const sinon = require('sinon');
const logger = require('./dummy-logger');
const _ = require('underscore');


describe('chat-watcher', function () {
  let roll20;
  let cw;

  beforeEach(function () {
    roll20 = new Roll20();
    cw = new ChatWatcher(roll20, logger, { registerEventHandler: _.noop });
  });

  describe('#triggerChatWatchers', function () {
    it('trigger hd watcher', function () {
      sinon.stub(roll20);
      const characterStub = { id: 'myid' };
      roll20.findObjs.withArgs({ _type: 'character', name: 'Bob' }).returns([characterStub]);
      const msg = {
        rolltemplate: '5e-shaped',
        content: '{{uses=@{Bellaluna|hd_d10}}}{{uses_max=@{Bellaluna|hd_d10|max}}{{character_name=Bob}}' +
        '@{Bob|attacher_hit_dice}',
        inlinerolls: [{ expression: '50-2', results: { total: 48 } }],
      };
      cw.triggerChatListeners(msg);
    });
  });
});
