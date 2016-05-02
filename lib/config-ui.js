'use strict';
const _ = require('underscore');
const utils = require('./utils');

class ConfigUi {

  ////////////
  // Menus
  ////////////
  getConfigOptionsMenu() {
    const optionRows = this.makeOptionRow('Advantage Tracker', 'atMenu', '', 'view --&gt;', '', '#02baf2') +
      this.makeOptionRow('Token Defaults', 'tsMenu', '', 'view --&gt;', '', '#02baf2') +
      this.makeOptionRow('New Characters', 'ncMenu', '', 'view --&gt;', '', '#02baf2') +
      this.makeOptionRow('Character Sheet Enhancements', 'seMenu', '', 'view --&gt;', '', '#02baf2') +
      this.makeOptionRow('Houserules & Variants', 'varsMenu', '', 'view --&gt;', '', '#02baf2');

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
    const ts = 'tokenSettings';

    const optionRows = this.makeToggleSetting(config, `${ts}.number`, 'Numbered Tokens') +
      this.makeToggleSetting(config, `${ts}.showName`, 'Show Name Tag') +
      this.makeToggleSetting(config, `${ts}.showNameToPlayers`, 'Show Name to Players') +
      this.makeInputSetting(config, `${ts}.light.radius`, 'Light Radius', 'Light Radius (empty to unset)') +
      this.makeInputSetting(config, `${ts}.light.dimRadius`, 'Dim Radius', 'Light Dim Radius (empty to unset)') +
      this.makeToggleSetting(config, `${ts}.light.otherPlayers`, 'Other players see light') +
      this.makeToggleSetting(config, `${ts}.light.hasSight`, 'Has Sight') +
      this.makeInputSetting(config, `${ts}.light.angle`, 'Light Angle', 'Light Angle') +
      this.makeInputSetting(config, `${ts}.light.losAngle`, 'LOS Angle', 'LOS Angle') +
      this.makeInputSetting(config, `${ts}.light.multiplier`, 'Light Muliplier', 'Light Muliplier') +
      this.makeOptionRow('Token Bar Options', 'barMenu', '', 'view --&gt;', '', '#02baf2') +
      this.makeOptionRow('Token Aura Options', 'auraMenu', '', 'view --&gt;', '', '#02baf2');

    const th = utils.buildHTML('th', 'Token Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupTokenBars(config) {
    const barButtonWidth = 60;
    const ts = 'tokenSettings';

    let optionRows = '';

    for (let i = 1; i <= 3; i++) {
      const currAttr = utils.getObjectFromPath(config, `${ts}.bar${i}.attribute`);
      const currAttrEmptyHint = currAttr || '[not set]';
      const currMax = utils.getObjectFromPath(config, `${ts}.bar${i}.max`);
      const currLink = utils.getObjectFromPath(config, `${ts}.bar${i}.link`);

      const attBtn = this.makeOptionButton(`${ts}.bar${i}.attribute`,
        `?{Bar ${i} Attribute (empty to unset)|${currAttr}} --barMenu`, this.makeText(currAttrEmptyHint),
        'click to edit', currAttrEmptyHint === '[not set]' ? '#f84545' : '#02baf2', undefined, barButtonWidth);
      const maxBtn = this.makeOptionButton(`${ts}.bar${i}.max`, `${!currMax} --barMenu`, this.makeBoolText(currMax),
        'click to toggle', currMax ? '#65c4bd' : '#f84545', undefined, barButtonWidth);
      const linkBtn = this.makeOptionButton(`${ts}.bar${i}.link`, `${!currLink} --barMenu`, this.makeBoolText(currLink),
        'click to togle', currLink ? '#65c4bd' : '#f84545', undefined, barButtonWidth);

      optionRows += this.makeThreColOptionTable({
        tableTitle: `Bar ${i}`,
        colTitles: ['Attribute', 'Max', 'Link'],
        buttons: [attBtn, maxBtn, linkBtn],
      });
    }

    for (let i = 1; i <= 3; i++) {
      optionRows += this.makeToggleSetting(config, `${ts}.bar${i}.showPlayers`,
        `Bar ${i} Show Players`, null, 'barMenu');
    }

    const th = utils.buildHTML('th', 'Token Bar Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToTokenOptions();
  }

  getConfigOptionGroupTokenAuras(config) {
    const auraButtonWidth = 60;

    const ts = 'tokenSettings';

    let optionRows = '';

    for (let i = 1; i <= 2; i++) {
      const currRad = utils.getObjectFromPath(config, `${ts}.aura${i}.radius`);
      const currRadEmptyHint = currRad || '[not set]';
      const currColor = utils.getObjectFromPath(config, `${ts}.aura${i}.color`);
      const currSquare = utils.getObjectFromPath(config, `${ts}.aura${i}.square`);

      const radBtn = this.makeOptionButton(`${ts}.aura${i}.radius`,
        `?{Aura ${i} Radius (empty to unset)|${currRad}} --auraMenu`, this.makeText(currRadEmptyHint), 'click to edit',
        currRadEmptyHint === '[not set]' ? '#f84545' : '#02baf2', undefined, auraButtonWidth);
      const colorBtn = this.makeOptionButton(`tokenSettings.aura${i}.color`,
        `?{Aura ${i} Color (hex colors)|${currColor}} --auraMenu`, this.makeText(currColor), 'click to edit',
        currColor, utils.getContrastYIQ(currColor), auraButtonWidth);
      const squareBtn = this.makeOptionButton(`tokenSettings.aura${i}.square`, `${!currSquare} --auraMenu`,
        this.makeBoolText(currSquare), 'click to toggle', currSquare ? '#65c4bd' : '#f84545',
        undefined, auraButtonWidth);

      optionRows += this.makeThreColOptionTable({
        tableTitle: `Aura ${i}`,
        colTitles: ['Range', 'Color', 'Square'],
        buttons: [radBtn, colorBtn, squareBtn],
      });
    }

    for (let i = 1; i <= 2; i++) {
      optionRows += this.makeToggleSetting(config, `${ts}.showAura${i}ToPlayers`, `Aura ${i} Show Players`,
        null, 'auraMenu');
    }

    const th = utils.buildHTML('th', 'Token Aura Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToTokenOptions();
  }

  getConfigOptionGroupNewCharSettings(config, optionsSpec) {
    const ncs = 'newCharSettings';
    let optionRows = '';

    const spec = optionsSpec.newCharSettings;

    const currSheetOut = _.invert(spec.sheetOutput())[utils.getObjectFromPath(config, `${ncs}.sheetOutput`)];
    const currDSaveOut = _.invert(spec.deathSaveOutput())[utils.getObjectFromPath(config, `${ncs}.deathSaveOutput`)];
    const currInitOut = _.invert(spec.initiativeOutput())[utils.getObjectFromPath(config, `${ncs}.initiativeOutput`)];

    const sheetBtn = this.makeOptionButton(`${ncs}.sheetOutput`,
      this.getQueryCommand(config, `${ncs}.sheetOutput`, 'Sheet Output',
        optionsSpec.newCharSettings.sheetOutput()), this.makeText(currSheetOut),
      'click to change', '#02baf2', null, 60);
    const dSaveBtn = this.makeOptionButton(`${ncs}.deathSaveOutput`,
      this.getQueryCommand(config, `${ncs}.deathSaveOutput`, 'Deat Save Output',
        optionsSpec.newCharSettings.deathSaveOutput()), this.makeText(currDSaveOut),
      'click to change', '#02baf2', null, 60);
    const initBtn = this.makeOptionButton(`${ncs}.initiativeOutput`,
      this.getQueryCommand(config, `${ncs}.initiativeOutput`, 'Initiative Output',
        optionsSpec.newCharSettings.initiativeOutput()), this.makeText(currInitOut),
      'click to change', '#02baf2', null, 60);

    optionRows += this.makeThreColOptionTable({
      tableTitle: 'Output',
      colTitles: ['Sheet', 'Death Save', 'Initiative'],
      buttons: [sheetBtn, dSaveBtn, initBtn],
    });

    optionRows += this.makeToggleSetting(config, `${ncs}.showNameOnRollTemplate`, 'Show Name on Roll Template',
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
      this.makeQuerySetting(config, `${ncs}.tab`, 'Default tab',
        optionsSpec.newCharSettings.tab()) +
      this.makeOptionRow('Houserule Settings', 'hrMenu', '', 'view --&gt;', '', '#02baf2');

    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionsGroupNewCharHouserules(config, optionsSpec) {
    const hr = 'newCharSettings.houserules';

    let optionRows = this.makeToggleSetting(config, `${hr}.savingThrowsHalfProf`, 'Half Proficiency Saves',
      null, 'hrMenu');
    optionRows += this.makeQuerySetting(config, `${hr}.mediumArmorMaxDex`, 'Medium Armor Max Dex',
      optionsSpec.newCharSettings.houserules.mediumArmorMaxDex(), 'hrMenu');

    const th = utils.buildHTML('th', 'Houserule Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }

  getConfigOptionGroupVariants(config) {
    const root = 'variants';

    const optionRows = this.makeToggleSetting(config, `${root}.rests.longNoHpFullHd`, 'Long Rest: No HP, full HD');

    const th = utils.buildHTML('th', 'Houserules & Variants', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupSheetEnhancements(config) {
    const root = 'sheetEnhancements';
    const optionRows = this.makeToggleSetting(config, `${root}.rollHPOnDrop`, 'Roll HP On Drop') +
      this.makeToggleSetting(config, `${root}.autoHD`, 'Process HD Automatically') +
      this.makeToggleSetting(config, `${root}.autoSpellSlots`, 'Process Spell Slots Automatically') +
      this.makeToggleSetting(config, `${root}.autoTraits`, 'Process Traits automatically');

    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
    return table + this.backToMainMenuButton();
  }

  backToMainMenuButton() {
    return utils.buildHTML('a', '&lt;-- Main Menu', {
      href: '!shaped-config',
      style: 'text-align: center; margin: 5px 0 0 0; padding: 2px 2px ; border-radius: 10px; white-space: nowrap; ' +
      'overflow: hidden; text-overflow: ellipsis; background-color: #02baf2; border-color: #c0c0c0;',
    });
  }

  backToTokenOptions() {
    return utils.buildHTML('a', '&lt;-- Token Options', {
      href: '!shaped-config --tsMenu',
      style: 'text-align: center; margin: 5px 0 0 0; padding: 2px 2px ; border-radius: 10px; white-space: nowrap; ' +
      'overflow: hidden; text-overflow: ellipsis; background-color: #02baf2; border-color: #c0c0c0;',
    });
  }

  backToNewCharOptions() {
    return utils.buildHTML('a', '&lt;-- New Character Options', {
      href: '!shaped-config --ncMenu',
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

  makeToggleSetting(config, path, title, optionsSpec, menuCommand) {
    let currentVal = utils.getObjectFromPath(config, path);
    if (optionsSpec) {
      currentVal = _.invert(optionsSpec)[currentVal] === 'true';
    }

    return this.makeOptionRow(title, path, `${!currentVal}${!_.isUndefined(menuCommand) ? ` --${menuCommand}` : ''}`,
      this.makeBoolText(currentVal), 'click to toggle', currentVal ? '#65c4bd' : '#f84545');
  }

  makeQuerySetting(config, path, title, optionsSpec, menuCommand) {
    const currentVal = _.invert(optionsSpec)[utils.getObjectFromPath(config, path)];
    const cmd = this.getQueryCommand(config, path, title, optionsSpec);
    return this.makeOptionRow(title, path, `${cmd}${!_.isUndefined(menuCommand) ? ` --${menuCommand}` : ''}`,
      this.makeText(currentVal), 'click to change', '#02baf2');
  }

  getQueryCommand(config, path, title, optionsSpec) {
    let currentVal = _.invert(optionsSpec)[utils.getObjectFromPath(config, path)];
    const optionList = _.keys(optionsSpec);

    // Fix up if we've somehow ended up with an illegal value
    if (_.isUndefined(currentVal)) {
      currentVal = _.first(optionList);
      utils.deepExtend(config, utils.createObjectFromPath(path, optionsSpec[currentVal]));
    }

    // move the current option to the front of the list
    optionList.splice(optionList.indexOf(currentVal), 1);
    optionList.unshift(currentVal);

    return `?{${title}|${optionList.join('|')}}`;
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

    let css = `text-align: center; width: ${width}px; margin: 2px 0 -3px 0; ` +
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

  makeThreColOptionTable(options) {
    return utils
      .buildHTML('tr', [
        {
          tag: 'td',
          innerHtml: [
            {
              tag: 'table',
              innerHtml: [
                {
                  tag: 'tr',
                  innerHtml: [{ tag: 'th', innerHtml: options.tableTitle, attrs: { colspan: 3 } }],
                },
                {
                  tag: 'tr',
                  innerHtml: [
                    {
                      tag: 'td',
                      innerHtml: options.colTitles[0],
                    },
                    {
                      tag: 'td',
                      innerHtml: options.colTitles[1],
                    },
                    {
                      tag: 'td',
                      innerHtml: options.colTitles[2],
                    },
                  ],
                  attrs: { style: 'line-height: 1;' },
                },
                {
                  tag: 'tr',
                  innerHtml: [
                    {
                      tag: 'td',
                      innerHtml: options.buttons[0],
                    },
                    {
                      tag: 'td',
                      innerHtml: options.buttons[1],
                    },
                    {
                      tag: 'td',
                      innerHtml: options.buttons[2],
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
