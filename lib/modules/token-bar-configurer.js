'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ChatWatcher = require('./../chat-watcher');

module.exports = class TokenBarConfigurer extends ShapedModule {

  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerEventHandler('change:attribute', (curr) => {
      const barAttributes = _.chain(this.myState.config.tokenSettings)
        .pick('bar1', 'bar2', 'bar3')
        .pluck('attribute')
        .compact()
        .map(attrName => (attrName === 'HP' ? 'hp_formula' : attrName))
        .value();

      if (_.contains(barAttributes, curr.get('name'))) {
        this.roll20.findObjs({ type: 'graphic', represents: curr.get('characterid') })
          .forEach(token => this.setTokenBarsOnDrop(token, false));
      }
    });
    eventDispatcher.registerEventHandler('add:token', token => this.setTokenBarsOnDrop(token, true));
  }

  setTokenBarsOnDrop(token, overwrite) {
    const character = this.roll20.getObj('character', token.get('represents'));
    if (!character) {
      return;
    }

    function setBar(barName, bar, value) {
      if (value) {
        token.set(`${barName}_value`, value);
        if (bar.max) {
          token.set(`${barName}_max`, value);
        }
      }
    }

    _.chain(this.myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .each((bar, barName) => {
        if (bar.attribute && !token.get(`${barName}_link`) && (!token.get(`${barName}_value`) || overwrite)) {
          if (bar.attribute === 'HP' && this.myState.config.sheetEnhancements.rollHPOnDrop) {
            // Guard against characters that aren't properly configured - i.e. ones used for templates and system
            // things rather than actual characters
            if (_.isEmpty(this.roll20.getAttrByName(character.id, 'hp_formula'))) {
              this.logger.debug('Ignoring character $$$ for rolling HP - has no hp_formula attribute',
                character.get('name'));
              return;
            }
            this.roll20.sendChat('', `%{${character.get('name')}|shaped_npc_hp}`, (results) => {
              if (results && results.length === 1) {
                const message = ChatWatcher.processInlinerolls(results[0]);
                if (!results[0].inlinerolls || !results[0].inlinerolls[0]) {
                  this.logger.warn('HP roll didn\'t have the expected structure. This is what we got back: $$$',
                    results[0]);
                }
                else {
                  this.roll20.sendChat('HP Roller', `/w GM &{template:5e-shaped} ${message}`, null,
                    { noarchive: true });
                  setBar(barName, bar, results[0].inlinerolls[0].results.total);
                }
              }
            });
          }
          else {
            setBar(barName, bar, this.roll20.getAttrByName(character.id, bar.attribute));
          }
        }
      });
  }
};
