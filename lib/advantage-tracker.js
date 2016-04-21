'use strict';
const _ = require('underscore');
const utils = require('./utils.js');

const advantageMarker = 'green';
const disadvantageMarker = 'red';

const ignoreNpc = false;

const rollOptions = {
  normal: {
    rollSetting: '@{roll_1}',
    message: 'normally',
    rollInfo: '',
    preroll: '',
    postroll: ''
  },
  advantage: {
    rollSetting: '@{roll_advantage}',
    message: 'with advantage',
    rollInfo: '{{advantage=1}}',
    preroll: 2,
    postroll: 'kh1'
  },
  disadvantage: {
    rollSetting: '@{roll_disadvantage}',
    message: 'with disadvantage',
    rollInfo: '{{disadvantage=1}}',
    preroll: 2,
    postroll: 'kl1'
  },
  roll2: {
    rollSetting: '@{roll_2}',
    message: 'two dice',
    rollInfo: '',
    preroll: '',
    postroll: '',
  },
};

class AdvantageTracker {

  constructor(logger, myState, roll20) {
    this.logger = logger;
    this.myState = myState;
    this.roll20 = roll20;
  }

  handleRollOptionChange(msg) {
    let char = [];
    char.push(msg.get('_characterid'));
    let br = this.buildResources(_.uniq(_.union(char)));

    this.setStatusMarkers(br[0].tokens, '@{roll_advantage}' === msg.get('current'), '@{roll_disadvantage}' === msg.get('current'));
  }

  handleTokenChange(token) {
    this.logger.debug('AT: Updating New Token');
    if (this.shouldShowMarkers() && token.get('represents') !== '') {

      let character = roll20.getObj('character', token.get('represents'));
      let setting = roll20.getAttrByName(character.id, 'roll_setting');

      if (this.shouldIgnoreNpcs()) {
        if (roll20.getAttrByName(character.id, 'is_npc') === '1') {
          return;
        }
      }

      token.set('status_' + disadvantageMarker, '@{roll_disadvantage}' === setting);
      token.set('status_' + advantageMarker, '@{roll_advantage}' === setting);
    }
  }

  buildResources(characterIds) {
    return _.chain(characterIds)
      .map((charId) => {
        return roll20.getObj('character', charId);
      })
      .reject(_.isUndefined)
      .map((character) => {
        return {
          character: character,
          tokens: roll20.filterObjs((obj) => {
            return 'graphic' === obj.get('_type') &&
              character.id === obj.get('represents');
          })
        };
      })
      .value();
  }

  setStatusMarkers(tokens, showAdvantage, showDisadvantage) {
    if (this.shouldShowMarkers()) {
      _.each(tokens, (token) => {
        token.set(`status_${advantageMarker}`, showAdvantage);
        token.set(`status_${disadvantageMarker}`, showDisadvantage);
      });
    }
  }

  setRollOption(type, selectedChars) {
    let resources = this.buildResources(_.chain(selectedChars).map(c => c.get('_id')).value());

    _.each(resources, (resource) => {
      let charId = resource.character.get('_id');

      this.setStatusMarkers(resources.token, 'advantage' === type, 'disadvantage' === type);

      if (roll20.getAttrByName(charId, 'roll_setting') === rollOptions[type].rollSetting) {
        return;
      }

      roll20.setAttrByName(charId, 'roll_setting', rollOptions[type].rollSetting);
      roll20.setAttrByName(charId, 'roll_info', rollOptions[type].rollInfo);
      roll20.setAttrByName(charId, 'preroll', rollOptions[type].preroll);
      roll20.setAttrByName(charId, 'postroll', rollOptions[type].postroll);

      roll20.sendChat('Shaped AdvantageTracker',
        ` &{template:5e-shaped} {{character_name=${resource.character.get('name')}}} @{${resource.character.get('name')}` +
        `|show_character_name} {{title=${utils.toTitleCase(type)}}} {{text_top=${resource.character.get('name')}` +
        ` is rolling ${rollOptions[type].message}!}}`);
    });
  }

  shouldShowMarkers() {
    return this.myState.config.advTrackerSettings.showMarkers;
  }

  shouldIgnoreNpcs() {
    // TODO: Make this a config option
    return ignoreNpc;
  }
}

module.exports = AdvantageTracker;