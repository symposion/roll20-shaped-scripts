'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');

const REST_ATTRIBUTES = {
  turn: 'recharge_turn',
  short: 'short_rest',
  long: 'long_rest',
};

class RestManager extends ShapedModule {

  constructor(deps) {
    super(deps);
    this.sheetWorkerChatOutput = deps.sheetWorkerChatOutput;
  }

  addCommands(commandProcessor) {
    return commandProcessor.addCommand(['rest', 'recharge'], this.handleRest.bind(this), false)
      .option('type', (value) => {
        const converted = value.toLowerCase();
        return {
          valid: ['short', 'long', 'turn'].includes(value),
          converted,
        };
      }, true)
      .option('character', ShapedConfig.getCharacterValidator(this.roll20), false)
      .withSelection({
        character: {
          min: 0,
          max: Infinity,
        },
      });
  }

  registerEventListeners(eventDispatcher) {
    eventDispatcher.registerEventHandler('change:campaign:turnorder', (turnOrder) => {
      if (!_.isEmpty(turnOrder) && turnOrder[0].id !== '-1' && this.myState.config.sheetEnhancements.turnRecharges) {
        const graphic = this.roll20.getObj('graphic', turnOrder[0].id);
        const char = this.roll20.getObj('character', graphic.get('represents'));
        if (char) {
          this.doRest(char, 'turn');
        }
      }
    });
    eventDispatcher.registerAttributeChangeHandler('recharge_turn', (attr) => {
      const results = this.rechargeDieRollUses(attr.get('characterid'));
      this.reporter.sendCharacter(attr.get('characterid'), `{template:5e-shaped}{{title=Turn Recharge}}${results}`);
    });
  }

  handleRest(options) {
    let chars = options.selected.character;
    if (!_.isUndefined(options.character)) {
      chars = [options.character];
    }
    if (_.isEmpty(chars)) {
      this.reportError('Invalid options/selection', 'You must select at least one character or include --character ' +
        'when calling !shaped-rest', options.playerId);
    }
    chars.forEach((char) => {
      this.doRest(char, options.type);
    });
  }

  doRest(char, type) {
    const attribute = REST_ATTRIBUTES[type];
    const currentVal = this.roll20.getAttrByName(char.id, attribute, 'current', true);
    this.roll20.setAttrWithWorker(char.id, attribute, !currentVal, () => {
      const output = this.roll20.getAttrObjectByName(char.id, 'sheet_chat_output');
      const additional = (type === 'turn') ? this.rechargeDieRollUses(char.id) : '';
      this.sheetWorkerChatOutput.displaySheetChatOutput(output, char.id, additional);
    });
  }


  rechargeDieRollUses(charId) {
    let resultText = '';

    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => attribute.get('name').match(/^repeating_(?!armor|equipment|lairaction|regionaleffect).*$/))
      .groupBy(attribute => attribute.get('name').match(/^(repeating_[^_]+_[^_]+)_.*$/)[1])
      .pick((attributeGroup, prefix) => attributeGroup.some(attr => attr.get('name') === `${prefix}_recharge`))
      .each((attributeGroup) => {
        const attributesByName = _.object(attributeGroup
          .map(attr => [attr.get('name').match(/repeating_[^_]+_[^_]+_(.*)$/)[1], attr]));
        const name = attributesByName.name.get('current');
        const recharge = attributesByName.recharge.get('current');
        const usesAttr = attributesByName.uses;
        if (!usesAttr || !usesAttr.get('max')) {
          this.logger.error(`Tried to recharge the uses for '${name}' for character with id ${charId}, ` +
            'but there were no uses defined.');
          return;
        }

        if (usesAttr.get('current') < usesAttr.get('max')) {
          const match = recharge.match(/RECHARGE_(\d)(?:_\d)?/);
          if (match) {
            const rechargeDieRoll = this.roll20.randomInteger(6);

            if (rechargeDieRoll >= parseInt(match[1], 10)) {
              usesAttr.setWithWorker({ current: usesAttr.get('max') });
              resultText += `{{${name} Recharged= ${usesAttr.get('max')}/${usesAttr.get('max')}` +
                `(Rolled a ${rechargeDieRoll})}}`;
            }
            else {
              resultText += `{{${name} Not Recharged= ${usesAttr.get('current')}/${usesAttr.get('max')}` +
                `(Rolled a ${rechargeDieRoll})}}`;
            }
          }
        }
      });
    return resultText;
  }


}

module.exports = RestManager;
