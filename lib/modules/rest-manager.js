'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');


// function getDieRollRechargeTester(restType, roll20) {
//   if (restType !== 'turn') {
//     return rechargeValue => ({ recharge: rechargeValue === 'TURN' || rechargeValue.indexOf('RECHARGE_') === 0 });
//   }
//   return (rechargeValue) => {
//     if (rechargeValue === 'TURN') {
//       return { recharge: true };
//     }
//
//     const match = rechargeValue.match(/RECHARGE_(\d)(?:_\d)?/);
//     if (match) {
//       const result = roll20.randomInteger(6);
//       return {
//         recharge: result >= parseInt(match[1], 10),
//         dieRoll: result,
//       };
//     }
//     return { recharge: false };
//   };
// }

const REST_ATTRIBUTES = {
  turn: 'recharge_turn',
  short: 'short_rest',
  long: 'long_rest',
};

class RestManager extends ShapedModule {

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
          // const results = this.doRest(char, 'turn');
          // if (this.buildRestMessageBody(results) !== '') {
          //   this.roll20.sendChat(`character|${char.id}`, this.buildMessage(char, 'turn', results, true));
          // }
        }
      }
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
      // const results = this.doRest(char, options.type);
      // const whisper = this.roll20.getAttrByName(char.id, 'output_option') === '/w GM';
      // this.roll20.sendChat(`character|${char.id}`, this.buildMessage(char, options.type, results, whisper));
    });
  }

  doRest(char, type) {
    const attribute = REST_ATTRIBUTES[type];
    const currentVal = this.roll20.getAttrByName(char.id, attribute);
    this.roll20.setAttrWithWorker(char.id, attribute, !currentVal);
  }


  buildMessage(character, restType, results, whisper) {
    const charName = character.get('name');
    const charId = character.id;
    const displayName = _.findWhere(this.rests, { name: restType }).displayName;

    let msg = whisper ? `/w "${charName}" ` : '';

    msg += `&{template:5e-shaped} {{title=${displayName}}} {{character_name=${charName}}}`;

    if (this.roll20.getAttrByName(charId, 'show_character_name') === '@{show_character_name_yes}') {
      msg += '{{show_character_name=1}}';
    }

    msg += this.buildRestMessageBody(results);

    return msg;
  }

  buildRestMessageBody(results) {
    return _.chain(this.displayTemplates)
      .pick(_.keys(results))
      .map(template => template(results))
      .value()
      .join('');
  }

  recoverUses(character, restType, originalRestType) {
    const charId = character.id;
    const rechargeTester = _.findWhere(this.rests, { name: restType }).getRechargeTester(originalRestType);

    const result = {
      uses: [],
      usesNotRecharged: [],
    };

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
          const rechargeTesterResult = rechargeTester(recharge);
          const traitTextForResults = rechargeTesterResult.dieRoll ?
            `${name} (Rolled a ${rechargeTesterResult.dieRoll})` : name;
          if (rechargeTesterResult.recharge) {
            usesAttr.setWithWorker({ current: usesAttr.get('max') });
            result.uses.push(traitTextForResults);
          }
          else if (rechargeTesterResult.dieRoll) {
            result.usesNotRecharged.push(traitTextForResults);
          }
        }
      });
    return result;
  }


}

module.exports = RestManager;
