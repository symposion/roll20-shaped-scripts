'use strict';
const _ = require('underscore');
const utils = require('./../utils');
const ShapedModule = require('./../shaped-module');
const ShapedConfig = require('./../shaped-config');

class ConfigUi extends ShapedModule {

  addCommands(commandProcessor) {
    const menus = {
      atMenu: new AdvantageTrackerMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      tsMenu: new TokensMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      barMenu: new TokenBarsMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      auraMenu: new TokenAurasMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      ncMenu: new NewCharacterMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      taMenu: new TokenActionsMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      hideMenu: new HideMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      hrMenu: new NewCharacterHouseruleMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      savesMenu: new SavesMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      fortitudeMenu: new CustomSaveTypeMenu(this.myState.config, ShapedConfig.configOptionsSpec, 'fortitude'),
      reflexMenu: new CustomSaveTypeMenu(this.myState.config, ShapedConfig.configOptionsSpec, 'reflex'),
      willMenu: new CustomSaveTypeMenu(this.myState.config, ShapedConfig.configOptionsSpec, 'will'),
      textMenu: new NewCharacterTextSizeMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      varsMenu: new VariantsMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      seMenu: new SheetEnhancementsMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      displayMenu: new DisplayMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      msMenu: new MeasurementSystemsMenu(this.myState.config, ShapedConfig.configOptionsSpec),
      initMenu: new InitiativeMenu(this.myState.config, ShapedConfig.configOptionsSpec),
    };

    _.each(menus, menu => this.logger.wrapModule(menu));

    return commandProcessor.addCommand('config', this.process.bind(this), true)
      .options(ShapedConfig.configOptionsSpec)
      .optionLookup('menu', menus);
  }

  process(options) {
    // drop "menu" options
    utils.deepExtend(this.myState.config, _.omit(options, 'menu'));

    if (options.menu) {
      this.reportPlayer('Configuration', options.menu[0].getMenu(), options.playerId);
    }
    else if (_.isEmpty(_.omit(options, 'menu', 'playerId'))) {
      const menu = new MainMenu(this.myState.config, ShapedConfig.configOptionsSpec);
      this.reportPlayer('Configuration', menu.getMenu(), options.playerId);
    }
  }
}

module.exports = ConfigUi;

