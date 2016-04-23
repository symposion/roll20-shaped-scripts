'use strict';

class Reporter {

  constructor(roll20, scriptName) {
    this.roll20 = roll20;
    this.scriptName = scriptName;
  }

  report(heading, text) {
    // Horrible bug with this at the moment - seems to generate spurious chat
    // messages when noarchive:true is set
    // sendChat('ShapedScripts', '' + msg, null, {noarchive:true});

    this.roll20.sendChat('',
      '/w gm <div style="border: 1px solid black; background-color: white; padding: 3px 3px;">' +
      '<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">' +
      `${this.scriptName} ${heading}</div>${text}</div>`);
  }

  reportError(text) {
    this.roll20.sendChat('',
      '/w gm <div style="border: 1px solid black; background-color: white; padding: 3px 3px;">' +
      '<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;color:red;">' +
      `${this.scriptName}</div>${text}</div>`);
  }
}


module.exports = Reporter;
