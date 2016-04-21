'use strict';
const _ = require('underscore');
const utils = require('./utils.js');

const rollOptions = {
  normal: {
    rollSetting: '@{roll_1}',
    message: 'normally',
    rollInfo: '',
    preroll: '',
    postroll: '',
  },
  advantage: {
    rollSetting: '@{roll_advantage}',
    message: 'with advantage',
    rollInfo: '{{advantage=1}}',
    preroll: 2,
    postroll: 'kh1',
  },
  disadvantage: {
    rollSetting: '@{roll_disadvantage}',
    message: 'with disadvantage',
    rollInfo: '{{disadvantage=1}}',
    preroll: 2,
    postroll: 'kl1',
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
    const char = [];
    char.push(msg.get('_characterid'));
    const br = this.buildResources(_.uniq(_.union(char)));

    this.setStatusMarkers(br[0].tokens,
      msg.get('current') === '@{roll_advantage}',
      msg.get('current') === '@{roll_disadvantage}');
  }

  handleTokenChange(token) {
    this.logger.debug('AT: Updating New Token');
    if (this.shouldShowMarkers() && token.get('represents') !== '') {
      const character = this.roll20.getObj('character', token.get('represents'));
      const setting = this.roll20.getAttrByName(character.id, 'roll_setting');

      if (this.shouldIgnoreNpcs()) {
        if (this.roll20.getAttrByName(character.id, 'is_npc') === '1') {
          return;
        }
      }

      token.set(`status_${this.disadvantageMarker()}`, setting === '@{roll_disadvantage}');
      token.set(`status_${this.advantageMarker()}`, setting === '@{roll_advantage}');
    }
  }

  buildResources(characterIds) {
    return _.chain(characterIds)
      .map((charId) => this.roll20.getObj('character', charId))
      .reject(_.isUndefined)
      .map((char) => ({
        character: char,
        tokens: this.roll20.filterObjs((obj) => obj.get('_type') === 'graphic' && char.id === obj.get('represents')),
      }))
      .value();
  }

  setStatusMarkers(tokens, showAdvantage, showDisadvantage) {
    if (this.shouldShowMarkers()) {
      _.each(tokens, (token) => {
        token.set(`status_${this.advantageMarker()}`, showAdvantage);
        token.set(`status_${this.disadvantageMarker()}`, showDisadvantage);
      });
    }
  }

  setRollOption(type, selectedChars) {
    const resources = this.buildResources(_.chain(selectedChars).map(c => c.get('_id')).value());

    _.each(resources, (resource) => {
      const charId = resource.character.get('_id');

      this.setStatusMarkers(resource.tokens, type === 'advantage', type === 'disadvantage');

      if (this.roll20.getAttrByName(charId, 'roll_setting') === rollOptions[type].rollSetting) {
        return;
      }

      this.roll20.setAttrByName(charId, 'roll_setting', rollOptions[type].rollSetting);
      this.roll20.setAttrByName(charId, 'roll_info', rollOptions[type].rollInfo);
      this.roll20.setAttrByName(charId, 'preroll', rollOptions[type].preroll);
      this.roll20.setAttrByName(charId, 'postroll', rollOptions[type].postroll);

      this.roll20.sendChat('Shaped AdvantageTracker',
        ` &{template:5e-shaped} {{character_name=${resource.character.get('name')}}} ` +
        `@{${resource.character.get('name')}` +
        `|show_character_name} {{title=${utils.toTitleCase(type)}}} ` +
        `{{text_top=${resource.character.get('name')}` +
        ` is rolling ${rollOptions[type].message}!}}`);
    });
  }

  shouldShowMarkers() {
    return this.myState.config.advTrackerSettings.showMarkers;
  }

  shouldIgnoreNpcs() {
    return this.myState.config.advTrackerSettings.ignoreNpcs;
  }

  advantageMarker() {
    return this.myState.config.advTrackerSettings.advantageMarker;
  }

  disadvantageMarker() {
    return this.myState.config.advTrackerSettings.disadvantageMarker;
  }
}

module.exports = AdvantageTracker;
