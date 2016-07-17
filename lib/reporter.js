'use strict';


function makeNormalMessage(scriptName, heading, text) {
  return '<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">' +
    '<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">' +
    `${scriptName} ${heading}</div>${text}</div>`;
}

function makeErrorMessage(scriptName, text) {
  return '<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">' +
    '<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;color:red;">' +
    `${scriptName}</div>${text}</div>`;
}

class Reporter {

  constructor(roll20, scriptName) {
    this.roll20 = roll20;
    this.scriptName = scriptName;
  }

  setPlayer(playerId) {
    this.playerId = playerId;
  }

  reportPublic(heading, text) {
    // Horrible bug with this at the moment - seems to generate spurious chat
    // messages when noarchive:true is set
    // sendChat('ShapedScripts', '' + msg, null, {noarchive:true});

    this.roll20.sendChat('', `${makeNormalMessage(this.scriptName, heading, text)}`);
  }

  reportPlayer(heading, text) {
    this.roll20.sendChat('', `/w ${this.getPlayerName()} ${makeNormalMessage(this.scriptName, heading, text)}`);
  }

  reportError(text) {
    this.roll20.sendChat('', `/w ${this.getPlayerName()} ${makeErrorMessage(this.scriptName, text)}`);
  }

  getPlayerName() {
    return this.playerId ? this.roll20.getObj('player', this.playerId).get('displayname').split(/ /)[0] : 'gm';
  }
}


module.exports = Reporter;
