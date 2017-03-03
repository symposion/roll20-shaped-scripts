'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');
const utils = require('./../utils');

function getStringRechargeTester(targetRechargeValue) {
  return rechargeValue => ({ recharge: rechargeValue === targetRechargeValue });
}

function getDieRollRechargeTester(restType, roll20) {
  if (restType !== 'turn') {
    return rechargeValue => ({ recharge: rechargeValue === 'TURN' || rechargeValue.indexOf('RECHARGE_') === 0 });
  }
  return (rechargeValue) => {
    if (rechargeValue === 'TURN') {
      return { recharge: true };
    }

    const match = rechargeValue.match(/RECHARGE_(\d)(?:_\d)?/);
    if (match) {
      const result = roll20.randomInteger(6);
      return {
        recharge: result >= parseInt(match[1], 10),
        dieRoll: result,
      };
    }
    return { recharge: false };
  };
}

class RestManager extends ShapedModule {

  addCommands(commandProcessor) {
    this.rests = [
      {
        name: 'turn',
        operations: [
          this.recoverUses.bind(this),
          this.recoverLegendaryPoints.bind(this),
        ],
        getRechargeTester: restType => getDieRollRechargeTester(restType, this.roll20),
        displayName: 'Turn Recharge',
      },
      {
        name: 'short',
        operations: [
          this.recoverUses.bind(this),
          this.recoverWarlockSpellSlots.bind(this),
        ],
        getRechargeTester: () => getStringRechargeTester('SHORT_OR_LONG_REST'),
        displayName: 'Short Rest',
      },
      {
        name: 'long',
        operations: [
          this.recoverUses.bind(this),
          this.recoverHP.bind(this),
          this.recoverHD.bind(this),
          this.recoverSpellSlots.bind(this),
          this.recoverSpellPoints.bind(this),
          this.reduceExhaustion.bind(this),
        ],
        getRechargeTester: () => getStringRechargeTester('LONG_REST'),
        displayName: 'Long Rest',
      },
    ];

    this.displayTemplates = {
      hp: values => (values.hp > 0 ? `{{heal=[[${values.hp}]]}}` : ''),
      hd: values => values.hd.map(hd => `{{Hit Die Regained (${hd.die})=${hd.quant}}}`).join(''),
      uses: values => `{{Uses Recharged=${values.uses.join(', ')}}}`,
      usesNotRecharged: values => `{{Uses Not Recharged=${values.usesNotRecharged.join(', ')}}}`,
      slots: values => (values.slots ? '{{Spell Slots Regained=&nbsp;}}' : ''),
      exhaustion: values => `{{text_top=Removed 1 Level Of Exhaustion, now at level: [[${values.exhaustion}]]}}`,
      warlockSlots: values => (values.warlockSlots ? '{{Warlock Spell Slots Regained=&nbsp;}}' : ''),
      spellPoints: values => (values.spellPoints ? '{{Spell Points Regained=&nbsp;}}' : ''),
      legendaries: values => (values.legendaries ? `{{Legendary points regained=${values.legendaries}}}` : ''),
    };

    return commandProcessor.addCommand('rest', this.handleRest.bind(this), false)
      .option('type', (value) => {
        const converted = value.toLowerCase();
        return {
          valid: _.chain(this.rests).pluck('name').contains(converted).value(),
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
      if (!_.isEmpty(turnOrder) && turnOrder[0].id !== '-1') {
        const graphic = this.roll20.getObj('graphic', turnOrder[0].id);
        const char = this.roll20.getObj('character', graphic.get('represents'));
        if (char) {
          const results = this.doRest(char, 'turn');
          if (this.buildRestMessageBody(results) !== '') {
            this.roll20.sendChat(`character|${char.id}`, this.buildMessage(char, 'turn', results, true));
          }
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
      const results = this.doRest(char, options.type);
      const whisper = this.roll20.getAttrByName(char.id, 'output_option') === '/w GM';
      this.roll20.sendChat(`character|${char.id}`, this.buildMessage(char, options.type, results, whisper));
    });
  }

  doRest(char, type) {
    const restIndex = this.rests.findIndex(rest => rest.name === type);
    const restsToProcess = this.rests.slice(0, restIndex + 1);
    return restsToProcess.reduce((results, rest) =>
        rest.operations
          .map(op => op(char, rest.name, type))
          .reduce((restResults, opResult) =>
            utils.extendWithArrayValues(restResults, opResult), results),
      {});
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

  recoverLegendaryPoints(character) {
    const legendaryAmountAttr = this.roll20.getAttrObjectByName(character.id, 'legendary_action_amount');
    if (legendaryAmountAttr) {
      const max = legendaryAmountAttr.get('max');
      if (max) {
        this.logger.debug('Restoring legendary points');
        const current = legendaryAmountAttr.get('current') || 0;
        legendaryAmountAttr.setWithWorker({ current: max });
        return {
          legendaries: max - current,
        };
      }
    }
    return null;
  }

  recoverHP(character) {
    const charId = character.id;
    const hpAttr = this.roll20.getAttrObjectByName(charId, 'HP');
    const maxReduction = parseInt(this.roll20.getAttrByName(character.id, 'hp_max_reduced'), 10);
    const regained = this.recoverAttribute(hpAttr, this.myState.config.variants.rests.longRestHPRecovery,
      character, true, maxReduction);

    return {
      hp: regained,
    };
  }

  recoverAttribute(attribute, multiplier, character, errorIfNoMax, maxReduction) {
    if (multiplier === 0 || !attribute) {
      return 0;
    }

    const fullMax = parseInt(attribute.get('max'), 10);
    const reducedMax = maxReduction ? fullMax - maxReduction : fullMax;
    if (!reducedMax) {
      if (errorIfNoMax) {
        this.logger.error(`Can't recharge ${attribute.get('name')} for character ${character.get('name')} ` +
          'because max value is not set');
      }
      return null;
    }

    const current = parseInt(attribute.get('current') || 0, 10);
    const regained = Math.min(reducedMax - current, Math.max(1, Math.floor(reducedMax * multiplier)));
    attribute.setWithWorker({ current: current + regained });
    return regained;
  }

  recoverHD(character) {
    const charId = character.id;
    this.logger.debug('Regaining Hit Dice');
    const hitDieRegained = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => (attribute.get('name').match(/^hd_d\d{1,2}$/)))
      .uniq()
      .map((hdAttr) => {
        const regained = this.recoverAttribute(hdAttr, this.myState.config.variants.rests.longRestHDRecovery,
          character, false, 0);
        if (regained) {
          return {
            die: hdAttr.get('name').replace(/hd_/, ''),
            quant: regained,
          };
        }

        return null;
      })
      .compact()
      .value();

    return {
      hd: hitDieRegained,
    };
  }

  recoverSpellSlots(character) {
    const charId = character.id;
    let slotsFound = false;

    this.logger.debug('Regaining Spell Slots');
    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => (attribute.get('name').match(/^spell_slots_l\d$/)))
      .uniq()
      .each((slotAttr) => {
        const max = parseInt(slotAttr.get('max'), 10);
        if (max > 0) {
          this.roll20.setAttrWithWorker(charId, slotAttr.get('name'), max);
          slotsFound = true;
        }
      });

    return {
      slots: slotsFound,
    };
  }

  recoverSpellPoints(character) {
    const charId = character.id;
    this.logger.debug('Regaining Spell Points');
    let spellPointsFound = false;
    const spellPointsAttr = this.roll20.getAttrObjectByName(charId, 'spell_points');
    const spellPointsMax = spellPointsAttr ? parseInt(spellPointsAttr.get('max'), 10) : 0;
    if (spellPointsMax) {
      spellPointsAttr.setWithWorker('current', spellPointsMax);
      spellPointsFound = true;
    }

    return {
      spellPoints: spellPointsFound,
    };
  }

  recoverWarlockSpellSlots(character) {
    const charId = character.id;
    this.logger.debug('Regaining Warlock Spell slots');
    let warlockSlotsFound = false;
    const warlockSlotsAttr = this.roll20.getAttrObjectByName(charId, 'warlock_spell_slots');
    const slotsMax = warlockSlotsAttr ? parseInt(warlockSlotsAttr.get('max'), 10) : 0;
    if (slotsMax) {
      warlockSlotsAttr.setWithWorker('current', slotsMax);
      warlockSlotsFound = true;
    }
    return {
      warlockSlots: warlockSlotsFound,
    };
  }

  reduceExhaustion(character) {
    const charId = character.id;
    this.logger.debug('Reducing Exhaustion');

    const currentLevel = parseInt(this.roll20.getAttrByName(charId, 'exhaustion_level'), 10);

    if (currentLevel > 0) {
      this.roll20.setAttrWithWorker(charId, 'exhaustion_level', currentLevel - 1);
      return {
        exhaustion: currentLevel - 1,
      };
    }

    return null;
  }

}

module.exports = RestManager;
