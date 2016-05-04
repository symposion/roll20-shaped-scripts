'use strict';
const _ = require('underscore');
const utils = require('./utils');

class ConfigUi {

  ////////////
  // Menus
  ////////////
  getConfigOptionsMenu() {
    const optionRows =
      this.makeOptionRow({
        title: 'Advantage Tracker', path: 'atMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Token Defaults', path: 'tsMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'New Characters', path: 'ncMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Char. Sheet Enhancements', path: 'seMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Houserules & Variants', path: 'varsMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'Main Menu', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });

    return utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
  }

  getConfigOptionGroupAdvTracker(config, optionsSpec) {
    this.config = config;
    const ats = 'advTrackerSettings';
    const menu = 'atMenu';

    const optionRows =
      this.makeQuerySetting({
        path: `${ats}.output`, title: 'Output', menuCmd: menu,
        spec: optionsSpec.advTrackerSettings.output(),
      }) +
      this.makeToggleSetting({
        path: `${ats}.showMarkers`, title: 'Show Markers', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ats}.ignoreNpcs`, title: 'Ignore NPCs', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${ats}.advantageMarker`, title: 'Advantage Marker', menuCmd: menu,
        spec: optionsSpec.advTrackerSettings.advantageMarker(),
      }) +
      this.makeQuerySetting({
        path: `${ats}.disadvantageMarker`, title: 'Disadvantage Marker', menuCmd: menu,
        spec: optionsSpec.advTrackerSettings.disadvantageMarker(),
      });

