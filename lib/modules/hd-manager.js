'use strict';
const ShapedModule = require('./../shaped-module');

module.exports = class HDManager extends ShapedModule {

  registerChatListeners(chatWatcher) {
    chatWatcher.registerChatListener(['character', 'title'], this.handleHD.bind(this));
  }

  handleHD(options) {
    const match = options.title.match(/(\d+)d(\d+) HIT_DICE/);
    if (match && this.myState.config.sheetEnhancements.autoHD) {
      const hdCount = parseInt(match[1], 10);
      const hdSize = match[2];
      const hdAttr = this.roll20.getAttrObjectByName(options.character.id, `hd_d${hdSize}`);
      const hpAttr = this.roll20.getOrCreateAttr(options.character.id, 'HP');
      const maxReduction = parseInt(this.roll20.getAttrByName(options.character.id, 'hp_max_reduced'), 10);
      const regained = Math.max(0, parseInt(options.roll1, 10));
      const fullMax = hpAttr.get('max') || Infinity;
      const reducedMax = maxReduction ? fullMax - maxReduction : fullMax;
      const newHp = Math.min(parseInt(hpAttr.get('current') || 0, 10) + regained, reducedMax);

      if (hdAttr) {
        if (hdCount <= hdAttr.get('current')) {
          hdAttr.setWithWorker('current', hdAttr.get('current') - hdCount);
          hpAttr.setWithWorker('current', newHp);
          if (!hpAttr.get('max')) {
            hpAttr.setWithWorker('max', newHp);
          }
        }
        else {
          this.reportResult('HD Police',
            `${options.characterName} can't use ${hdCount}d${hdSize} hit dice because they ` +
            `only have ${hdAttr.get('current')} left`, options);
        }
      }
    }
  }
};

