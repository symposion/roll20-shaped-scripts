'use strict';
const _ = require('underscore');
const Utils = require('./../utils');
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
    Utils.deepExtend(this.myState.config, _.omit(options, 'menu'));

    const msg = this.reporter.getMessageBuilder('Configuration', false, options.playerId);
    if (options.menu) {
      options.menu[0].writeMenu(msg);
    }
    else if (_.isEmpty(_.omit(options, 'menu', 'playerId'))) {
      const menu = new MainMenu(this.myState.config, ShapedConfig.configOptionsSpec);
      menu.writeMenu(msg);
    }
    msg.display();
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
    let currentVal = Utils.getObjectFromPath(this.config, params.path);
    if (params.spec) {
      currentVal = _.invert(params.spec)[currentVal] === 'true';
    }

    params.command = `${!currentVal}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = this.makeBoolText(currentVal);
    params.tooltip = 'click to toggle';
    params.buttonClass = currentVal ? '' : 'notselected';

    return this.makeOptionRow(params);
  }

  makeQuerySetting(params) {
    const currentVal = _.invert(params.spec)[Utils.getObjectFromPath(this.config, params.path)];
    const cmd = this.getQueryCommand(params.path, params.title, params.spec);

    params.command = `${cmd}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = this.makeText(currentVal);
    params.tooltip = 'click to change';

    return this.makeOptionRow(params);
  }

  makeInputSetting(params) {
    const currentVal = Utils.getObjectFromPath(this.config, params.path);

    params.command = `?{${params.prompt}|${currentVal}}${!_.isUndefined(params.menuCmd) ? ` --${params.menuCmd}` : ''}`;
    params.linkText = currentVal || '[not set]';
    params.tooltip = 'click to edit';
    params.buttonClass = params.linkText === '[not set]' ? 'notselected' : '';

    return this.makeOptionRow(params);
  }


  backToMainMenuButton() {
    return this.makeBackButton('Main Menu');
  }

  makeBackButton(text, targetMenu) {
    const menuOption = targetMenu ? `--${targetMenu}` : '';
    return Utils.buildHTML('a', `&lt;-- ${text}`, {
      href: `!shaped-config ${menuOption}`,
    });
  }

  backToTokenOptions() {
    return this.makeBackButton('Token Options', 'tsMenu');
  }

  backToNewCharOptions() {
    return this.makeBackButton('New Character Options', 'ncMenu');
  }

  backToHouseRuleOptions() {
    return this.makeBackButton('Houserule Options', 'hrMenu');
  }

  backToSavesOptions() {
    return this.makeBackButton('Saves Options', 'savesMenu');
  }

  getQueryCommand(path, title, optionsSpec) {
    let currentVal = _.invert(optionsSpec)[Utils.getObjectFromPath(this.config, path)];
    const optionList = _.keys(optionsSpec);

    // Fix up if we've somehow ended up with an illegal value
    if (_.isUndefined(currentVal)) {
      currentVal = _.first(optionList);
      Utils.deepExtend(this.config, Utils.createObjectFromPath(path, optionsSpec[currentVal]));
    }

    // move the current option to the front of the list
    optionList.splice(optionList.indexOf(currentVal), 1);
    optionList.unshift(currentVal);

    return `?{${title}|${optionList.join('|')}}`;
  }

  makeOptionRow(params) {
    const col1 = Utils.buildHTML('td', params.title);
    const col2 = Utils.buildHTML('td', this.makeOptionButton(params), { style: 'text-align:right;' });

    return Utils.buildHTML('tr', col1 + col2);
  }

  makeOptionButton(params) {
    if (_.isUndefined(params.width)) {
      params.width = 80;
    }

    let css = `text-align: center; width: ${params.width}px; margin: 2px 0 -3px 0; ` +
      'padding: 2px 2px ; border-radius: 10px; border-color: #c0c0c0;' +
      'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    if (params.buttonTextColor) {
      css += `color: ${params.buttonTextColor};`;
    }
    if (params.buttonColor) {
      css += `background-color: ${params.buttonColor};`;
    }

    return Utils.buildHTML('a', params.linkText, {
      style: css,
      class: params.buttonClass,
      href: `!shaped-config --${params.path} ${params.command}`,
    });
  }

  makeText(value) {
    return Utils.buildHTML('span', value);
  }

  makeBoolText(value) {
    return value === true ?
      Utils.buildHTML('span', 'on') :
      Utils.buildHTML('span', 'off');
  }

  /* eslint-disable object-property-newline */
  makeThreeColOptionTable(options) {
    return Utils
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
              attrs: { style: 'text-align: center;' },
            },
          ], attrs: { colspan: '2' },
        },
      ]);
  }

  writeMenu(msg) {
    const parts = this.getMenuParts();
    const content = Utils.buildHTML('table', parts.optionRows, {
      class: 'shaped-config',
    });
    msg.addField('subheader', parts.title);
    msg.addField('content', content);
    msg.addField('text', parts.footerText);
  }

  getMenuParts() {
    return null;
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
  getMenuParts() {
    const optionRows =
      this.makeOptionRow({
        title: 'Advantage Tracker', path: 'atMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Token Defaults', path: 'tsMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'New Characters', path: 'ncMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Char. Sheet Enhancements', path: 'seMenu', command: '', linkText: 'view --&gt;',
      });

    return {
      title: 'Main Menu',
      footerText: 'Shaped Companion Version %%GULP_INJECT_VERSION%%',
      optionRows,
    };
  }
}

