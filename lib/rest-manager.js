'use strict';
const _ = require('underscore');
const ShapedModule = require('./shaped-module');
const ShapedConfig = require('./shaped-config');

class RestManager extends ShapedModule {

  addCommands(commandProcessor) {
    return commandProcessor.addCommand('rest', this.handleRest.bind(this), false)
        .option('long', ShapedConfig.booleanValidator)
        .option('short', ShapedConfig.booleanValidator)
        .option('id', ShapedConfig.getCharacterValidator(this.roll20), false)
        .withSelection({
          character: {
            min: 0,
            max: Infinity,
          },
        });
  }

  handleRest(options) {
    let chars = options.selected.character;
    if (!_.isUndefined(options.id)) {
      // if an ID is passed, overwrite any selection, and only process for the passed charId
      // NB this id will have been hydrated into a character object by the option processing so it's
      // already an object. The name should really change but it's baked into the sheet now so it's
      // too much hassle to change.
      chars = [options.id];
    }
    if (options.long) {
      // handle long rest
      this.doLongRest(chars);
    }
    else if (options.short) {
      // handle short rest
      this.doShortRest(chars);
    }
    else {
      this.reportError('please specify long (!shaped-rest --long) or short (!shaped-rest --short) rest');
    }
  }

  /**
   * Performs all of the short rest actions for the specified character
   * @param {Object[]} selectedChars - The characters to perform short rest actions on
   */
  doShortRest(selectedChars) {
    _.each(selectedChars, (currentChar) => {
      const charId = currentChar.id;
      const charName = currentChar.get('name');
      this.logger.debug(`Processing short rest for ${charName}:`);

      const traits = this.rechargeTraits(charId, 'short');
      const warlockSlots = this.regainWarlockSpellSlots(charId);

      const msg = this.buildRestMessage('Short Rest', charName, charId, traits, warlockSlots);

      this.roll20.sendChat(`character|${charId}`, msg, { noarchive: true });
    });
  }

  /**
   * Performs all of the long rest actions for the specified character - including short rest actions
   * @param {Object[]} selectedChars - The characters to perform long rest actions on
   */
  doLongRest(selectedChars) {
    _.each(selectedChars, (currentChar) => {
      const charId = currentChar.id;
      const charName = currentChar.get('name');
      let healed = 0;

      this.logger.debug(`Processing long rest for ${charName}:`);

      let traits = this.rechargeTraits(charId, 'short');
      traits = traits.concat(this.rechargeTraits(charId, 'long'));

      if (!this.myState.config.variants.rests.longNoHpFullHd) {
        healed = this.resetHP(currentChar);
      }
      const hd = this.regainHitDie(charId);
      const slots = this.regainSpellSlots(charId);
      const spellPoints = this.regainSpellPoints(charId);
      const exhaus = this.reduceExhaustion(charId);
      const warlockSlots = this.regainWarlockSpellSlots(charId);

      const msg = this.buildRestMessage('Long Rest', charName, charId, traits, warlockSlots, healed, hd, slots, exhaus,
          spellPoints);

      this.roll20.sendChat(`character|${charId}`, msg, { noarchive: true });
    });
  }

  /**
   * Builds the rest message using the sheet's roll template to report the results of a rest
   * @param {string} restType - The type of rest performed; either 'Long Rest' or 'Short Rest'
   * @param {string} charName - The name of the character
   * @param {string} charId - The Roll20 character ID
   * @param {Object[]} traitNames - An array of the trait names that have been recharged
   * @param {int} healed - The number of HP healed
   * @param {Object[]} hdRegained - Array of objects each representing a die type and the number regained
   * @param {boolean} spellSlots - Whether or not spell slots were recharged
   * @param {boolean} exhaustion - Whether or not a level of exhaustoin was removed
   * @param {boolean} spellPoints - Whether or not spell points were recharged
   * @param {boolean} warlockSpellSlots - Whether or not warlock spell slots were recharged
   */
  buildRestMessage(restType, charName, charId, traitNames, warlockSpellSlots, healed, hdRegained, spellSlots,
      exhaustion, spellPoints) {
    let msg = `&{template:5e-shaped} {{title=${restType}}} {{character_name=${charName}}}`;

    if (this.roll20.getAttrByName(charId, 'show_character_name') === '@{show_character_name_yes}') {
      msg += '{{show_character_name=1}}';
    }

    if (hdRegained) {
      _.each(hdRegained, (hd) => {
        if (hd.quant > 0) {
          msg += `{{Hit Die Regained (${hd.die})=${hd.quant}}}`;
        }
      });
    }

    if (traitNames) {
      msg += `{{Traits Recharged=${traitNames.join(', ')}}}`;
    }
    if (healed > 0) {
      msg += `{{heal=[[${healed}]]}}`;
    }
    if (spellSlots) {
      msg += '{{Spell Slots Regained=&nbsp;}}';
    }
    if (exhaustion) {
      msg += '{{text_top=Removed 1 Level Of Exhaustion}}';
    }
    if (spellPoints) {
      msg += '{{Spell Points Regained=&nbsp;}}';
    }
    if (warlockSpellSlots) {
      msg += '{{Warlock Spell Slots Regained=&nbsp;}}';
    }

    return msg;
  }

