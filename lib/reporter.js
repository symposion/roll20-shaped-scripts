'use strict';
const _ = require('underscore');

function makeNormalMessage(heading, text) {
  return `&{template:5e-shaped} {{title=${heading}}}{{content=${text}}}`;
}

function makeErrorMessage(scriptName, text) {
  return makeNormalMessage(`${scriptName} Error`, text);
}

function makeStreamHeader(heading) {
  return `&{template:5e-shaped} {{continuous_header=1}} {{title=${heading}}}`;
}

function makeStreamBody(text) {
  return `&{template:5e-shaped} {{content=${text}}} {{continuous=1}}`;
}

function makeStreamFooter(finalText) {
  return `&{template:5e-shaped} {{content=${finalText}}}{{continuous_footer=1}}`;
}


class Reporter {

  constructor(roll20, scriptName) {
    this.roll20 = roll20;
    this.scriptName = scriptName;
  }

  reportPublic(heading, text) {
    this.sendPublic(`${makeNormalMessage(heading, text)}`);
  }

  reportPlayer(heading, text, playerId) {
    this.sendToPlayerAndGm(`${makeNormalMessage(heading, text)}`, playerId);
  }

  reportCharacter(heading, text, characterId) {
    this.sendCharacter(characterId, makeNormalMessage(heading, text));
  }

  reportError(text, playerId) {
    this.sendToPlayerAndGm(makeErrorMessage(this.scriptName, text), playerId);
  }

  sendPublic(text) {
    this.roll20.sendChat('', text);
  }

  sendPlayer(text, playerId) {
    this.roll20.sendChat('', `/w ${this.getPlayerName(playerId)} ${text}`, null, { noarchive: true });
  }

  sendToPlayerAndGm(text, playerId) {
    this.roll20.sendChat('', `/w GM ${text}`, null, { noarchive: true });
    if (playerId && !this.roll20.playerIsGM(playerId)) {
      this.roll20.sendChat('', `/w ${this.getPlayerName(playerId)} ${text}`, null, { noarchive: true });
    }
  }

  getPlayerName(playerId) {
    return playerId ? `"${this.roll20.getObj('player', playerId).get('displayname')}"` : 'gm';
  }

  sendCharacter(characterId, text) {
    const character = this.roll20.getObj('character', characterId);
    const charName = character.get('name').replace(/"/g, '\'');
    this.roll20.sendChat(`character|${characterId}`, `/w "${charName}" ${text}`);
    if (!_.isEmpty(character.get('controlledby'))) {
      this.roll20.sendChat('', `/w gm ${text}`);
    }
  }


  getMessageBuilder(heading, isPublic, playerId) {
    const fields = { title: heading };
    const reporter = this;
    return {
      addField(name, content) {
        fields[name] = content;
        return this;
      },
      display() {
        const displayer = isPublic ? reporter.sendPublic : reporter.sendToPlayerAndGm;
        displayer.bind(reporter)(_.reduce(fields, (text, content, name) => `${text}{{${name}=${content}}}`,
          '&{template:5e-shaped}'), playerId);
      },
    };
  }

  getMessageStreamer(heading, playerId) {
    const sendChat = (text) => {
      this.roll20.sendChat('', `/w ${this.getPlayerName(playerId)} ${text}`, null, { noarchive: true });
    };

    sendChat(makeStreamHeader(heading));
    return {
      stream(message) {
        sendChat(makeStreamBody(message));
      },
      finish(finalMessage) {
        sendChat(makeStreamFooter(finalMessage));
      },
    };
  }

  toJSON() {
    return {
      scriptName: this.scriptName,
    };
  }
}


module.exports = Reporter;
