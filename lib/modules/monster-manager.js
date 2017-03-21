'use strict';
const ShapedModule = require('../shaped-module');
const ShapedConfig = require('../shaped-config');
const _ = require('underscore');
const sanitise = require('../sanitise');
const Utils = require('../utils');
const JSONValidator = require('../json-validator');
const mmFormat = require('../../resources/mmFormatSpec.json');
const EntityLookup = require('../entity-lookup');
const EntityCriteriaCollector = require('../entity-criteria-collector');

function crComparer(cr1, cr2) {
  const cr1Parts = cr1.split('/');
  const cr2Parts = cr2.split('/');
  cr1 = cr1Parts[0] / (cr1Parts[1] || 1);
  cr2 = cr2Parts[0] / (cr2Parts[1] || 1);
  return cr1 - cr2;
}

function typeTransformer(type) {
  return type.replace(/([^(]+)\(.*/, '$1').replace(/^swarm.*/i, 'Swarm').trim();
}

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

module.exports = class MonsterManager extends ShapedModule {

  constructor(deps) {
    super(deps);
    this.entityLookup = deps.entityLookup;
    this.parser = deps.parseModule.getParser(mmFormat, this.logger);
    this.abilityMaker = deps.abilityMaker;
    this.srdConverter = deps.srdConverter;
    this.tokenBarConfigurer = deps.tokenBarConfigurer;
    this.entityLister = deps.entityLister;
    this.importer = deps.importer;
    this.spellManager = deps.spellManager;
    const jsonValidator = new JSONValidator(mmFormat);

    const monsterCriteria = new EntityCriteriaCollector([
      { name: 'type', transformer: typeTransformer },
      { name: 'challenge', compare: crComparer },
      { name: 'size', compare: Utils.getFixedSort(SIZES) },
    ], this.logger, this.entityLookup, 'monsters');
    this.entityLookup.configureEntity('monsters',
      [EntityLookup.jsonValidatorAsEntityProcessor(jsonValidator, ['source'])],
      EntityLookup.jsonValidatorAsVersionChecker(jsonValidator, 'monsters'));
    this.entityLister.addEntity('monsters', 'monster', monsterCriteria, this, true);
  }

  addCommands(commandProcessor) {
    // !shaped-import-statblock
    return commandProcessor.addCommand('import-statblock', this.importStatblock.bind(this), true)
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-import-monster , !shaped-monster
      .addCommand(['import-monster', 'monster'], this.importMonstersFromJson.bind(this), true)
      .optionLookup('monsters', _.partial(this.entityLookup.findEntity.bind(this.entityLookup), 'monsters', _, false),
        true)
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('relist', ShapedConfig.jsonValidator, false)
      .option('replace', ShapedConfig.booleanValidator)
      .option('as', ShapedConfig.stringValidator)
      .withSelection({
        graphic: {
          min: 0,
          max: 1,
        },
      })
      .addCommand('import-by-token', this.importByToken.bind(this), true)
      .option('overwrite', ShapedConfig.booleanValidator)
      .option('replace', ShapedConfig.booleanValidator)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      // !shaped-token-defaults
      .addCommand(['token-defaults', 'apply-defaults'], this.applyTokenDefaults.bind(this), false)
      .withSelection({
        graphic: {
          min: 1,
          max: Infinity,
        },
      })
      .addCommand('update-character', this.updateCharacter.bind(this), true)
      .withSelection({
        character: {
          min: 0,
          max: Infinity,
          anyVersion: true,
        },
      })
      .option('all', ShapedConfig.booleanValidator);
  }

  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerEventHandler('add:character', (character) => {
      if (this.myState.config.newCharSettings.applyToAll) {
        this.applyCharacterDefaults(character);
      }
    });
  }

  applyTokenDefaults(options) {
    const messageBody = _.chain(options.selected.graphic)
      .map((token) => {
        const represents = token.get('represents');
        const character = this.roll20.getObj('character', represents);
        if (character) {
          this.applyCharacterDefaults(character);
          this.createTokenActions(character);
          this.getTokenConfigurer(token)(character);
          const isNpc = this.roll20.getAttrByName(character.id, 'is_npc');
          let sensesString;
          if (isNpc === 1) {
            sensesString = this.roll20.getAttrByName(character.id, 'senses');
          }
          else {
            sensesString = ['blindsight', 'darkvision', 'tremorsense', 'truesight']
              .map(sense => [sense, this.roll20.getAttrByName(character.id, sense)])
              .filter(senseInfo => senseInfo[1])
              .map(senseInfo => `${senseInfo[0]} ${senseInfo[1]}`)
              .join(',');
          }
          this.getTokenVisionConfigurer(token, sensesString)(character);
          this.getDefaultTokenPersister(token)(character);
          return character.get('name');
        }
        return null;
      })
      .compact()
      .value()
      .join('</li><li>');

    this.reportPlayer('Apply Defaults', `Character and token defaults applied for:<ul><li>${messageBody}</li></ul>`,
      options.playerId);
  }

  importStatblock(options) {
    this.logger.info('Importing statblocks for tokens $$$', options.selected.graphic);
    _.each(options.selected.graphic, (token) => {
      const error = `Could not find GM notes on either selected token ${token.get('name')} or the character ` +
        'it represents. Have you pasted it in correctly?';
      const text = token.get('gmnotes');
      if (!text) {
        const char = this.roll20.getObj('character', token.get('represents'));
        if (char) {
          char.get('gmnotes', (notes) => {
            if (notes) {
              return this.processGMNotes(options, token, notes);
            }
            return this.reportError(error, options.playerId);
          });
        }
        else {
          return this.reportError(error, options.playerId);
        }
      }

      return this.processGMNotes(options, token, text);
    });
  }

  processGMNotes(options, token, text) {
    text = sanitise(unescape(text), this.logger);
    const monsters = this.parser.parse(text).monsters;
    return this.importMonsters(monsters, options, token, [
      function gmNotesSetter(character) {
        character.set('gmnotes', text.replace(/\n/g, '<br>'));
        return character;
      },
    ]).then(this.displayImportResults.bind(this, options.playerId));
  }

  displayImportResults(playerId, results) {
    if (!_.isEmpty(results.importedList)) {
      const monsterList = results.importedList.map(char => char.get('name')).join('</li><li>');
      this.reportPlayer('Import Success', `Added the following monsters: <ul><li>${monsterList}</li></ul>`, playerId);
    }
    if (!_.isEmpty(results.errors)) {
      const errorList = results.errors.join('</li><li>');
      this.reportError(`The following errors occurred on import:  <ul><li>${errorList}</li></ul>`, playerId);
    }
  }

  importMonstersFromJson(options) {
    return this.importMonsters(options.monsters, options, options.selected.graphic, [])
      .then(this.displayImportResults.bind(this, options.playerId));
  }

  importByToken(options) {
    const notFound = [];
    const imported = [];
    const errors = [];
    return options.selected.graphic
      .reduce((promise, token) =>
        promise.then((prevImported) => {
          if (prevImported) {
            Array.prototype.push.apply(imported, prevImported.importedList);
            Array.prototype.push.apply(errors, prevImported.errors);
          }
          const monsterName = token.get('name');
          const monster = this.entityLookup.findEntity('monsters', monsterName, true);
          if (monster) {
            return this.importMonsters([monster], options, token, []);
          }
          notFound.push(monsterName);
          return null;
        }), Promise.resolve())
      .then((prevImported) => {
        if (prevImported) {
          imported.push.apply(imported, prevImported.importedList);
          errors.push.apply(errors, prevImported.errors);
        }
        this.logger.debug('Final results: $$$', imported);
        let message = '';
        if (!_.isEmpty(imported)) {
          message += 'The following monsters were imported successfully:<ul><li>' +
            `${imported.map(monster => monster.get('name')).join('</li><li>')}</ul>`;
        }
        if (!_.isEmpty(notFound)) {
          message += 'The following monsters were not found in the database:<ul><li>' +
            `${notFound.join('</li><li>')}</li></ul>`;
        }
        if (!_.isEmpty(errors)) {
          message += 'The following errors were reported: <ul><li>  ' +
            `${errors.join('</li><li>')}</li></ul>`;
        }
        this.reportPlayer('Monster Import Complete', message, options.playerId);
      });
  }

  importMonsters(monsters, options, token, characterProcessors) {
    const characterRetrievalStrategies = [];

    if (_.size(monsters) === 1) {
      if (options.as) {
        monsters[0].name = options.as;
      }
      if (token && (options.replace || options.overwrite)) {
        characterRetrievalStrategies.push(this.getTokenRetrievalStrategy(token).bind(this));
      }
    }

    if (options.replace) {
      characterRetrievalStrategies.push(this.nameRetrievalStrategy.bind(this));
    }

    characterRetrievalStrategies.push(this.creationRetrievalStrategy.bind(this));
    characterProcessors.push(this.monsterDataPopulator.bind(this));
    characterProcessors.push(this.applyCharacterDefaults.bind(this));
    characterProcessors.push(this.createTokenActions.bind(this));

    if (token) {
      characterProcessors.push(this.getAvatarCopier(token).bind(this));
      if (_.size(monsters) === 1) {
        characterProcessors.push(this.getTokenConfigurer(token, true).bind(this));
        characterProcessors.push(this.getTokenVisionConfigurer(token, monsters[0].senses));
        characterProcessors.push(this.getTokenBarSetter(token).bind(this));
        characterProcessors.push(this.getDefaultTokenPersister(token));
      }
    }


    const errors = [];
    const importedList = [];
    return monsters
      .reduce((prevPromise, monsterData) =>
        prevPromise.then(() => {
          const character = _.reduce(characterRetrievalStrategies,
            (result, strategy) => result || strategy(monsterData.name, errors), null);

          if (!character) {
            this.logger.error('Failed to find or create character for monster $$$', monsterData.name);
            return null;
          }

          const oldAttrs = this.roll20.findObjs({ type: 'attribute', characterid: character.id });
          _.invoke(oldAttrs, 'remove');
          character.set('name', monsterData.name);

          return characterProcessors.reduce((charPromise, proc) =>
              charPromise.then(updatedChar => proc(updatedChar, monsterData))
            , Promise.resolve(character))
            .then((finishedChar) => {
              importedList.push(finishedChar);
            });
        }), Promise.resolve())
      .then(() => {
        this.logger.debug('All monsters imported $$$', importedList);
        return {
          errors,
          importedList,
        };
      });
  }

  monsterDataPopulator(character, monsterData) {
    const converted = this.srdConverter.convertMonster(monsterData);
    this.logger.debug('Converted monster data: $$$', converted);
    return this.importData(character, converted);
  }

  importData(character, data) {
    this.logger.debug('Importing new character data $$$', data);
    const msg = this.reporter.getMessageStreamer(`${character.get('name')} Import`);
    let charPromise = Promise.resolve(character);
    if (!this.roll20.getAttrByName(character.id, 'version')) {
      charPromise = this.importer.runImportStage(character, { sheet_opened: 1 }, 'Creating character', msg);
    }

    return charPromise
      .then(newChar => this.importer.runImportStage(newChar, { import_data: JSON.stringify({ npc_data: data }) },
        'Importing character data', msg))
      .then(newChar => this.spellManager.importData(newChar, [], false, msg))
      .then((newChar) => {
        msg.finish();
        return newChar;
      });
  }

  getTokenRetrievalStrategy(token) {
    return (name, errors) => {
      if (token) {
        const character = this.roll20.getObj('character', token.get('represents'));
        if (character && this.roll20.getAttrByName(character.id, 'locked')) {
          errors.push(`Character with name ${character.get('name')} and id ${character.id}` +
            ' was locked and cannot be overwritten');
          return null;
        }
        return character;
      }
      return null;
    };
  }

  nameRetrievalStrategy(name, errors) {
    const chars = this.roll20.findObjs({ type: 'character', name });
    if (chars.length > 1) {
      errors.push(`More than one existing character found with name "${name}". Can't replace`);
      return null;
    }

    if (chars[0] && this.roll20.getAttrByName(chars[0].id, 'locked')) {
      errors.push(`Character with name ${chars[0].get('name')} and id ${chars[0].id}` +
        ' was locked and cannot be overwritten');
      return null;
    }

    return chars[0];
  }

  creationRetrievalStrategy(name, errors) {
    if (!_.isEmpty(this.roll20.findObjs({ type: 'character', name }))) {
      errors.push(`Can't create new character with name "${name}` +
        '" because one already exists with that name. Perhaps you want --replace?');
      return null;
    }

    return this.roll20.createObj('character', { name });
  }

  getAvatarCopier(token) {
    return function avatarCopier(character) {
      character.set('avatar', token.get('imgsrc'));
      return character;
    };
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
    return completionPromise.then(() => {
      this.logger.debug('Finished setting character defaults for $$$', character.get('name'));
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

  getTokenConfigurer(token, monsterImport) {
    return (character) => {
      const isNpcLiteral = this.roll20.getAttrByName(character.id, 'is_npc');
      const isNpc = (isNpcLiteral === 1 || isNpcLiteral === '1' || monsterImport);
      this.logger.debug('isNPC $$$ $$$', isNpcLiteral, isNpc);
      token.set('represents', character.id);
      const settings = this.myState.config.tokenSettings;
      if (monsterImport) {
        const name = _.isEmpty(settings.monsterTokenName) ? character.get('name') : settings.monsterTokenName;
        token.set('name', name);
      }
      if (settings.number && isNpc && token.get('name').indexOf('%%NUMBERED%%') === -1) {
        token.set('name', `${token.get('name')} %%NUMBERED%%`);
      }

      _.chain(settings)
        .pick(['bar1', 'bar2', 'bar3'])
        .each((bar, barName) => {
          if (!_.isEmpty(bar.attribute)) {
            // We create attribute here to ensure we have control over the id
            const attribute = this.roll20.getOrCreateAttr(character.id, bar.attribute);
            if (attribute) {
              if (bar.link) {
                token.set(`${barName}_link`, attribute.id);
              }
              else {
                token.set(`${barName}_link`, '');
              }
              token.set(`${barName}_value`, attribute.get('current'));
              if (bar.max) {
                token.set(`${barName}_max`, attribute.get('max'));
              }
              else {
                token.set(`${barName}_max`, '');
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
      return character;
    };
  }

  getTokenVisionConfigurer(token, sensesString) {
    if (_.isEmpty(sensesString)) {
      this.logger.debug('Empty senses string, using default values');
      return _.identity;
    }

    function fullRadiusLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, this.lightRadius));
      token.set('light_dimradius', Math.max(token.get('light_dimradius') || 0, this.lightRadius));
    }

    function darkvisionLightConfigurer() {
      token.set('light_radius', Math.max(token.get('light_radius') || 0, Math.round(this.lightRadius * 1.1666666)));
      if (!token.get('light_dimradius')) {
        token.set('light_dimradius', -5);
      }
    }

    const configureFunctions = {
      blindsight: fullRadiusLightConfigurer,
      truesight: fullRadiusLightConfigurer,
      tremorsense: fullRadiusLightConfigurer,
      darkvision: darkvisionLightConfigurer,
    };

    const re = /(blindsight|darkvision|tremorsense|truesight)\s+(\d+)/;
    let match;
    const senses = [];
    while ((match = sensesString.match(re))) {
      senses.push({
        name: match[1],
        lightRadius: parseInt(match[2], 10),
        configureVision: configureFunctions[match[1]],
      });
      sensesString = sensesString.slice(match.index + match[0].length);
    }

    return function configureTokenVision(character) {
      senses.forEach(sense => sense.configureVision());
      return character;
    };
  }

  getTokenBarSetter(token) {
    return (character) => {
      this.tokenBarConfigurer.setTokenBarsOnDrop(token, true);
      return character;
    };
  }

  getDefaultTokenPersister(token) {
    return (character) => {
      this.roll20.setDefaultTokenForCharacter(character, token);
      return character;
    };
  }

  updateCharacter(options) {
    if (options.all) {
      options.selected.character = this.roll20.findObjs({ type: 'character' });
    }

    if (_.isEmpty(options.selected.character)) {
      this.reportError('You have no tokens selected that represent characters, and you did not specify --all',
        options.playerId);
      return null;
    }
    const count = options.selected.character.length;
    const msg = this.reporter.getMessageStreamer(`Updating ${count} characters`);
    return options.selected.character.reduce((promise, character, index) =>
        promise.then(() => {
          const sheetOpened = this.roll20.getAttrByName(character.id, 'sheet_opened');
          return this.importer
            .runImportStage(character, { sheet_opened: sheetOpened === 1 ? 0 : 1 },
              `Updating character ${index + 1} - ${character.get('name')}`, msg);
        }),
      Promise.resolve())
      .then(() => {
        msg.finish();
        this.reportPlayer('Update Complete', `${count} characters checked/updated`, options.playerId);
      });
  }

  getButtoniser(options, relistOptions) {
    return monster => `<a href="!shaped-import-monster ${relistOptions} --${monster.name}">${monster.name}</a>`;
  }

  validateListCommandOptions() {
    return true;
  }

  addOptionsForListCommand() {
  }

  getListCommandOptions() {
    return '';
  }

};