/////////////////////////////////////////////////
// Menu Base
/////////////////////////////////////////////////
class ConfigMenu {
  constructor(config, specRoot) {
    this.config = config;
    this.specRoot = specRoot;
  }

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
  }

  makeQuerySetting(params) {
    const currentVal = _.invert(params.spec)[utils.getObjectFromPath(this.config, params.path)];
    const cmd = this.getQueryCommand(params.path, params.title, params.spec);

    params.command = `${cmd}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = this.makeText(currentVal);
    params.tooltip = 'click to change';
    params.buttonColor = '#02baf2';

    return this.makeOptionRow(params);
  }

  makeInputSetting(params) {
    const currentVal = utils.getObjectFromPath(this.config, params.path);

    params.command = `?{${params.prompt}|${currentVal}}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = currentVal || '[not set]';
    params.tooltip = 'click to edit';
    params.buttonColor = params.linkText === '[not set]' ? '#f84545' : '#02baf2';

    return this.makeOptionRow(params);
  }

  // noinspection JSUnusedGlobalSymbols
  makeColorSetting(params) {
    const currentVal = utils.getObjectFromPath(this.config, params.path);

    params.command = `?{${params.prompt}|${currentVal}}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = currentVal || '[not set]';
    params.tooltip = 'click to edit';
    params.buttonColor = params.linkText === '[not set]' ? '#02baf2' : currentVal;
    params.buttonTextColor = utils.getContrastYIQ(params.buttonColor);

    return this.makeOptionRow(params);
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

  backToHouseRuleOptions() {
    return utils.buildHTML('a', '&lt;-- Houserule Options', {
      href: '!shaped-config --hrMenu',
      style: 'text-align: center; margin: 5px 0 0 0; padding: 2px 2px ; border-radius: 10px; white-space: nowrap; ' +
      'overflow: hidden; text-overflow: ellipsis; background-color: #02baf2; border-color: #c0c0c0;',
    });
  }

  backToSavesOptions() {
    return utils.buildHTML('a', '&lt;-- Saves Options', {
      href: '!shaped-config --savesMenu',
      style: 'text-align: center; margin: 5px 0 0 0; padding: 2px 2px ; border-radius: 10px; white-space: nowrap; ' +
      'overflow: hidden; text-overflow: ellipsis; background-color: #02baf2; border-color: #c0c0c0;',
    });
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

  makeOptionRow(params) {
    const col1 = utils.buildHTML('td', params.title);
    const col2 = utils.buildHTML('td', this.makeOptionButton(params), { style: 'text-align:right;' });

    return utils.buildHTML('tr', col1 + col2, { style: 'border: 1px solid gray;' });
  }

  makeOptionButton(params) {
    if (_.isUndefined(params.width)) {
      params.width = 80;
    }

    let css = `text-align: center; width: ${params.width}px; margin: 2px 0 -3px 0; ` +
      'padding: 2px 2px ; border-radius: 10px; border-color: #c0c0c0;' +
      `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background-color: ${params.buttonColor};`;
    if (params.buttonTextColor) {
      css += `color: ${params.buttonTextColor}`;
    }

    return utils.buildHTML('a', params.linkText, {
      style: css,
      href: `!shaped-config --${params.path} ${params.command}`,
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

  /* eslint-disable object-property-newline */
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
                {
                  tag: 'tr',
                  innerHtml: [
                    {
                      tag: 'td',
                      innerHtml: options.colTitles[3],
                    },
                  ],
                  attrs: { style: 'line-height: 1;' },
                },
                {
                  tag: 'tr',
                  innerHtml: [
                    {
                      tag: 'td',
                      innerHtml: options.buttons[3],
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

  get logWrap() {
    return this.constructor.name;
  }

  toJSON() {
    return {};
  }
}

/////////////////////////////////////////////////
// Menus
/////////////////////////////////////////////////
class MainMenu extends ConfigMenu {
  getMenu() {
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
    const footer = utils.buildHTML('tr', utils.buildHTML('td', 'Shaped Companion Version %%GULP_INJECT_VERSION%%',
      { colspan: '2' }));

    return utils.buildHTML('table', tr + optionRows + footer, { style: 'width: 100%; font-size: 0.9em;' });
  }
}

class AdvantageTrackerMenu extends ConfigMenu {
  getMenu() {
    const ats = 'advTrackerSettings';
    const menu = 'atMenu';

    const optionRows =
      this.makeQuerySetting({
        path: `${ats}.output`, title: 'Output', menuCmd: menu,
        spec: this.specRoot.advTrackerSettings.output(),
      }) +
      this.makeToggleSetting({
        path: `${ats}.showMarkers`, title: 'Show Markers', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ats}.ignoreNpcs`, title: 'Ignore NPCs', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${ats}.advantageMarker`, title: 'Advantage Marker', menuCmd: menu,
        spec: this.specRoot.advTrackerSettings.advantageMarker(),
      }) +
      this.makeQuerySetting({
        path: `${ats}.disadvantageMarker`, title: 'Disadvantage Marker', menuCmd: menu,
        spec: this.specRoot.advTrackerSettings.disadvantageMarker(),
      });


    const th = utils.buildHTML('th', 'Advantage Tracker Options', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }
}

class TokensMenu extends ConfigMenu {
  getMenu() { // config) {
    // this.config = config;
    const ts = 'tokenSettings';
    const menu = 'tsMenu';

    const optionRows =
      this.makeToggleSetting({
        path: `${ts}.number`, title: 'Numbered Tokens', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ts}.showName`, title: 'Show Name Tag', menuCmd: menu,
      }) +
      this.makeInputSetting({
        path: `${ts}.monsterTokenName`, title: 'Token name override', prompt: 'Token name override (empty to unset)',
        menuCmd: menu,
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
}

class TokenBarsMenu extends ConfigMenu {
  getMenu() {
    const ts = 'tokenSettings';
    const menu = 'barMenu';

    let optionRows = '';

    for (let i = 1; i <= 3; i++) {
      const currAttr = utils.getObjectFromPath(this.config, `${ts}.bar${i}.attribute`);
      const currAttrEmptyHint = currAttr || '[not set]';
      const currMax = utils.getObjectFromPath(this.config, `${ts}.bar${i}.max`);
      const currLink = utils.getObjectFromPath(this.config, `${ts}.bar${i}.link`);

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
}

class TokenAurasMenu extends ConfigMenu {
  getMenu() {
    const ts = 'tokenSettings';
    const menu = 'auraMenu';

    let optionRows = '';

    for (let i = 1; i <= 2; i++) {
      const currRad = utils.getObjectFromPath(this.config, `${ts}.aura${i}.radius`);
      const currRadEmptyHint = currRad || '[not set]';
      const currColor = utils.getObjectFromPath(this.config, `${ts}.aura${i}.color`);
      const currSquare = utils.getObjectFromPath(this.config, `${ts}.aura${i}.square`);

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
}

class NewCharacterMenu extends ConfigMenu {
  getMenu() {
    const menu = 'ncMenu';
    const ncs = 'newCharSettings';
    let optionRows =
      this.makeToggleSetting({ path: `${ncs}.applyToAll`, title: 'Apply to all new chars?', menuCmd: menu });

    const spec = this.specRoot.newCharSettings;

    const currSheetOut =
      _.invert(spec.sheetOutput())[utils.getObjectFromPath(this.config, `${ncs}.sheetOutput`)];
    const currDSaveOut =
      _.invert(spec.deathSaveOutput())[utils.getObjectFromPath(this.config, `${ncs}.deathSaveOutput`)];
    const currHDOut =
      _.invert(spec.hitDiceOutput())[utils.getObjectFromPath(this.config, `${ncs}.hitDiceOutput`)];


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
    const hdBtn = this.makeOptionButton({
      path: `${ncs}.hitDiceOutput`, linkText: this.makeText(currHDOut), tooltip: 'click to change',
      buttonColor: '#02baf2', width: 60,
      command: `${this.getQueryCommand(`${ncs}.hitDiceOutput`, 'Death Save Output', spec.hitDiceOutput())}`
      + ` --${menu}`,
    });


    optionRows += this.makeThreeColOptionTable({
      tableTitle: 'Output',
      colTitles: ['Sheet', 'Death Save', 'Hit Dice'],
      buttons: [sheetBtn, dSaveBtn, hdBtn],
    });

    optionRows +=
      this.makeOptionRow({
        title: 'Initiative Settings', path: 'initMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showNameOnRollTemplate`, title: 'Show Name on Roll Template', menuCmd: menu,
        spec: spec.showNameOnRollTemplate(),
      }) +
      this.makeQuerySetting({
        path: `${ncs}.rollOptions`, title: 'Roll Options', menuCmd: menu, spec: spec.rollOptions(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoRevertAdvantage`, title: 'Revert Advantage', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetAC`, title: 'Show Target AC', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetName`, title: 'Show Target Name', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoAmmo`, title: 'Auto Use Ammo', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticHigherLevelQueries`, title: 'Automatic Higher Level Queries', menuCmd: menu,
        spec: spec.automaticHigherLevelQueries(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticallyExpendSpellResources`, title: 'Auto spell slots/points', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${ncs}.tab`, title: 'Default tab', menuCmd: menu, spec: spec.tab(),
      }) +
      this.makeOptionRow({
        title: 'Default Token Actions', path: 'taMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Display Settings', path: 'displayMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Houserule Settings', path: 'hrMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Hide Settings', path: 'hideMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Measurement Systems', path: 'msMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Text sizes', path: 'textMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'New Character Sheets', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }
}

class InitiativeMenu extends ConfigMenu {
  getMenu() {
    const ncs = 'newCharSettings';
    const menu = 'initMenu';
    const spec = this.specRoot.newCharSettings;

    const optionRows =
      this.makeQuerySetting({
        path: `${ncs}.initiativeOutput`, title: 'Initiative Output', menuCmd: menu, spec: spec.initiativeOutput(),
      }) +
      this.makeQuerySetting({
        path: `${ncs}.initiativeRoll`, title: 'Init Roll', menuCmd: menu, spec: spec.initiativeRoll(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.initiativeToTracker`, title: 'Init To Tracker', menuCmd: menu, spec: spec.initiativeToTracker(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.breakInitiativeTies`, title: 'Break Init Ties', menuCmd: menu,
      });


    const th = utils.buildHTML('th', 'Initiative Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}


class DisplayMenu extends ConfigMenu {
  getMenu() {
    const display = 'newCharSettings.display';
    const menu = 'displayMenu';
    const spec = this.specRoot.newCharSettings.display;

    const optionRows =
      this.makeToggleSetting({
        path: `${display}.showRests`, title: 'Show Rests', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showPassiveSkills`, title: 'Show Passive Skills', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showWeight`, title: 'Show Weight', menuCmd: menu, spec: spec.showWeight(),
      }) +
      this.makeToggleSetting({
        path: `${display}.showEmote`, title: 'Show Emote', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showFreetext`, title: 'Show Freetext', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showFreeform`, title: 'Show Freeform', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showDiceModifiers`, title: 'Show Dice Modifiers', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.showCritRange`, title: 'Show Crit Range', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${display}.extraOnACrit`, title: 'Extra on a Crit', menuCmd: menu,
      });


    const th = utils.buildHTML('th', 'Display Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}

class MeasurementSystemsMenu extends ConfigMenu {
  getMenu() {
    const ms = 'newCharSettings.measurementSystems';
    const menu = 'msMenu';
    const spec = this.specRoot.newCharSettings.measurementSystems;

    const optionRows =
      this.makeQuerySetting({
        path: `${ms}.distanceSystem`, title: 'Distance System', prompt: 'Distance System', menuCmd: menu,
        spec: spec.distanceSystem(),
      }) +
      this.makeQuerySetting({
        path: `${ms}.weightSystem`, title: 'Weight System', prompt: 'Weight System', menuCmd: menu,
        spec: spec.weightSystem(),
      }) +
      this.makeInputSetting({
        path: `${ms}.encumbranceMultiplier`, title: 'Encumbrance Multiplier', prompt: 'Encumbrance Multiplier',
        menuCmd: menu,
      });

    const th = utils.buildHTML('th', 'Measurement Systems', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}

class NewCharacterHouseruleMenu extends ConfigMenu {
  getMenu() {
    const hr = 'newCharSettings.houserules';
    const menu = 'hrMenu';

    const optionRows =
      this.makeToggleSetting({
        path: `${hr}.inspirationMultiple`, title: 'Multiple Inspiration', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${hr}.criticalDamageHouserule`, title: 'Critical Damage', prompt: 'Critical Damage', menuCmd: menu,
        spec: this.specRoot.newCharSettings.houserules.criticalDamageHouserule(),
      }) +
      this.makeToggleSetting({
        path: `${hr}.proficiencyDice`, title: 'Proficiency Dice', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.psionics`, title: 'Psionics', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.customClasses`, title: 'Custom Classes', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.expertiseAsAdvantage`, title: 'Expertise as advantage', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${hr}.baseDC`, title: 'Base DC', prompt: 'Base DC', menuCmd: menu,
        spec: this.specRoot.newCharSettings.houserules.baseDC(),
      }) +
      this.makeQuerySetting({
        path: `${hr}.mediumArmorMaxDex`, title: 'Medium Armor Max Dex', menuCmd: menu,
        spec: this.specRoot.newCharSettings.houserules.mediumArmorMaxDex(),
      }) +
      this.makeToggleSetting({
        path: `${hr}.honorToggle`, title: 'Honor', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.sanityToggle`, title: 'Sanity', menuCmd: menu,
      }) +
      this.makeOptionRow({
        title: 'Saving Throws', path: 'savesMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'Houserule Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}

class HideMenu extends ConfigMenu {
  getMenu() {
    const hide = 'newCharSettings.hide';
    const menu = 'hideMenu';

    const optionRows = [
      'hideAbilityChecks', 'hideSavingThrows', 'hideAttack', 'hideDamage', 'hideFreetext', 'hideRecharge',
      'hideSavingThrowDC', 'hideSavingThrowFailure', 'hideSavingThrowSuccess', 'hideContent',
    ].reduce((result, functionName) => {
      const title = utils.toTitleCase(
        functionName.replace(/([a-z])([A-Z]+)/g, (match, lower, upper) => `${lower} ${upper.toLowerCase()}`));
      result += this.makeToggleSetting({
        path: `${hide}.${functionName}`, title, menuCmd: menu,
        spec: this.specRoot.newCharSettings.hide[functionName](),
      });
      return result;
    }, '');

    const th = utils.buildHTML('th', 'Hide Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}

class SavesMenu extends ConfigMenu {
  getMenu() {
    const saves = 'newCharSettings.houserules.saves';
    const menu = 'savesMenu';

    const optionRows =
      this.makeToggleSetting({
        path: `${saves}.savingThrowsHalfProf`, title: 'Half Proficiency Saves', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${saves}.useCustomSaves`, title: 'Use Custom Saves', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${saves}.useAverageOfAbilities`, title: 'Use Average of Highest Abils', menuCmd: menu,
      }) +
      this.makeOptionRow({
        title: 'Fortitude', path: 'fortitudeMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Reflex', path: 'reflexMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      }) +
      this.makeOptionRow({
        title: 'Will', path: 'willMenu', command: '', linkText: 'view --&gt;', buttonColor: '#02baf2',
      });

    const th = utils.buildHTML('th', 'Houserule Settings', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToHouseRuleOptions();
  }
}

class CustomSaveTypeMenu extends ConfigMenu {

  constructor(config, specRoot, saveName) {
    super(config, specRoot);
    this.saveName = saveName;
  }

  getMenu() {
    const saves = `newCharSettings.houserules.saves.${this.saveName}`;
    const menu = `${this.saveName}Menu`;

    const optionRows = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      .reduce((result, attr) => {
        const propName = `${this.saveName}${attr}`;
        result += this.makeToggleSetting({
          path: `${saves}.${propName}`, title: attr, menuCmd: menu,
        });
        return result;
      }, '');

    const th = utils.buildHTML('th', `${this.saveName} Saves`, { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToSavesOptions();
  }
}


class NewCharacterTextSizeMenu extends ConfigMenu {
  getMenu() {
    const textSizes = 'newCharSettings.textSizes';
    const menu = 'textMenu';

    const optionRows =
      this.makeQuerySetting({
        path: `${textSizes}.spellsTextSize`, title: 'Spells', menuCmd: menu,
        spec: this.specRoot.newCharSettings.textSizes.spellsTextSize(),
      }) +
      this.makeQuerySetting({
        path: `${textSizes}.abilityChecksTextSize`, title: 'Ability Checks', menuCmd: menu,
        spec: this.specRoot.newCharSettings.textSizes.abilityChecksTextSize(),
      }) +
      this.makeQuerySetting({
        path: `${textSizes}.savingThrowsTextSize`, title: 'Saving Throws', menuCmd: menu,
        spec: this.specRoot.newCharSettings.textSizes.savingThrowsTextSize(),
      });

    const th = utils.buildHTML('th', 'Text sizes', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToNewCharOptions();
  }
}


class VariantsMenu extends ConfigMenu {
  getMenu() {
    const root = 'variants';
    const menu = 'varsMenu';
    const spec = this.specRoot.variants;

    const optionRows =
      this.makeQuerySetting({
        path: `${root}.rests.longRestHPRecovery`, title: 'Long Rest HP Recovery', menuCmd: menu,
        spec: spec.rests.longRestHPRecovery(),
      }) +
      this.makeQuerySetting({
        path: `${root}.rests.longRestHDRecovery`, title: 'Long Rest HD Recovery', menuCmd: menu,
        spec: spec.rests.longRestHDRecovery(),
      });

    const th = utils.buildHTML('th', 'Houserules & Variants', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });

    return table + this.backToMainMenuButton();
  }
}

class SheetEnhancementsMenu extends ConfigMenu {
  getMenu() {
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
        path: `${root}.autoTraits`, title: 'Process Uses automatically', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.turnRecharges`, title: 'Recharge uses on new turns', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.ammoRecovery`, title: 'Show ammo recovery buttons', menuCmd: menu,
      });

    const th = utils.buildHTML('th', 'Character Sheet Enhancements', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
    return table + this.backToMainMenuButton();
  }
}

class TokenActionsMenu extends ConfigMenu {
  getMenu() {
    const root = 'newCharSettings.tokenActions';
    const menu = 'taMenu';
    const spec = this.specRoot.newCharSettings.tokenActions;

    const optionRows =
      this.makeToggleSetting({
        path: `${root}.showRecharges`, title: 'Show recharges', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${root}.advantageTracker`, title: 'Advantage Tracker', menuCmd: menu, spec: spec.advantageTracker(),
      }) +
      this.makeToggleSetting({
        path: `${root}.initiative`, title: 'Initiative', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${root}.abilityChecks`, title: 'Ability Checks', menuCmd: menu, spec: spec.abilityChecks(),
      }) +
      this.makeQuerySetting({
        path: `${root}.savingThrows`, title: 'Saves', menuCmd: menu, spec: spec.savingThrows(),
      }) +
      this.makeToggleSetting({
        path: `${root}.rests`, title: 'Rests', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${root}.attacks`, title: 'Attacks', menuCmd: menu, spec: spec.attacks(),
      }) +
      this.makeToggleSetting({
        path: `${root}.spells`, title: 'Spells', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${root}.statblock`, title: 'Statblock', menuCmd: menu,
      }) +
      this.makeQuerySetting({
        path: `${root}.traits`, title: 'Traits', menuCmd: menu, spec: spec.traits(),
      }) +
      this.makeQuerySetting({
        path: `${root}.racialTraits`, title: 'Racial Traits', menuCmd: menu, spec: spec.racialTraits(),
      }) +
      this.makeQuerySetting({
        path: `${root}.classFeatures`, title: 'Class Features', menuCmd: menu, spec: spec.classFeatures(),
      }) +
      this.makeQuerySetting({
        path: `${root}.feats`, title: 'Feats', menuCmd: menu, spec: spec.feats(),
      }) +
      this.makeQuerySetting({
        path: `${root}.actions`, title: 'Actions', menuCmd: menu, spec: spec.actions(),
      }) +
      this.makeQuerySetting({
        path: `${root}.reactions`, title: 'Reactions', menuCmd: menu, spec: spec.reactions(),
      }) +
      this.makeQuerySetting({
        path: `${root}.legendaryActions`, title: 'Legendary Actions', menuCmd: menu, spec: spec.legendaryActions(),
      }) +
      this.makeQuerySetting({
        path: `${root}.lairActions`, title: 'Lair Actions', menuCmd: menu, spec: spec.lairActions(),
      }) +
      this.makeQuerySetting({
        path: `${root}.regionalEffects`, title: 'Regional Effects', menuCmd: menu, spec: spec.regionalEffects(),
      });

    const th = utils.buildHTML('th', 'Default Token Actions', { colspan: '2' });
    const tr = utils.buildHTML('tr', th, { style: 'margin-top: 5px;' });
    const table = utils.buildHTML('table', tr + optionRows, { style: 'width: 100%; font-size: 0.9em;' });
    return table + this.backToNewCharOptions();
  }
}

/* eslint-disable object-property-newline */