  /**
   * Recharges all of the repeating 'traits' section items that have a 'recharge' defined
   * @param {string} charId - the Roll20 character ID
   * @param {string} restType - the type of rest being performed; either 'Short Rest' or 'Long Rest'
   * @returns {Array} - An array of the trait names that were recharged
   */
  rechargeTraits(charId, restType) {
    const traitNames = [];

    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
        .map(attribute => (attribute.get('name').match(/^repeating_trait_([^_]+)_recharge$/) || [])[1])
        .reject(_.isUndefined)
        .uniq()
        .each((attId) => {
          const traitPre = `repeating_trait_${attId}`;
          const rechargeAtt = this.roll20.getAttrByName(charId, `${traitPre}_recharge`);
          if (rechargeAtt.toLowerCase().indexOf(restType) !== -1) {
            const attName = this.roll20.getAttrByName(charId, `${traitPre}_name`);
            this.logger.debug(`Recharging '${attName}'`);
            traitNames.push(attName);
            const max = this.roll20.getAttrByName(charId, `${traitPre}_uses`, 'max');
            if (max === undefined) {
              this.logger.error(`Tried to recharge the trait '${attName}' for character with id ${charId}, ` +
                  'but there were no uses defined.');
            }
            else {
              this.roll20.setAttrWithWorker(charId, `${traitPre}_uses`, max);
            }
          }
        });

    return traitNames;
  }

  /**
   * Resets the HP of the specified character to its maximum value
   * @param {Object} character - the Roll20 character
   * @returns {int} - the number of HP that were healed
   */
  resetHP(character) {
    const charId = character.id;
    this.logger.debug('Resetting HP to max');
    const max = parseInt(this.roll20.getAttrByName(charId, 'HP', 'max'), 10);
    if (_.isNaN(max)) {
      this.reportError(`Can't recharge HP for character ${character.get('name')} because max HP is not set`);
      return 0;
    }
    const current = parseInt(this.roll20.getAttrByName(charId, 'HP', 'current') || 0, 10);

    this.roll20.setAttrWithWorker(charId, 'HP', max);

    return max - current;
  }

  /**
   * Adds Hit die to the specified character based on PHB rules
   * @param {string} charId - the Roll20 character ID
   * @returns {Array} - Array of objects each representing a die type and the number regained
   */
  regainHitDie(charId) {
    const hitDieRegained = [];
    this.logger.debug('Regaining Hit Die');
    _.chain(this.roll20.findObjs({ type: 'attribute', characterid: charId }))
        .filter(attribute => (attribute.get('name').match(/^hd_d\d{1,2}$/)))
        .uniq()
        .each((hdAttr) => {
          const max = parseInt(hdAttr.get('max'), 10);
          if (max > 0) {
            const oldCurrent = parseInt(hdAttr.get('current') || 0, 10);
            let newCurrent = oldCurrent;
            let regained = max === 1 ? 1 : Math.floor(max / 2);
            if (this.myState.config.variants.rests.longNoHpFullHd) {
              regained = max - oldCurrent;
            }
            newCurrent += regained;
            newCurrent = newCurrent > max ? max : newCurrent;
            this.roll20.setAttrWithWorker(charId, hdAttr.get('name'), newCurrent);
            hitDieRegained.push({
              die: hdAttr.get('name').replace(/hd_/, ''),
              quant: newCurrent - oldCurrent,
            });
          }
        });

    return hitDieRegained;
  }

  /**
   * Resets all (non warlock) spell slots of the specified character to their maximum values
   * @param {string} charId - the Roll20 character ID
   * @returns {boolean} - true if any spell slots were recharged; false otherwise
   */
  regainSpellSlots(charId) {
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

    return slotsFound;
  }

  /**
   * Resets spell points of the specified character to maximum value
   * @param {string} charId - the Roll20 character ID
   * @returns {boolean} - true if spell points were recharged; false otherwise
   */
  regainSpellPoints(charId) {
    this.logger.debug('Regaining Spell Points');
    const spellPointsAttr = this.roll20.getAttrObjectByName(charId, 'spell_points');
    const spellPointsMax = spellPointsAttr ? parseInt(spellPointsAttr.get('max'), 10) : 0;
    if (spellPointsMax) {
      spellPointsAttr.setWithWorker('current', spellPointsMax);
      return true;
    }
    return false;
  }

  /**
   * Resets warlock spell slots of the specified character to maximum value
   * @param {string} charId - the Roll20 character ID
   * @returns {boolean} - true if any spell slots were recharged; false otherwise
   */
  regainWarlockSpellSlots(charId) {
    this.logger.debug('Regaining Warlock Spell slots');
    const warlockSlotsAttr = this.roll20.getAttrObjectByName(charId, 'warlock_spell_slots');
    const slotsMax = warlockSlotsAttr ? parseInt(warlockSlotsAttr.get('max'), 10) : 0;
    if (slotsMax) {
      warlockSlotsAttr.setWithWorker('current', slotsMax);
      return true;
    }
    return false;
  }

  /**
   * Reduces the specified character's level of exhaustion by 1
   * @param {string} charId - the Roll20 character ID
   * @returns {boolean} - true if a level of exhaustion was reduced; false otherwise
   */
  reduceExhaustion(charId) {
    this.logger.debug('Reducing Exhaustion');
    const currentLevel = parseInt(this.roll20.getAttrByName(charId, 'exhaustion_level'), 10);

    if (currentLevel > 0) {
      this.roll20.setAttrWithWorker(charId, 'exhaustion_level', currentLevel - 1);
      return true;
    }

    return false;
  }

}

module.exports = RestManager;
