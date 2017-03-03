'use strict';
const _ = require('underscore');

function makeNormalMessage(heading, text) {
  return `&{template:5e-shaped} {{title=${heading}}}{{content=${text}}}`;
}

function makeErrorMessage(scriptName, text) {
  return makeNormalMessage(`${scriptName} Error`, text);
}

function makeStreamHeader(heading) {
  return '<div style="border-top:thin solid black; border-left: thin solid black; bottom: -7px;' +
    'border-right: thin solid black; background-color:white; position: relative; left:-20px; padding: 5px;"><div ' +
    'style="font-weight:bold;border-bottom:1px solid black;font-size: 130%;padding-bottom:5px;">' +
    `${heading}</div>` +
    '<div style="border-left: thin solid black; border-right: thin solid black; background-color:white; ' +
    'position: absolute; left:-1px; bottom: -27px; height:27px; width:100%; z-index:1;font-weight:bold;' +
    'font-size:200%;"></div></div>';
}

function makeStreamBody(text) {
  return '<div style="border-left: thin solid black; border-right: thin solid black; background-color:white; ' +
    `position: relative; left:-20px; padding-left: 5px; padding-right:5px;">${text}` +
    '<div style="border-left: thin solid black; border-right: thin solid black; background-color:white; ' +
    'position: absolute; left:-1px; bottom: -33px; height:33px; width:100%; z-index:1;font-weight:bold;' +
    'font-size:200%;"><div style="padding-left:10px;">. . .</div></div></div>';
}

function makeStreamFooter() {
  return '<div style="border-bottom: thin solid black; border-left: thin solid black; border-right: thin solid black;' +
    'background-color:white; position: relative; left:-20px; padding: 5px;"></div>';
}

class Reporter {

  constructor(roll20, scriptName) {
    this.roll20 = roll20;
    this.scriptName = scriptName;
  }

  reportPublic(heading, text) {
    this.roll20.sendChat('', `${makeNormalMessage(heading, text)}`);
  }

  reportPlayer(heading, text, playerId) {
    this.sendToPlayerAndGm(`${makeNormalMessage(heading, text)}`, playerId);
  }

  sendToPlayerAndGm(text, playerId) {
    this.roll20.sendChat('', `/w GM ${text}`, null, { noarchive: true });
    if (playerId && !this.roll20.playerIsGM(playerId)) {
      this.roll20.sendChat('', `/w ${this.getPlayerName(playerId)} ${text}`, null, { noarchive: true });
    }
  }

  reportError(text, playerId) {
    this.sendToPlayerAndGm(`${makeErrorMessage(this.scriptName, text)}`, playerId);
  }

  getPlayerName(playerId) {
    return playerId ? `"${this.roll20.getObj('player', playerId).get('displayname')}"` : 'gm';
  }

  getMessageBuilder(heading, isPublic, playerId) {
    const fields = {};
    const reporter = this;
    return {
      addField(name, content) {
        fields[name] = content;
      },
      display() {
        const displayer = (isPublic ? reporter.reportPublic : reporter.reportPlayer).bind(reporter);
        displayer(playerId, _.reduce(fields, (text, content, name) => `${text}{{${name}=${content}}}`, ''));
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
      finish() {
        sendChat(makeStreamFooter());
      },
    };
  }
}


module.exports = Reporter;