class AdvantageTrackerMenu extends ConfigMenu {
  getMenuParts() {
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

    return {
      title: 'Advantage Tracker Options',
      footerText: this.backToMainMenuButton(),
      optionRows,
    };
  }
}

class TokensMenu extends ConfigMenu {
  getMenuParts() { // config) {
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
        title: 'Token Bar Options', path: 'barMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Token Aura Options', path: 'auraMenu', command: '', linkText: 'view --&gt;',
      });

    return {
      title: 'Token Options',
      footerText: this.backToMainMenuButton(),
      optionRows,
    };
  }
}

class TokenBarsMenu extends ConfigMenu {
  getMenuParts() {
    const ts = 'tokenSettings';
    const menu = 'barMenu';

    let optionRows = '';

    for (let i = 1; i <= 3; i++) {
      const attrPath = `${ts}.bar${i}.attribute`;
      const currAttr = Utils.getObjectFromPath(this.config, attrPath);
      const currAttrEmptyHint = currAttr || '[not set]';
      const maxPath = `${ts}.bar${i}.max`;
      const currMax = Utils.getObjectFromPath(this.config, maxPath);
      const linkPath = `${ts}.bar${i}.link`;
      const linkSpec = this.specRoot.tokenSettings[`bar${i}`].link();
      const currLink = _.invert(linkSpec)[Utils.getObjectFromPath(this.config, linkPath)];

      const attBtn = this.makeOptionButton({
        path: attrPath, linkText: this.makeText(currAttrEmptyHint), tooltip: 'click to edit',
        buttonClass: currAttrEmptyHint === '[not set]' ? 'notselected' : '',
        command: `?{Bar ${i} Attribute (empty to unset)|${currAttr}} --${menu}`,
      });
      const maxBtn = this.makeOptionButton({
        path: maxPath, linkText: this.makeBoolText(currMax), tooltip: 'click to toggle',
        buttonClass: currMax ? '' : 'notselected',
        command: `${!currMax} --${menu}`,
      });


      const linkBtn = this.makeOptionButton({
        path: linkPath,
        buttonClass: currLink ? '' : 'notselected',
        command: `${this.getQueryCommand(linkPath, 'Link', linkSpec)} --${menu}`,
        linkText: this.makeText(currLink),
        tooltip: 'click to change',
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

    return {
      title: 'Token Bar Options',
      footerText: this.backToTokenOptions(),
      optionRows,
    };
  }
}

class TokenAurasMenu extends ConfigMenu {
  getMenuParts() {
    const ts = 'tokenSettings';
    const menu = 'auraMenu';

    let optionRows = '';

    for (let i = 1; i <= 2; i++) {
      const currRad = Utils.getObjectFromPath(this.config, `${ts}.aura${i}.radius`);
      const currRadEmptyHint = currRad || '[not set]';
      const currColor = Utils.getObjectFromPath(this.config, `${ts}.aura${i}.color`);
      const currSquare = Utils.getObjectFromPath(this.config, `${ts}.aura${i}.square`);

      const radBtn = this.makeOptionButton({
        path: `${ts}.aura${i}.radius`, linkText: this.makeText(currRadEmptyHint), tooltip: 'click to edit',
        buttonClass: currRadEmptyHint === '[not set]' ? 'notselected' : '', width: 60,
        command: `?{Aura ${i} Radius (empty to unset)|${currRad}} --${menu}`,
      });
      const colorBtn = this.makeOptionButton({
        path: `tokenSettings.aura${i}.color`, linkText: this.makeText(currColor), tooltip: 'click to edit',
        buttonColor: currColor, buttonTextColor: Utils.getContrastYIQ(currColor), width: 60,
        command: `?{Aura ${i} Color (hex colors)|${currColor}} --${menu}`,
      });
      const squareBtn = this.makeOptionButton({
        path: `tokenSettings.aura${i}.square`, linkText: this.makeBoolText(currSquare), tooltip: 'click to toggle',
        buttonClass: currSquare ? '' : 'notselected', width: 60,
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

    return {
      title: 'Token Aura Options',
      footerText: this.backToTokenOptions(),
      optionRows,
    };
  }
}

class NewCharacterMenu extends ConfigMenu {
  getMenuParts() {
    const menu = 'ncMenu';
    const ncs = 'newCharSettings';
    let optionRows =
      this.makeToggleSetting({ path: `${ncs}.applyToAll`, title: 'Apply to all new chars?', menuCmd: menu });

    const spec = this.specRoot.newCharSettings;

    const currSheetOut =
      _.invert(spec.sheetOutput())[Utils.getObjectFromPath(this.config, `${ncs}.sheetOutput`)];
    const currDSaveOut =
      _.invert(spec.deathSaveOutput())[Utils.getObjectFromPath(this.config, `${ncs}.deathSaveOutput`)];
    const currHDOut =
      _.invert(spec.hitDiceOutput())[Utils.getObjectFromPath(this.config, `${ncs}.hitDiceOutput`)];


    const sheetBtn = this.makeOptionButton({
      path: `${ncs}.sheetOutput`, linkText: this.makeText(currSheetOut), tooltip: 'click to change',
      width: 60,
      command: `${this.getQueryCommand(`${ncs}.sheetOutput`, 'Sheet Output', spec.sheetOutput())}`
      + ` --${menu}`,
    });
    const dSaveBtn = this.makeOptionButton({
      path: `${ncs}.deathSaveOutput`, linkText: this.makeText(currDSaveOut), tooltip: 'click to change',
      width: 60,
      command: `${this.getQueryCommand(`${ncs}.deathSaveOutput`, 'Death Save Output', spec.deathSaveOutput())}`
      + ` --${menu}`,
    });
    const hdBtn = this.makeOptionButton({
      path: `${ncs}.hitDiceOutput`, linkText: this.makeText(currHDOut), tooltip: 'click to change',
      width: 60,
      command: `${this.getQueryCommand(`${ncs}.hitDiceOutput`, 'Death Save Output', spec.hitDiceOutput())}`
      + ` --${menu}`,
    });


    optionRows += this.makeThreeColOptionTable({
      tableTitle: 'Output',
      colTitles: ['Sheet', 'Death Save', 'Hit Dice'],
      buttons: [sheetBtn, dSaveBtn, hdBtn],
    });

    optionRows +=
      this.makeQuerySetting({
        path: `${ncs}.rollOptions`, title: 'Roll Options', menuCmd: menu, spec: spec.rollOptions(),
      }) +
      this.makeOptionRow({
        title: 'Initiative Settings', path: 'initMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showNameOnRollTemplate`, title: 'Show Name on Roll Template', menuCmd: menu,
        spec: spec.showNameOnRollTemplate(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetAC`, title: 'Show Target AC', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.showTargetName`, title: 'Show Target Name', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticallyRollDamageForAttacks`, title: 'Auto Roll Dmg Attacks', menuCmd: menu,
        spec: spec.automaticallyRollDamageForAttacks(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticallyRollDamageForSavingThrows`, title: 'Auto Roll Dmg Saves', menuCmd: menu,
        spec: spec.automaticallyRollDamageForSavingThrows(),
      }) +
      this.makeOptionRow({
        title: 'Display Settings', path: 'displayMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticHigherLevelQueries`, title: 'Automatic Higher Level Queries', menuCmd: menu,
        spec: spec.automaticHigherLevelQueries(),
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoAmmo`, title: 'Auto Use Ammo', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.autoRevertAdvantage`, title: 'Revert Advantage', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${ncs}.automaticallyExpendSpellResources`, title: 'Auto spell slots/points', menuCmd: menu,
      }) +
      this.makeOptionRow({
        title: 'Houserule Settings', path: 'hrMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Measurement Systems', path: 'msMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Hide Settings', path: 'hideMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Default Token Actions', path: 'taMenu', command: '', linkText: 'view --&gt;',
      });
    // +
    // this.makeOptionRow({
    //   title: 'Text sizes', path: 'textMenu', command: '', linkText: 'view --&gt;',
    // });

    return {
      title: 'New Character Settings',
      footerText: this.backToMainMenuButton(),
      optionRows,
    };
  }
}

class InitiativeMenu extends ConfigMenu {
  getMenuParts() {
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

    return {
      title: 'Initiative Settings',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}


class DisplayMenu extends ConfigMenu {
  getMenuParts() {
    const display = 'newCharSettings.display';
    const menu = 'displayMenu';
    const spec = this.specRoot.newCharSettings.display;

    const optionRows =
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

    return {
      title: 'Display Settings',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

class MeasurementSystemsMenu extends ConfigMenu {
  getMenuParts() {
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
      });

    return {
      title: 'Measurement Systems',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

class NewCharacterHouseruleMenu extends ConfigMenu {
  getMenuParts() {
    const hr = 'newCharSettings.houserules';
    const menu = 'hrMenu';

    const optionRows =
      this.makeQuerySetting({
        path: `${hr}.hitPointsRecoveredOnALongRest`, title: 'HP Recovered Long Rest', prompt: 'HP Recovered Long Rest',
        menuCmd: menu, spec: this.specRoot.newCharSettings.houserules.hitPointsRecoveredOnALongRest(),
      }) +
      this.makeQuerySetting({
        path: `${hr}.hitDiceRecoveredOnALongRest`, title: 'HD Recovered Long Rest', prompt: 'HD Recovered Long Rest',
        menuCmd: menu, spec: this.specRoot.newCharSettings.houserules.hitDiceRecoveredOnALongRest(),
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
        path: `${hr}.mediumArmorMaxDex`, title: 'Medium Armor Max Dex', menuCmd: menu,
        spec: this.specRoot.newCharSettings.houserules.mediumArmorMaxDex(),
      }) +
      this.makeQuerySetting({
        path: `${hr}.baseDC`, title: 'Base DC', prompt: 'Base DC', menuCmd: menu,
        spec: this.specRoot.newCharSettings.houserules.baseDC(),
      }) +
      this.makeToggleSetting({
        path: `${hr}.honorToggle`, title: 'Honor', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.sanityToggle`, title: 'Sanity', menuCmd: menu,
      }) +
      this.makeToggleSetting({
        path: `${hr}.inspirationMultiple`, title: 'Multiple Inspiration', menuCmd: menu,
      }) +
      this.makeOptionRow({
        title: 'Saving Throws', path: 'savesMenu', command: '', linkText: 'view --&gt;',
      });

    return {
      title: 'Houserule Settings',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

class HideMenu extends ConfigMenu {
  getMenuParts() {
    const hide = 'newCharSettings.hide';
    const menu = 'hideMenu';

    const optionRows = [
      'hideAbilityChecks', 'hideSavingThrows', 'hideAttack', 'hideDamage', 'hideFreetext', 'hideRecharge',
      'hideTargetAC', 'hideSavingThrowDC', 'hideSavingThrowFailure', 'hideContent',
    ].reduce((result, functionName) => {
      const title = Utils.toTitleCase(
        functionName.replace(/([a-z])([A-Z]+)/g, (match, lower, upper) => `${lower} ${upper.toLowerCase()}`));
      result += this.makeToggleSetting({
        path: `${hide}.${functionName}`, title, menuCmd: menu,
        spec: this.specRoot.newCharSettings.hide[functionName](),
      });
      return result;
    }, '');

    return {
      title: 'Hide Settings',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

class SavesMenu extends ConfigMenu {
  getMenuParts() {
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
        title: 'Fortitude', path: 'fortitudeMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Reflex', path: 'reflexMenu', command: '', linkText: 'view --&gt;',
      }) +
      this.makeOptionRow({
        title: 'Will', path: 'willMenu', command: '', linkText: 'view --&gt;',
      });

    return {
      title: 'Custom Saves Settings',
      footerText: this.backToHouseRuleOptions(),
      optionRows,
    };
  }
}

class CustomSaveTypeMenu extends ConfigMenu {

  constructor(config, specRoot, saveName) {
    super(config, specRoot);
    this.saveName = saveName;
  }

  getMenuParts() {
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

    return {
      title: `${this.saveName} Saves`,
      footerText: this.backToSavesOptions(),
      optionRows,
    };
  }
}


class NewCharacterTextSizeMenu extends ConfigMenu {
  getMenuParts() {
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

    return {
      title: 'Text sizes',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

class SheetEnhancementsMenu extends ConfigMenu {
  getMenuParts() {
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


    return {
      title: 'Character Sheet Enhancements',
      footerText: this.backToMainMenuButton(),
      optionRows,
    };
  }
}

class TokenActionsMenu extends ConfigMenu {
  getMenuParts() {
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
        path: `${root}.offense`, title: 'Offense', menuCmd: menu, spec: spec.offense(),
      }) +
      this.makeQuerySetting({
        path: `${root}.utility`, title: 'Utility', menuCmd: menu, spec: spec.utility(),
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

    return {
      title: 'Default Token Actions',
      footerText: this.backToNewCharOptions(),
      optionRows,
    };
  }
}

/* eslint-disable object-property-newline */
