'use strict';
const _ = require('underscore');
const utils = require('./utils');

class ConfigUi {

  ////////////
  // Menus
  ////////////
  // noinspection JSUnusedGlobalSymbols
  getConfigOptionsAll(config, optionsSpec) {
    return this.getConfigOptionGroupAdvTracker(config, optionsSpec) +
      this.getConfigOptionGroupTokens(config, optionsSpec) +
      this.getConfigOptionGroupNewCharSettings(config, optionsSpec);
  }

  getConfigOptionsMenu() {
    const optionRows = this.makeOptionRow('Advantage Tracker', 'atMenu', '', 'view', '', '#02baf2') +
      this.makeOptionRow('Token Defaults', 'tsMenu', '', 'view', '', '#02baf2') +
      this.makeOptionRow('New Characters', 'ncMenu', '', 'view', '', '#02baf2') +
      this.makeOptionRow('Character Sheet Enhancements', 'seMenu', '', 'view', '', '#02baf2');

    const th = utils.buildHTML('th', 'Main Menu', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });

    return utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
  }

  getConfigOptionGroupAdvTracker(config, optionsSpec) {
    const ats = 'advTrackerSettings';
    const optionRows =
      this.makeQuerySetting(config, `${ats}.output`, 'Output', optionsSpec.advTrackerSettings.output()) +
      this.makeToggleSetting(config, `${ats}.showMarkers`, 'Show Markers') +
      this.makeToggleSetting(config, `${ats}.ignoreNpcs`, 'Ignore NPCs') +
      this.makeQuerySetting(config, `${ats}.advantageMarker`, 'Advantage Marker',
        optionsSpec.advTrackerSettings.advantageMarker()) +
      this.makeQuerySetting(config, `${ats}.disadvantageMarker`, 'Disadvantage Marker',
        optionsSpec.advTrackerSettings.disadvantageMarker());

    const th = utils.buildHTML('th', 'Advantage Tracker Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupTokens(config) {
    const auraButtonWidth = 60;
    const ts = 'tokenSettings';

    let retVal = '<table style="width: 100%; font-size: 0.9em;">' +
      '<tr style="margin-top: 5px;"><th colspan=2>Token Options</th></tr>';

    retVal +=
      this.makeToggleSetting(config, `${ts}.number`, 'Numbered Tokens') +
      this.makeToggleSetting(config, `${ts}.showName`, 'Show Name Tag') +
      this.makeToggleSetting(config, `${ts}.showNameToPlayers`, 'Show Name to Players');

    for (let i = 1; i <= 3; i++) {
      retVal += this.makeInputSetting(config, `${ts}.bar${i}.attribute`, `Bar ${i} Attribute`,
        `Bar ${i} Attribute (empty to unset)`);
      retVal += this.makeToggleSetting(config, `${ts}.bar${i}.max`, `Bar ${i} Set Max`);
      retVal += this.makeToggleSetting(config, `${ts}.bar${i}.link`, `Bar ${i} Link`);
      retVal += this.makeToggleSetting(config, `${ts}.bar${i}.showPlayers`, `Bar ${i} Show Players`);
    }

    // Build out the aura grids
    for (let i = 1; i <= 2; i++) {
      const currRad = utils.getObjectFromPath(config, `${ts}.aura${i}.radius`);
      const currRadEmptyHint = currRad || '[not set]';
      const currColor = utils.getObjectFromPath(config, `${ts}.aura${i}.color`);
      const currSquare = utils.getObjectFromPath(config, `${ts}.aura${i}.square`);

      const radBtn = this.makeOptionButton(`${ts}.aura${i}.radius`, `?{Aura ${i} Radius (empty to unset)|${currRad}}`,
        this.makeText(currRadEmptyHint), 'click to edit', currRadEmptyHint === '[not set]' ? '#f84545' : '#02baf2',
        undefined, auraButtonWidth);
      const colorBtn = this.makeOptionButton(`tokenSettings.aura${i}.color`,
        `?{Aura ${i} Color (hex colors)|${currColor}}`,
        this.makeText(currColor), 'click to edit', currColor, utils.getContrastYIQ(currColor), auraButtonWidth);
      const squareBtn = this.makeOptionButton(`tokenSettings.aura${i}.square`, !currSquare,
        this.makeBoolText(currSquare), 'click to toggle', currSquare ? '#65c4bd' : '#f84545',
        undefined, auraButtonWidth);

      retVal += utils
        .buildHTML('tr', [
          {
            tag: 'td',
            innerHtml: [
              {
                tag: 'table',
                innerHtml: [
                  {
                    tag: 'tr',
                    innerHtml: [{ tag: 'th', innerHtml: `Aura${i}`, attrs: { colspan: 3 } }],
                  },
                  {
                    tag: 'tr',
                    innerHtml: [
                      {
                        tag: 'td',
                        innerHtml: 'Range',
                      },
                      {
                        tag: 'td',
                        innerHtml: 'Color',
                      },
                      {
                        tag: 'td',
                        innerHtml: 'Square',
                      },
                    ],
                  },
                  {
                    tag: 'tr',
                    innerHtml: [
                      {
                        tag: 'td',
                        innerHtml: radBtn,
                      },
                      {
                        tag: 'td',
                        innerHtml: colorBtn,
                      },
                      {
                        tag: 'td',
                        innerHtml: squareBtn,
                      },
                    ],
                  },
                ],
                attrs: { style: 'width: 100%; text-align: center;' },
              },
            ], attrs: { colspan: '2' },
          },
        ], { style: 'border: 1px solid gray;' });
    }

    // Vision\Light options
    retVal += this.makeInputSetting(config, `${ts}.light.radius`, 'Light Radius', 'Light Radius (empty to unset)');
    retVal += this.makeInputSetting(config, `${ts}.light.dimRadius`, 'Dim Radius', 'Light Dim Radius (empty to unset)');
    retVal += this.makeToggleSetting(config, `${ts}.light.otherPlayers`, 'Show other players');
    retVal += this.makeToggleSetting(config, `${ts}.light.hasSight`, 'Has Sight');
    retVal += this.makeInputSetting(config, `${ts}.light.angle`, 'Light Angle', 'Light Amgle');
    retVal += this.makeInputSetting(config, `${ts}.light.losAngle`, 'LOS Angle', 'LOS Angle');
    retVal += this.makeInputSetting(config, `${ts}.light.multiplier`, 'Light Muliplier', 'Light Muliplier');

    retVal += `</table>${this.backToMainMenuButton()}`;

    return retVal;
  }

  getConfigOptionGroupNewCharSettings(config, optionsSpec) {
    const ncs = 'newCharSettings';

    const optionRows = this.makeQuerySetting(config, `${ncs}.sheetOutput`, 'Sheet Output',
        optionsSpec.newCharSettings.sheetOutput()) +
      this.makeQuerySetting(config, `${ncs}.deathSaveOutput`,
        'Death Save Output', optionsSpec.newCharSettings.deathSaveOutput()) +
      this.makeQuerySetting(config, `${ncs}.initiativeOutput`, 'Initiative Output',
        optionsSpec.newCharSettings.initiativeOutput()) +
      this.makeToggleSetting(config, `${ncs}.showNameOnRollTemplate`, 'Show Name on Roll Template',
        optionsSpec.newCharSettings.showNameOnRollTemplate()) +
      this.makeQuerySetting(config, `${ncs}.rollOptions`, 'Roll Options',
        optionsSpec.newCharSettings.rollOptions()) +
      this.makeToggleSetting(config, `${ncs}.autoRevertAdvantage`, 'Revert Advantage') +
      this.makeQuerySetting(config, `${ncs}.initiativeRoll`, 'Init Roll',
        optionsSpec.newCharSettings.initiativeRoll()) +
      this.makeToggleSetting(config, `${ncs}.initiativeToTracker`, 'Init To Tracker',
        optionsSpec.newCharSettings.initiativeToTracker()) +
      this.makeToggleSetting(config, `${ncs}.breakInitiativeTies`, 'Break Init Ties',
        optionsSpec.newCharSettings.breakInitiativeTies()) +
      this.makeToggleSetting(config, `${ncs}.showTargetAC`, 'Show Target AC',
        optionsSpec.newCharSettings.showTargetAC()) +
      this.makeToggleSetting(config, `${ncs}.showTargetName`, 'Show Target Name',
        optionsSpec.newCharSettings.showTargetName()) +
      this.makeToggleSetting(config, `${ncs}.autoAmmo`, 'Auto Use Ammo',
        optionsSpec.newCharSettings.autoAmmo()) +
      this.makeOptionRow('Houserule Settings', 'hrMenu', '', 'view', '', '#02baf2');

    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionsGroupHouserules(config, optionsSpec) {
    const hr = 'newCharSettings.houserules';

    const optionRows = this.makeToggleSetting(config, `${hr}.savingThrowsHalfProf`, 'Half Proficiency Saves') +
      this.makeQuerySetting(config, `${hr}.mediumArmorMaxDex`, 'Medium Armor Max Dex',
        optionsSpec.newCharSettings.houserules.mediumArmorMaxDex());

    const th = utils.buildHTML('th', 'Houserule Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupSheetEnhancements(config) {
    const optionRows = this.makeToggleSetting(config, 'sheetEnhancements.rollHPOnDrop', 'Roll HP On Drop') +
      this.makeToggleSetting(config, 'sheetEnhancements.autoHD', 'Process HD Automatically') +
      this.makeToggleSetting(config, 'sheetEnhancements.autoSpellSlots', 'Process Spell Slots Automatically');
    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
    return table + this.backToMainMenuButton();
  }

  backToMainMenuButton() {
    return utils.buildHTML('a', 'back to main menu', {
      href: '!shaped-config',
      style: 'text-align: center; margin: 5px 0 0 0; padding: 2px 2px ; border-radius: 10px; white-space: nowrap; ' +
      'overflow: hidden; text-overflow: ellipsis; background-color: #02baf2; border-color: #c0c0c0;',
    });
  }

  makeInputSetting(config, path, title, prompt) {
    const currentVal = utils.getObjectFromPath(config, path);
    let emptyHint = '[not set]';
    if (currentVal) {
      emptyHint = currentVal;
    }

    return this.makeOptionRow(title, path, `?{${prompt}|${currentVal}}`, emptyHint, 'click to edit', emptyHint ===
    '[not set]' ? '#f84545' : '#02baf2');
  }

  // noinspection JSUnusedGlobalSymbols
  makeColorSetting(config, path, title, prompt) {
    const currentVal = utils.getObjectFromPath(config, path);
    let emptyHint = '[not set]';

    if (currentVal) {
      emptyHint = currentVal;
    }

    const buttonColor = emptyHint === '[not set]' ? '#02baf2' : currentVal;

    return this.makeOptionRow(title, path, `?{${prompt}|${currentVal}}`, emptyHint, 'click to edit', buttonColor,
      utils.getContrastYIQ(buttonColor));
  }

  makeToggleSetting(config, path, title, optionsSpec) {
    let currentVal = utils.getObjectFromPath(config, path);
    if (optionsSpec) {
      currentVal = _.invert(optionsSpec)[currentVal] === 'true';
    }

    return this.makeOptionRow(title, path, !currentVal,
      this.makeBoolText(currentVal), 'click to toggle', currentVal ? '#65c4bd' : '#f84545');
  }

  makeQuerySetting(config, path, title, optionsSpec) {
    const currentVal = _.invert(optionsSpec)[utils.getObjectFromPath(config, path)];
    const optionList = _.keys(optionsSpec);

    // move the current option to the front of the list
    optionList.splice(optionList.indexOf(currentVal), 1);
    optionList.unshift(currentVal);

    return this.makeOptionRow(title, path, `?{${title}|${optionList.join('|')}}`, this.makeText(currentVal),
      'click to change', '#02baf2');
  }

  makeOptionRow(optionTitle, path, command, linkText, tooltip, buttonColor, buttonTextColor) {
    const col1 = utils.buildHTML('td', optionTitle);
    const col2 = utils.buildHTML('td', this.makeOptionButton(path, command, linkText, tooltip, buttonColor,
      buttonTextColor), { style: 'text-align:right;' });

    return utils.buildHTML('tr', col1 + col2, { style: 'border: 1px solid gray;' });
  }

  makeOptionButton(path, command, linkText, tooltip, buttonColor, buttonTextColor, width) {
    if (_.isUndefined(width)) {
      width = 80;
    }

    let css = `text-align: center; width: ${width}px; margin: 5px 0 0 0; ` +
      'padding: 2px 2px ; border-radius: 10px; border-color: #c0c0c0;' +
      `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background-color: ${buttonColor};`;
    if (buttonTextColor) {
      css += `color: ${buttonTextColor}`; // 'color: ' + buttonTextColor + '; ';
    }

    return utils.buildHTML('a', linkText, {
      style: css,
      href: `!shaped-config --${path} ${command}`, // '!shaped-config --' + path + ' ' + command
    });
  }

  makeText(value) {
    return utils.buildHTML('span', value, { style: 'padding: 0 2px;' });
  }

  makeBoolText(value) {
    return value === true ?
      utils.buildHTML('span', 'on', { style: 'padding: 0 2px;' }) :
      utils.buildHTML('span', 'off', { style: 'padding: 0 2px;' });
  }

  static validStatusMarkers() {
    const markers = [
      'red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow', 'dead', 'skull', 'sleepy',
      'half-heart', 'half-haze', 'interdiction', 'snail', 'lightning-helix', 'spanner', 'chained-heart',
      'chemical-bolt', 'death-zone', 'drink-me', 'edge-crack', 'ninja-mask', 'stopwatch', 'fishing-net', 'overdrive',
      'strong', 'fist', 'padlock', 'three-leaves', 'fluffy-wing', 'pummeled', 'tread', 'arrowed', 'aura',
      'back-pain', 'black-flag', 'bleeding-eye', 'bolt-shield', 'broken-heart', 'cobweb', 'broken-shield',
      'flying-flag', 'radioactive', 'trophy', 'broken-skull', 'frozen-orb', 'rolling-bomb', 'white-tower',
      'grab', 'screaming', 'grenade', 'sentry-gun', 'all-for-one', 'angel-outfit', 'archery-target',
    ];

    const obj = {};
    for (let i = 0; i < markers.length; i++) {
      obj[markers[i]] = markers[i];
    }

    return obj;
  }
}

module.exports = ConfigUi;
