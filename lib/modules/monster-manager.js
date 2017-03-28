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

function monsterKey(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

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
    this.newCharacterConfigurer = deps.newCharacterConfigurer;
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
      .addCommand('update-character', this.updateCharacter.bind(this), true)
      .withSelection({
        character: {
          min: 0,
          max: Infinity,
          anyVersion: true,
        },
      })
      .option('all', ShapedConfig.booleanValidator)
      .addCommand('remove-monster', this.removeMonster.bind(this), true)
      .option('character', ShapedConfig.getCharacterValidator(this.roll20), true)
      .option('confirm', ShapedConfig.booleanValidator, true)
      .option('relist', ShapedConfig.jsonValidator, false);
  }

  importStatblock(options) {
    this.logger.info('Importing statblocks for tokens $$$', options.selected.graphic);
    return Promise.all(options.selected.graphic.map((token) => {
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
    }));
  }

  processGMNotes(options, token, text) {
    text = sanitise(unescape(text), this.logger);
    const monsters = this.parser.parse(text).monsters;
    return this.importMonsters(monsters, options, token, [
      function gmNotesSetter(character) {
        character.set('gmnotes', text.replace(/\n/g, '<br>'));
        return character;
      },
    ]);
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
      .then((results) => {
        if (options.monsters.length > 1) {
          this.displayImportResults(options.playerId, results);
        }
        if (options.relist) {
          _.extend(options, options.relist);
          options.clearCache('monsterCache');
          this.entityLister.listEntity('monsters', options);
        }
      });
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
    characterProcessors.push(character => this.newCharacterConfigurer.configureCharacter(token, character));

    const errors = [];
    const importedList = [];
    return monsters
      .reduce((prevPromise, monsterData) =>
        prevPromise.then(() => {
          const msg = this.reporter.getMessageStreamer(`${monsterData.name} Import`);
          const character = _.reduce(characterRetrievalStrategies,
            (result, strategy) => result || strategy(monsterData.name, errors), null);

          if (!character) {
            this.logger.error('Failed to find or create character for monster $$$', monsterData.name);
            const errorText = `Error creating character:  <ul><li>${errors.join('</li><li>')}</li></ul>`;
            msg.finish(errorText);
            return null;
          }

          const oldAttrs = this.roll20.findObjs({ type: 'attribute', characterid: character.id });
          _.invoke(oldAttrs, 'remove');
          character.set('name', monsterData.name);

          return characterProcessors.reduce((charPromise, proc) =>
              charPromise.then(updatedChar => proc(updatedChar, monsterData, msg))
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

  monsterDataPopulator(character, monsterData, msg) {
    this.logger.debug('Importing new character data $$$', monsterData);
    const data = this.srdConverter.convertMonster(monsterData);
    this.logger.debug('Converted monster data: $$$', data);

    let charPromise = Promise.resolve(character);
    if (!this.roll20.getAttrByName(character.id, 'version', 'current', true)) {
      charPromise = this.importer.runImportStage(character, { sheet_opened: 1 }, 'Creating character', msg);
    }

    return charPromise
      .then(newChar => this.importer.runImportStage(newChar, { import_data: JSON.stringify({ npc_data: data }) },
        'Importing character data', msg))
      .then(newChar => this.spellManager.importData(newChar, [], false, msg))
      .then((newChar) => {
        msg.finish(`${character.get('name')} import complete`);
        return newChar;
      });
  }

  getTokenRetrievalStrategy(token) {
    return (name, errors) => {
      if (token) {
        const character = this.roll20.getObj('character', token.get('represents'));
        if (character && this.roll20.getAttrByName(character.id, 'locked', 'current', true)) {
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

    if (chars[0] && this.roll20.getAttrByName(chars[0].id, 'locked', 'current', true)) {
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
          const sheetOpened = this.roll20.getAttrByName(character.id, 'sheet_opened', 'current', true);
          return this.importer
            .runImportStage(character, { sheet_opened: sheetOpened === 1 ? 0 : 1 },
              `Updating character ${index + 1} - ${character.get('name')}`, msg);
        }),
      Promise.resolve())
      .then(() => {
        msg.finish(`Update complete: ${count} characters checked/updated`);
      });
  }

  removeMonster(options) {
    if (options.confirm) {
      const name = options.character.get('name');
      options.character.remove();
      this.reportPlayer('Character removed', `Removed character ${name}`);
      if (options.relist) {
        _.extend(options, options.relist);
        options.clearCache('monsterCache');
        this.entityLister.listEntity('monsters', options);
      }
    }
  }

  getButtoniser(options, relistOptions) {
    const monsterCache = options.getCache('monsterCache');
    if (_.isEmpty(monsterCache)) {
      this.roll20.findObjs({ type: 'character' })
        .forEach(monster => (monsterCache[monsterKey(monster.get('name'))] = monster));
    }

    return (monster) => {
      const existing = monsterCache[monsterKey(monster.name)];
      const alreadyAdded = !!existing;
      const command = alreadyAdded ? '!shaped-remove-monster' : '!shaped-import-monster';
      const className = alreadyAdded ? 'remove' : '';
      const confirm = alreadyAdded ? `--confirm ?{Delete ${monster.name}|Yes, true|No, false}` : '';
      const monsterOption = alreadyAdded ? `--character ${existing.id}` : `--${monster.name}`;
      return `<a href="${command} ${relistOptions} ${monsterOption} ${confirm}" ` +
        `class="${className}">${monster.name}</a>`;
    };
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
