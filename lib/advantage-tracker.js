'use strict';
const _ = require('underscore');
const utils = require('./utils.js');

const advantageMarker = 'green';
const disadvantageMarker = 'red';

const ignoreNpc = false;

class AdvantageTracker {

  constructor(logger, myState, roll20) {
    this.logger = logger || utils.missingParam('logger');
    this.myState = myState || utils.missingParam('myState');
    this.roll20 = roll20 || utils.missingParam('roll20');
  }

  getSelectedCharacters(selected) {
    return selected.map(s => s.get('_id'));
  }

  updateSetting(msg) {
    this.logger.debug('AT: Updating Setting');
    const char = [];
    char.push(msg.get('_characterid'));
    const br = this.buildResources(_.uniq(_.union(char)));
    const setting = msg.get('current');
    const isAdvantage = setting === '@{roll_advantage}';
    const isDisadvantage = setting === '@{roll_disadvantage}';

    if (this.myState.config.advTrackerSettings.showMarkers) {
      _.each(br[0].tokens, t => {
        t.set(`status_${disadvantageMarker}`, isDisadvantage);
        t.set(`status_${advantageMarker}`, isAdvantage);
      });
    }
  }

  updateToken(token) {
    this.logger.debug('AT: Updating New Token');
    if (!this.myState.config.advTrackerSettings.showMarkers) {
      return;
    }


    if (token.get('represents') === '') {
      return;
    }

    const character = this.roll20.getObj('character', token.get('represents'));
    const setting = this.roll20.getAttrByName(character.id, 'roll_setting');
    const isAdvantage = setting === '@{roll_advantage}';
    const isDisadvantage = setting === '@{roll_disadvantage}';

    if (ignoreNpc) {
      if (this.roll20.getAttrByName(character.id, 'is_npc') === '1') {
        return;
      }
    }

    token.set(`status_${disadvantageMarker}`, isDisadvantage);
    token.set(`status_${advantageMarker}`, isAdvantage);
  }

  buildResources(ids) {
    return _.chain(ids)
      .map(cid => this.roll20.getObj('character', cid))
      .compact()
      .map(c => ({
        character: c,
        tokens: this.roll20.filterObjs(o =>
          o.get('_type') === 'graphic' &&
          c.id === o.get('represents')
        ),
      }))
      .value();
  }

  setAttribute(options) {
    if (!options.current && options.current !== '') {
      this.roll20.log('Error setting empty value: ');// + name);
      return;
    }

    const attr = this.roll20.findObjs({
      _type: 'attribute',
      _characterid: options.characterId,
      name: options.name,
    })[0];

    if (!attr) {
      this.roll20.createObj('attribute', {
        name: options.name,
        current: options.current,
        characterid: options.characterId,
      });
    }
    else if (!attr.get('current') || attr.get('current').toString() !== options.current) {
      attr.set({
        current: options.current,
      });
    }
  }

  setMarkers(type, resources) {
    const self = this;

    let setting;
    let rollInfo = '';
    let preroll = '';
    let postroll = '';
    const valByType = {
      normal: '@{roll_1}',
      advantage: '@{roll_advantage}',
      disadvantage: '@{roll_disadvantage}',
      roll2: '@{roll_2}',
    };
    const msgByType = {
      normal: 'normally',
      advantage: 'with advantage',
      disadvantage: 'with disadvantage',
      roll2: 'two dice',
    };

    const isAdvantage = type === 'advantage';
    const isDisadvantage = type === 'disadvantage';

    _.each(resources, r => {
      if (self.myState.config.advTrackerSettings.showMarkers) {
        _.each(r.tokens, t => {
          t.set(`status_${disadvantageMarker}`, isDisadvantage);
          t.set(`status_${advantageMarker}`, isAdvantage);
        });
      }

      setting = this.roll20.getAttrByName(r.character.get('_id'), 'roll_setting');
      if (setting === valByType[type]) {
        return;
      }

      self.setAttribute({
        characterId: r.character.get('_id'),
        name: 'roll_setting',
        current: valByType[type],
      });

      if (valByType[type] === '@{roll_advantage}') {
        rollInfo = '{{advantage=1}}';
        preroll = 2;
        postroll = 'kh1';
      }
      if (valByType[type] === '@{roll_disadvantage}') {
        rollInfo = '{{disadvantage=1}}';
        preroll = 2;
        postroll = 'kl1';
      }
      self.setAttribute({
        characterId: r.character.get('_id'),
        name: 'roll_info',
        current: rollInfo,
      });
      self.setAttribute({
        characterId: r.character.get('_id'),
        name: 'preroll',
        current: preroll,
      });
      self.setAttribute({
        characterId: r.character.get('_id'),
        name: 'postroll',
        current: postroll,
      });

      this.roll20.sendChat('AdvantageTracker',
        ` &{template:5e-shaped} {{character_name=${r.character.get('name')}}} @{${r.character.get('name')}` +
        `|show_character_name} {{title=${utils.toTitleCase(type)}}} {{text_top=${r.character.get('name')}` +
        ` is rolling ${msgByType[type]}!}}`);
    });
  }
}

module.exports = AdvantageTracker;
