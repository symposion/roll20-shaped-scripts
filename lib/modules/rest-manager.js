'use strict';
const _ = require('underscore');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');
const utils = require('./../utils');


class RestManager extends ShapedModule {

  addCommands(commandProcessor) {
    this.rests = [
      {
        name: 'dieRollRecharge',
        operations: [
          this.restoreUses.bind(this),
        ],
        rechargeValue: 'RECHARGE_',
        displayName: 'Dice Roll Recharge',
      },
      {
        name: 'turn',
        operations: [
          this.restoreUses.bind(this),
          this.rechargeLegendaries.bind(this),
        ],
        rechargeValue: 'TURN',
        displayName: 'Turn Recharge',
      },
      {
        name: 'short',
        operations: [
          this.restoreUses.bind(this),
          this.regainWarlockSpellSlots.bind(this),
        ],
        rechargeValue: 'SHORT_OR_LONG_REST',
        displayName: 'Short Rest',
      },
      {
        name: 'long',
        operations: [
          this.restoreUses.bind(this),
          this.resetHP.bind(this),
          this.regainHitDie.bind(this),
          this.regainSpellSlots.bind(this),
          this.regainSpellPoints.bind(this),
          this.reduceExhaustion.bind(this),
        ],
        rechargeValue: 'LONG_REST',
        displayName: 'Long Rest',
      },
    ];

    this.displayTemplates = {
      hp: values => (values.hp > 0 ? `{{heal=[[${values.hp}]]}}` : ''),
      hd: values => values.hd.map(hd => `{{Hit Die Regained (${hd.die})=${hd.quant}}}`).join(''),
      uses: values => `{{Uses Recharged=${values.uses.join(', ')}}}`,
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

  handleRest(options) {
    let chars = options.selected.character;
    if (!_.isUndefined(options.character)) {
      chars = [options.character];
    }
    chars.forEach((char) => {
      const results = this.doRest(char, options.type);
      this.roll20.sendChat(`character|${char.id}`, this.buildMessage(char, options.type, results), null,
        { noarchive: true });
    });
  }

  doRest(char, type) {
    const restIndex = this.rests.findIndex(rest => rest.name === type);
    const restsToProcess = this.rests.slice(0, restIndex + 1);
    return restsToProcess.reduce((results, rest) =>
        rest.operations
          .map(op => op(char, rest.name))
          .reduce((restResults, opResult) =>
            utils.extendWithArrayValues(restResults, opResult), results),
      {});
  }


  buildMessage(character, restType, results) {
    const charName = character.get('name');
    const charId = character.id;
    const displayName = _.findWhere(this.rests, { name: restType }).displayName;

    let msg = `&{template:5e-shaped} {{title=${displayName}}} {{character_name=${charName}}}`;

    if (this.roll20.getAttrByName(charId, 'show_character_name') === '@{show_character_name_yes}') {
      msg += '{{show_character_name=1}}';
    }

    msg += _.chain(this.displayTemplates)
      .pick(_.keys(results))
      .map(template => template(results))
      .value()
      .join('');

    return msg;
  }

  restoreUses(character, restType) {
    const charId = character.id;
    const rechargeValue = _.findWhere(this.rests, { name: restType }).rechargeValue;
    this.logger.debug('Searching for recharge value $$$', rechargeValue);

    const traitNames = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .map((attribute) => {
        const match = attribute.get('name').match(/^(repeating_[^_]+_[^_]+)_recharge$/);
        const attVal = attribute.get('current');
        if (match && attVal.indexOf(rechargeValue) === 0) {
          this.logger.debug('Matching against rechargeValue $$$', attribute);
          return match[1];
        }
        return undefined;
      })
      .reject(_.isUndefined)
      .reject(traitPre => traitPre.match(/repeating_(armor|equipment|lairaction|regionaleffect)/))
      .uniq()
      .map((traitPre) => {
        const attName = this.roll20.getAttrByName(charId, `${traitPre}_name`);
        this.logger.debug(`Recharging '${attName}'`);
        const usesAttr = this.roll20.getAttrObjectByName(charId, `${traitPre}_uses`);
        if (!usesAttr || !usesAttr.get('max')) {
          this.logger.error(`Tried to recharge the uses for '${attName}' for character with id ${charId}, ` +
            'but there were no uses defined.');
          return undefined;
        }

        if (usesAttr.get('current') < usesAttr.get('max')) {
          usesAttr.setWithWorker({ current: usesAttr.get('max') });
          return attName;
        }
        return undefined;
      })
      .compact()
      .value();

    return {
      uses: traitNames,
    };
  }

  rechargeLegendaries(character) {
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

  resetHP(character) {
    if (this.myState.config.variants.rests.longNoHpFullHd) {
      return null;
    }

    const charId = character.id;
    this.logger.debug('Resetting HP to max');
    const max = parseInt(this.roll20.getAttrByName(charId, 'HP', 'max'), 10);
    if (_.isNaN(max)) {
      this.reportError(`Can't recharge HP for character ${character.get('name')} because max HP is not set`);
      return null;
    }
    const current = parseInt(this.roll20.getAttrByName(charId, 'HP', 'current') || 0, 10);

    this.roll20.setAttrWithWorker(charId, 'HP', max);

    return {
      hp: max - current,
    };
  }

  regainHitDie(character) {
    const charId = character.id;
    this.logger.debug('Regaining Hit Die');
    const hitDieRegained = _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
      .filter(attribute => (attribute.get('name').match(/^hd_d\d{1,2}$/)))
      .uniq()
      .map((hdAttr) => {
        const max = parseInt(hdAttr.get('max'), 10);
        if (max > 0) {
          const current = parseInt(hdAttr.get('current') || 0, 10);

          let regained = Math.min(max - current, Math.max(1, Math.floor(max / 2)));
          if (this.myState.config.variants.rests.longNoHpFullHd) {
            regained = max - current;
          }

          if (regained) {
            this.roll20.setAttrWithWorker(charId, hdAttr.get('name'), current + regained);
            return {
              die: hdAttr.get('name').replace(/hd_/, ''),
              quant: regained,
            };
          }
        }
        return null;
      })
      .compact()
      .value();

    return {
      hd: hitDieRegained,
    };
  }

  regainSpellSlots(character) {
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

  regainSpellPoints(character) {
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

  regainWarlockSpellSlots(character) {
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