    const th = utils.buildHTML('th', 'Advantage Tracker Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupTokens(config) {
    this.config = config;
    const ts = 'tokenSettings';
    const menu = 'tsMenu';

    const optionRows =
      this.makeToggleSetting({
        path: `${ts}.number`, title: 'Numbered Tokens', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ts}.showName`, title: 'Show Name Tag', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ts}.showNameToPlayers`, title: 'Show Name to Players', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.light.radius`, title: 'Light Radius', prompt: 'Light Radius (empty to unset)', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.light.dimRadius`, title: 'Dim Radius', prompt: 'Light Dim Radius (empty to unset)', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ts}.light.otherPlayers`, title: 'Other players see light', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ts}.light.hasSight`, title: 'Has Sight', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.light.angle`, title: 'Light Angle', prompt: 'Light Angle', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.light.losAngle`, title: 'LOS Angle', prompt: 'LOS Angle', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.light.multiplier`, title: 'Light Muliplier', prompt: 'Light Muliplier', menuCmd: menu,
      }) +
      this.makeOptionRow({
        title: 'Token Bar Options', path: 'barMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Token Aura Options', path: 'auraMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'Token Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupTokenBars(config) {
    this.config = config;
    const ts = 'tokenSettings';
    const menu = 'barMenu';

    let optionRows = '';

    for (let i = 1; i <= 3; i++) {
      const currAttr = utils.getObjectFromPath(config, `${ts}.bar${i}.attribute`);
      const currAttrEmptyHint = currAttr || '[not set]';
      const currMax = utils.getObjectFromPath(config, `${ts}.bar${i}.max`);
      const currLink = utils.getObjectFromPath(config, `${ts}.bar${i}.link`);

      const attBtn = this.makeOptionButton({
        path: `${ts}.bar${i}.attribute`, linkText: this.makeText(currAttrEmptyHint), tooltip: 'click to edit',
        buttonColor: currAttrEmptyHint === '[not set]' ? '#f84545' : '#02baf2', width: 60,
        command: `?{Bar ${i} Attribute (empty to unset)|${currAttr}} --${menu}`,
      });
      const maxBtn = this.makeOptionButton({
        path: `${ts}.bar${i}.max`, linkText: this.makeBoolText(currMax), tooltip: 'click to toggle',
        buttonColor: currMax ? '#65c4bd' : '#f84545', width: 60,
        command: `${!currMax} --${menu}`,
      });
      const linkBtn = this.makeOptionButton({
        path: `${ts}.bar${i}.link`, linkText: this.makeBoolText(currLink), tooltip: 'click to togle',
        buttonColor: currLink ? '#65c4bd' : '#f84545', width: 60,
        command: `${!currLink} --${menu}`,
      });

      optionRows += this.makeThreeColOptionTable({
        tableTitle: `Bar ${i}`,
        colTitles: ['Attribute', 'Max', 'Link'],
        buttons: [attBtn, maxBtn, linkBtn],
      });
    }

    for (let i = 1; i <= 3; i++) {
      optionRows += this.makeToggleSetting({
        path: `${ts}.bar${i}.showPlayers`, title: `Bar ${i} Show Players`, menuCmd: 'barMenu',
      });
    }

    const th = utils.buildHTML('th', 'Token Bar Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToTokenOptions();
  }

  getConfigOptionGroupTokenAuras(config) {
    this.config = config;
    const ts = 'tokenSettings';
    const menu = 'auraMenu';

    let optionRows = '';

    for (let i = 1; i <= 2; i++) {
      const currRad = utils.getObjectFromPath(config, `${ts}.aura${i}.radius`);
      const currRadEmptyHint = currRad || '[not set]';
      const currColor = utils.getObjectFromPath(config, `${ts}.aura${i}.color`);
      const currSquare = utils.getObjectFromPath(config, `${ts}.aura${i}.square`);

      const radBtn = this.makeOptionButton({
        path: `${ts}.aura${i}.radius`, linkText: this.makeText(currRadEmptyHint), tooltip: 'click to edit',
        buttonColor: currRadEmptyHint === '[not set]' ? '#f84545' : '#02baf2', width: 60,
        command: `?{Aura ${i} Radius (empty to unset)|${currRad}} --${menu}`,
      });
      const colorBtn = this.makeOptionButton({
        path: `tokenSettings.aura${i}.color`, linkText: this.makeText(currColor), tooltip: 'click to edit',
        buttonColor: currColor, buttonTextColor: utils.getContrastYIQ(currColor), width: 60,
        command: `?{Aura ${i} Color (hex colors)|${currColor}} --${menu}`,
      });
      const squareBtn = this.makeOptionButton({
        path: `tokenSettings.aura${i}.square`, linkText: this.makeBoolText(currSquare), tooltip: 'click to toggle',
        buttonColor: currSquare ? '#65c4bd' : '#f84545', width: 60,
        command: `${!currSquare} --${menu}`,

      });

      optionRows += this.makeThreeColOptionTable({
        tableTitle: `Aura ${i}`,
        colTitles: ['Range', 'Color', 'Square'],
        buttons: [radBtn, colorBtn, squareBtn],
      });
    }

    for (let i = 1; i <= 2; i++) {
      optionRows += this.makeToggleSetting({
        path: `${ts}.showAura${i}ToPlayers`, title: `Aura ${i} Show Players`, menuCmd: 'auraMenu',
      });
    }

    const th = utils.buildHTML('th', 'Token Aura Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToTokenOptions();
  }

  getConfigOptionGroupNewCharSettings(config, optionsSpec) {
    this.config = config;
    const menu = 'ncMenu';
    const ncs = 'newCharSettings';
    let optionRows = '';

    const spec = optionsSpec.newCharSettings;

    const currSheetOut = _.invert(spec.sheetOutput())[utils.getObjectFromPath(config, `${ncs}.sheetOutput`)];
    const currDSaveOut = _.invert(spec.deathSaveOutput())[utils.getObjectFromPath(config, `${ncs}.deathSaveOutput`)];
    const currInitOut = _.invert(spec.initiativeOutput())[utils.getObjectFromPath(config, `${ncs}.initiativeOutput`)];

    const sheetBtn = this.makeOptionButton({
      path: `${ncs}.sheetOutput`, linkText: this.makeText(currSheetOut), tooltip: 'click to change',
      buttonColor: '#02baf2', width: 60,
      command: `${this.getQueryCommand(`${ncs}.sheetOutput`, 'Sheet Output', spec.sheetOutput())}`
      + ` --${menu}`,
    });
    const dSaveBtn = this.makeOptionButton({
      path: `${ncs}.deathSaveOutput`, linkText: this.makeText(currDSaveOut), tooltip: 'click to change',
      buttonColor: '#02baf2', width: 60,
      command: `${this.getQueryCommand(`${ncs}.deathSaveOutput`, 'Death Save Output', spec.deathSaveOutput())}`
      + ` --${menu}`,
    });
    const initBtn = this.makeOptionButton({
      path: `${ncs}.initiativeOutput`, linkText: this.makeText(currInitOut), tooltip: 'click to change',
      buttonColor: '#02baf2', width: 60,
      command: `${this.getQueryCommand(`${ncs}.initiativeOutput`, 'Initiative Output', spec.initiativeOutput())}`
      + ` --${menu}`,
    });

    optionRows += this.makeThreeColOptionTable({
      tableTitle: 'Output',
      colTitles: ['Sheet', 'Death Save', 'Initiative'],
      buttons: [sheetBtn, dSaveBtn, initBtn],
    });

    optionRows +=
      this.makeToggleSetting({
        path: `${ncs}.showNameOnRollTemplate`, title: 'Show Name on Roll Template', menuCmd: menu,
        spec: optionsSpec.newCharSettings.showNameOnRollTemplate(),
      }) +
      this.makeQuerySetting({
        path: `${ncs}.rollOptions`, title: 'Roll Options', menuCmd: menu,
        spec: optionsSpec.newCharSettings.rollOptions(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoRevertAdvantage`, title: 'Revert Advantage', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${ncs}.initiativeRoll`, title: 'Init Roll', menuCmd: menu,
        spec: optionsSpec.newCharSettings.initiativeRoll(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.initiativeToTracker`, title: 'Init To Tracker', menuCmd: menu,
        spec: optionsSpec.newCharSettings.initiativeToTracker(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.breakInitiativeTies`, title: 'Break Init Ties', menuCmd: menu,
        spec: optionsSpec.newCharSettings.breakInitiativeTies(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetAC`, title: 'Show Target AC', menuCmd: menu,
        spec: optionsSpec.newCharSettings.showTargetAC(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetName`, title: 'Show Target Name', menuCmd: menu,
        spec: optionsSpec.newCharSettings.showTargetName(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoAmmo`, title: 'Auto Use Ammo', menuCmd: menu,
        spec: optionsSpec.newCharSettings.autoAmmo(),
      }) +
      this.makeQuerySetting({
        path: `${ncs}.tab`, title: 'Default tab', menuCmd: menu,
        spec: optionsSpec.newCharSettings.tab(),
      }) +
      this.makeOptionRow({
        title: 'Houserule Settings', path: 'hrMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionsGroupNewCharHouserules(config, optionsSpec) {
    this.config = config;
    const hr = 'newCharSettings.houserules';
    const menu = 'hrMenu';

    let optionRows = this.makeToggleSetting({
      path: `${hr}.savingThrowsHalfProf`, title: 'Half Proficiency Saves', menuCmd: menu,
    });
    optionRows += this.makeQuerySetting({
      path: `${hr}.mediumArmorMaxDex`, title: 'Medium Armor Max Dex', menuCmd: menu,
      spec: optionsSpec.newCharSettings.houserules.mediumArmorMaxDex(),
    });

    const th = utils.buildHTML('th', 'Houserule Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }

  getConfigOptionGroupVariants(config) {
    this.config = config;
    const root = 'variants';
    const menu = 'varsMenu';

    const optionRows = this.makeToggleSetting({
      path: `${root}.rests.longNoHpFullHd`, title: 'Long Rest: No HP, full HD', menuCmd: menu,
    });

    const th = utils.buildHTML('th', 'Houserules & Variants', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }

  getConfigOptionGroupSheetEnhancements(config) {
    this.config = config;
    const root = 'sheetEnhancements';
    const menu = 'seMenu';

    const optionRows =
      this.makeToggleSetting({
        path: `${root}.rollHPOnDrop`, title: 'Roll HP On Drop', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.autoHD`, title: 'Process HD Automatically', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.autoSpellSlots`, title: 'Process Spell Slots Automatically', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.autoTraits`, title: 'Process Traits automatically', menuCmd: menu,
      });

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

  // makeInputSetting(path, title, prompt, menuCmd) {
  makeInputSetting(params) {
    const currentVal = utils.getObjectFromPath(this.config, params.path);
    // let emptyHint = '[not set]';
    // if (currentVal) {
    //   emptyHint = currentVal;
    // }

    params.command = `?{${params.prompt}|${currentVal}}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = currentVal || '[not set]';
    params.tooltip = 'click to edit';
    params.buttonColor = params.linkText === '[not set]' ? '#f84545' : '#02baf2';

    return this.makeOptionRow(params);
    // return this.makeOptionRow(options.title, options.path,
    //   `?{${prompt}|${currentVal}}${!_.isUndefined(options.menuCmd) ? ` --${options.menuCmd}` : ''}`,
    //   emptyHint, 'click to edit', emptyHint === '[not set]' ? '#f84545' : '#02baf2');
  }

  // noinspection JSUnusedGlobalSymbols
  // makeColorSetting(path, title, prompt) {
  makeColorSetting(params) {
    const currentVal = utils.getObjectFromPath(this.config, params.path);
    // let emptyHint = '[not set]';

    // if (currentVal) {
    //   emptyHint = currentVal;
    // }

    // const buttonColor = emptyHint === '[not set]' ? '#02baf2' : currentVal;

    params.command = `?{${params.prompt}|${currentVal}}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = currentVal || '[not set]';
    params.tooltip = 'click to edit';
    params.buttonColor = params.linkText === '[not set]' ? '#02baf2' : currentVal;
    params.buttonTextColor = utils.getContrastYIQ(params.buttonColor);

    return this.makeOptionRow(params);

    // return this.makeOptionRow(options.title, options.path, `?{${prompt}|${currentVal}}`, emptyHint, 'click to edit',
    //  buttonColor,
    //   utils.getContrastYIQ(buttonColor));
  }

  // makeToggleSetting(path, title, optionsSpec, menuCmd) {
  makeToggleSetting(params) {
    let currentVal = utils.getObjectFromPath(this.config, params.path);
    if (params.spec) {
      currentVal = _.invert(params.spec)[currentVal] === 'true';
    }

    params.command = `${!currentVal}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = this.makeBoolText(currentVal);
    params.tooltip = 'click to toggle';
    params.buttonColor = currentVal ? '#65c4bd' : '#f84545';

    return this.makeOptionRow(params);

    // return this.makeOptionRow(options.title, options.path,
    //   `${!currentVal}${!_.isUndefined(options.menuCmd) ? ` --${options.menuCmd}` : ''}`,
    //   this.makeBoolText(currentVal), 'click to toggle', currentVal ? '#65c4bd' : '#f84545');
  }

  // makeQuerySetting(path, title, optionsSpec, menuCmd) {
  makeQuerySetting(params) {
    const currentVal = _.invert(params.spec)[utils.getObjectFromPath(this.config, params.path)];
    const cmd = this.getQueryCommand(params.path, params.title, params.spec);

    params.command = `${cmd}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = this.makeText(currentVal);
    params.tooltip = 'click to change';
    params.buttonColor = '#02baf2';

    return this.makeOptionRow(params);

    // return this.makeOptionRow(options.title, options.path,
    //   `${cmd}${!_.isUndefined(options.menuCmd) ? ` --${options.menuCmd}` : ''}`,
    //   this.makeText(currentVal), 'click to change', '#02baf2');
  }

  getQueryCommand(path, title, optionsSpec) {
    let currentVal = _.invert(optionsSpec)[utils.getObjectFromPath(this.config, path)];
    const optionList = _.keys(optionsSpec);

    // Fix up if we've somehow ended up with an illegal value
    if (_.isUndefined(currentVal)) {
      currentVal = _.first(optionList);
      utils.deepExtend(this.config, utils.createObjectFromPath(path, optionsSpec[currentVal]));
    }

    // move the current option to the front of the list
    optionList.splice(optionList.indexOf(currentVal), 1);
    optionList.unshift(currentVal);

    return `?{${title}|${optionList.join('|')}}`;
  }

  // makeOptionRow(optionTitle, path, command, linkText, tooltip, buttonColor, buttonTextColor) {
  makeOptionRow(params) {
    const col1 = utils.buildHTML('td', params.title);
    const col2 = utils.buildHTML('td', this.makeOptionButton(params), { style: 'text-align:right;' });

    return utils.buildHTML('tr', col1 + col2, { style: 'border: 1px solid gray;' });
  }

  // makeOptionButton(path, command, linkText, tooltip, buttonColor, buttonTextColor, width) {
  makeOptionButton(params) {
    if (_.isUndefined(params.width)) {
      params.width = 80;
    }

    let css = `text-align: center; width: ${params.width}px; margin: 2px 0 -3px 0; ` +
      'padding: 2px 2px ; border-radius: 10px; border-color: #c0c0c0;' +
      `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background-color: ${params.buttonColor};`;
    if (params.buttonTextColor) {
      css += `color: ${params.buttonTextColor}`; // 'color: ' + buttonTextColor + '; ';
    }

    return utils.buildHTML('a', params.linkText, {
      style: css,
      href: `!shaped-config --${params.path} ${params.command}`, // '!shaped-config --' + path + ' ' + command
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

  makeThreeColOptionTable(options) {
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
