'use strict';
const ShapedModule = require('./../shaped-module');
const _ = require('underscore');

module.exports = class FXManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['fx', 'character'], this.handleFX.bind(this));
  }

  handleFX(options, msg) {
    const parts = options.fx.split(' ');
    if (parts.length < 2 || _.some(parts.slice(0, 2), _.isEmpty)) {
      this.logger.warn('FX roll template variable is not formated correctly: [$$$]', options.fx);
      return;
    }


    const fxType = parts[0];
    const pointsOfOrigin = parts[1];
    let targetTokenId;
    const sourceCoords = {};
    const targetCoords = {};
    let fxCoords = [];
    let pageId;

    // noinspection FallThroughInSwitchStatementJS
    switch (pointsOfOrigin) {
      case 'sourceToTarget':
      case 'source':
        targetTokenId = parts[2];
        fxCoords.push(sourceCoords, targetCoords);
        break;
      case 'targetToSource':
      case 'target':
        targetTokenId = parts[2];
        fxCoords.push(targetCoords, sourceCoords);
        break;
      default:
        throw new Error(`Unrecognised pointsOfOrigin type in fx spec: ${pointsOfOrigin}`);
    }

    if (targetTokenId) {
      const targetToken = this.roll20.getObj('graphic', targetTokenId);
      pageId = targetToken.get('_pageid');
      targetCoords.x = targetToken.get('left');
      targetCoords.y = targetToken.get('top');
    }
    else {
      pageId = this.roll20.getCurrentPage(msg.playerid).id;
    }


    const casterTokens = this.roll20.findObjs({ type: 'graphic', pageid: pageId, represents: options.character.id });

    if (casterTokens.length) {
      // If there are multiple tokens for the character on this page, then try and find one of them that is selected
      // This doesn't work without a selected token, and the only way we can get this is to use @{selected} which is a
      // pain for people who want to launch without a token selected if(casterTokens.length > 1) { const selected =
      // _.findWhere(casterTokens, {id: sourceTokenId}); if (selected) { casterTokens = [selected]; } }
      sourceCoords.x = casterTokens[0].get('left');
      sourceCoords.y = casterTokens[0].get('top');
    }


    if (!fxCoords[0]) {
      this.logger.warn('Couldn\'t find required point for fx for character $$$, casterTokens: $$$, fxSpec: $$$ ',
        options.character.id, casterTokens, options.fx);
      return;
    }
    else if (!fxCoords[1]) {
      fxCoords = fxCoords.slice(0, 1);
    }

    this.roll20.spawnFx(fxCoords, fxType, pageId);
  }
};

