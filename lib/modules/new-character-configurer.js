'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ChatWatcher = require('./../chat-watcher');
const ShapedConfig = require('./../shaped-config');
const Utils = require('../utils');

module.exports = class NewCharacterConfigurer extends ShapedModule {

  constructor(deps) {
    super(deps);
    this.newCharacterPromises = {};
    this.abilityMaker = deps.abilityMaker;
    this.spellManager = deps.spellManager;
  }

  addCommands(commandProcessor) {
    // !shaped-token-defaults
    return commandProcessor.addCommand(['apply-defaults'], this.applyDefaults.bind(this), false)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      });
  }

  registerEventListeners(eventDispatcher) {
    const pendingNewCharacters = {};
    eventDispatcher.registerEventHandler('add:token', this.configureNewToken.bind(this));
    eventDispatcher.registerEventHandler('add:character', (char) => {
      this.logger.debug('New character added: $$$', char);
      this.newCharacterPromises[char.id] = new Promise((resolve) => {
        pendingNewCharacters[char.id] = { resolve };
      });
    });
    eventDispatcher.registerAttributeChangeHandler('sheet_processing_complete', (attr) => {
      this.logger.debug('sheet_processing_complete change: $$$', attr.get('current'));
      const char = this.roll20.getObj('character', attr.get('characterid'));
      const pending = pendingNewCharacters[char.id];

      const resolvePending = (expandSpells) => {
        delete pendingNewCharacters[char.id];
        clearTimeout(pending.timeoutId);
        let promise = this.applyCharacterDefaults(char);

        if (expandSpells) {
          promise = promise.then(() => this.spellManager.importData(char, [], false, { stream: _.noop }));
        }
        return promise.then(pending.resolve);
      };

      switch (attr.get('current')) {
        case 'new_character':
          pending.timeoutId = _.delay(resolvePending, 2000);
          return null;
        case 'drag_from_srd':
          return resolvePending(true);
        default:
        // Noop
      }
      return null;
    });
  }


  applyDefaults(options) {
    return Promise.all(_.chain(options.selected.graphic)
      .map((token) => {
        const represents = token.get('represents');
        const character = this.roll20.getObj('character', represents);
        return character && this.configureCharacter(token, character);
      })
      .compact()
      .value())
      .then((characters) => {
        const messageBody = characters.map(character => character.get('name')).join('</li><li>');
        this.reportPlayer('Apply Defaults', `Character and token defaults applied for:<ul><li>${messageBody}</li></ul>`,
          options.playerId);
      });
  }

  configureCharacter(token, character) {
    this.logger.debug('Configuring character: $$$', character);
    return this.applyCharacterDefaults(character).then(() => {
      if (token) {
        this.configureCoreTokenSettings(token, character);
        this.setTokenBarsOnDrop(token, character);
      }
      return character;
    });
  }

  configureNewToken(token) {
    this.logger.debug('New token added: $$$', token);
    const character = this.roll20.getObj('character', token.get('represents'));
    if (!character) {
      return null;
    }

    if (this.newCharacterPromises[character.id]) {
      return this.newCharacterPromises[character.id].then(() => {
        this.configureCoreTokenSettings(token, character);
        this.setTokenBarsOnDrop(token, character);
        delete this.newCharacterPromises[character.id];
      });
    }

    this.setTokenBarsOnDrop(token, character);
    return null;
  }

  copyAvatar(token, character) {
    const imgsrc = token.get('imgsrc');
    if ((imgsrc.startsWith('https://s3.amazonaws.com/files.staging.d20.io/images/') ||
      imgsrc.startsWith('https://s3.amazonaws.com/files.d20.io/images/'))
      && imgsrc.replace(/\/[^.]+\.png/, '') !== character.get('avatar').replace(/\/[^.]+\.png/, '')) {
      const fixedImgSrc = imgsrc.match(/\?\d+$/) ? imgsrc : `${imgsrc}`;
      character.set('avatar', fixedImgSrc);
    }
  }

  configureCoreTokenSettings(token, character) {
    this.logger.debug('Configuring core token settings for character $$$', character.get('name'));
    const isNpcLiteral = this.roll20.getAttrByName(character.id, 'is_npc');
    const isNpc = (isNpcLiteral === 1 || isNpcLiteral === '1');

    token.set('represents', character.id);
    const settings = this.myState.config.tokenSettings;
    if (isNpc) {
      const name = _.isEmpty(settings.monsterTokenName) ? character.get('name') : settings.monsterTokenName;
      token.set('name', name);

      if (settings.number && !token.get('name').includes('%%NUMBERED%%')) {
        const baseName = token.get('name').replace(/(.*) \d+$/, '$1');
        token.set('name', `${baseName} %%NUMBERED%%`);
      }
    }

    _.chain(settings)
      .pick(['bar1', 'bar2', 'bar3'])
      .each((bar, barName) => {
        if (!_.isEmpty(bar.attribute)) {
          // We create attribute here to ensure we have control over the id
          const attribute = this.roll20.getOrCreateAttr(character.id, bar.attribute);
          if (attribute) {
            const value = attribute.get('current');
            const max = attribute.get('max');
            if (bar.link && !(bar.link === 'pcOnly' && isNpc)) {
              token.set(`${barName}_link`, attribute.id);
            }
            else {
              token.set(`${barName}_link`, '');
            }
            token.set(`${barName}_value`, value);
            if (bar.max) {
              token.set(`${barName}_max`, max);
            }
            token.set(`showplayers_${barName}`, bar.showPlayers);
          }
        }
      });

    // auras
    _.chain(settings)
      .pick(['aura1', 'aura2'])
      .each((aura, auraName) => {
        token.set(`${auraName}_radius`, aura.radius);
        token.set(`${auraName}_color`, aura.color);
        token.set(`${auraName}_square`, aura.square);
      });

    this.logger.debug('Settings for tokens: $$$', settings);
    token.set('showname', settings.showName);
    token.set('showplayers_name', settings.showNameToPlayers);
    token.set('showplayers_aura1', settings.showAura1ToPlayers);
    token.set('showplayers_aura2', settings.showAura2ToPlayers);
    token.set('light_radius', settings.light.radius);
    token.set('light_dimradius', settings.light.dimRadius);
    token.set('light_otherplayers', settings.light.otherPlayers);
    token.set('light_hassight', settings.light.hasSight);
    token.set('light_angle', settings.light.angle);
    token.set('light_losangle', settings.light.losAngle);
    token.set('light_multiplier', settings.light.multiplier);
    this.configureTokenVision(token, character);
    this.copyAvatar(token, character);
    this.roll20.setDefaultTokenForCharacter(character, token);
  }

  configureTokenVision(token, character) {
    function fullRadiusLightConfigurer(lightRadius) {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, lightRadius));
      token.set('light_dimradius', Math.max(token.get('light_dimradius') || 0, lightRadius));
    }

    function darkvisionLightConfigurer(lightRadius) {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, Math.round(lightRadius * 1.1666666)));
      if (!token.get('light_dimradius')) {
        token.set('light_dimradius', -5);
      }
    }

    ['blindsight', 'truesight', 'tremorsense', 'darkvision'].forEach((sense) => {
      const radius = this.roll20.getAttrByName(character.id, sense, 'current', true);
      if (radius) {
        const configureVision = (sense === 'darkvision' ? darkvisionLightConfigurer : fullRadiusLightConfigurer);
        configureVision(parseInt(radius, 10));
      }
    });
  }


  setTokenBarsOnDrop(token, character) {
    this.logger.debug('Setting token bars on drop $$$', token);

    function setBar(barName, bar, value, max) {
      if (value) {
        token.set(`${barName}_value`, value);
        if (bar.max) {
          token.set(`${barName}_max`, max || value);
        }
      }
    }

    _.chain(this.myState.config.tokenSettings)
      .pick('bar1', 'bar2', 'bar3')
      .each((bar, barName) => {
        if (bar.attribute && !token.get(`${barName}_link`)) {
          if (bar.attribute === 'HP' && this.myState.config.sheetEnhancements.rollHPOnDrop) {
            // Guard against characters that aren't properly configured - i.e. ones used for templates and system
            // things rather than actual characters
            if (_.isEmpty(this.roll20.getAttrByName(character.id, 'hp_formula', 'current', true))) {
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
            setBar(barName, bar, this.roll20.getAttrByName(character.id, bar.attribute),
              this.roll20.getAttrByName(character.id, bar.attribute, 'max'));
          }
        }
      });
  }

  applyCharacterDefaults(character) {
    const completionPromise = new Promise(resolve => this.roll20.onSheetWorkerCompleted(() => resolve(character)));
    const defaults = _.chain(Utils.flattenObject(_.omit(this.myState.config.newCharSettings, 'tokenActions')))
      .reduce((result, value, key) => {
        const attrName = ShapedConfig.configToAttributeLookup[key];
        if (attrName) {
          result[attrName] = value;
        }
        return result;
      }, {})
      .value();

    this.logger.debug('Setting character defaults $$$', defaults);

    _.each(defaults, (value, key) => {
      let attribute = this.roll20.getAttrObjectByName(character.id, key);
      if (value === '***default***' || (_.isBoolean(value) && !value)) {
        if (attribute) {
          this.logger.debug('Removing attribute $$$', key);
          attribute.removeWithWorker();
        }
      }
      else {
        if (!attribute) {
          attribute = this.roll20.createObj('attribute', { characterid: character.id, name: key });
        }
        this.logger.debug('Setting attribute $$$ to $$$', key, value);
        attribute.setWithWorker('current', _.isBoolean(value) ? 1 : value);
      }
    });

    this.createTokenActions(character);

    return completionPromise.then(() => {
      this.logger.debug('Finished setting character defaults for $$$', character.get('name'));
      _.delay(() => delete this.newCharacterPromises[character.id], 5000);
      return character;
    });
  }

  createTokenActions(character) {
    const abilityNames = _.chain(this.myState.config.newCharSettings.tokenActions)
      .omit('showRecharges')
      .map((action, actionName) => (action === true ? actionName : action))
      .compact()
      .values()
      .value();
    this.abilityMaker.addAbilitiesByName(abilityNames, character,
      this.myState.config.newCharSettings.tokenActions.showRecharges);
    return character;
  }
};
