'use strict';
const ShapedModule = require('./../shaped-module');

module.exports = class DeathSaveManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['deathSavingThrow', 'character', 'roll1'], this.handleDeathSave.bind(this));
  }

  handleDeathSave(options) {
    if (this.roll20.getAttrByName(options.character.id, 'shaped_d20') === '1d20') {
      return; // Sheet is set to Roll 2 - we don't know if the character has (dis)advantage so automation isn't possible
    }
    const currentHP = this.roll20.getAttrByName(options.character.id, 'HP');
    if (currentHP !== 0 && currentHP !== '0') {
      this.reportPublic('Death Saves', `${options.character.get('name')} has more than 0 HP and shouldn't be rolling ` +
        'death saves');
      return;
    }

    const successes = this.roll20.getOrCreateAttr(options.character.id, 'death_saving_throw_successes');
    let successCount = successes.get('current');
    const failures = this.roll20.getOrCreateAttr(options.character.id, 'death_saving_throw_failures');
    let failureCount = failures.get('current');
    const result = parseInt(options.roll1, 10);

    switch (result) {
      case 1:
        failureCount += 2;
        break;
      case 20:
        failureCount = 0;
        successCount = 0;

        this.roll20.setAttrWithWorker(options.character.id, 'HP', 1);
        this.reportPublic('Death Saves', `${options.character.get('name')} has recovered to 1 HP`);
        break;
      default:
        if (result >= 10) {
          successCount++;
        }
        else {
          failureCount++;
        }
    }

    if (failureCount >= 3) {
      failureCount = 3;
      this.reportPublic('Death Saves', `${options.character.get('name')} has failed 3` +
        ' death saves and is now dead');
    }
    else if (successCount >= 3) {
      this.reportPublic('Death Saves', `${options.character.get('name')} has succeeded 3` +
        ' death saves and is now stable');
      failureCount = 0;
      successCount = 0;
    }
    successes.setWithWorker({ current: successCount });
    failures.setWithWorker({ current: failureCount });
  }
};

