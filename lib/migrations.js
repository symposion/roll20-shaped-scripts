'use strict';
const _ = require('underscore');
const utils = require('./utils');

const oneSixConfig = {
  logLevel: 'INFO',
  tokenSettings: {
    number: false,
    bar1: {
      attribute: 'HP',
      max: true,
      link: false,
      showPlayers: false,
    },
    bar2: {
      attribute: 'speed',
      max: false,
      link: true,
      showPlayers: false,
    },
    bar3: {
      attribute: '',
      max: false,
      link: false,
      showPlayers: false,
    },
    aura1: {
      radius: '',
      color: '#FFFF99',
      square: false,
    },
    aura2: {
      radius: '',
      color: '#59e594',
      square: false,
    },
    light: {
      radius: '',
      dimRadius: '',
      otherPlayers: false,
      hasSight: false,
      angle: 360,
      losAngle: 360,
      multiplier: 1,
    },
    showName: true,
    showNameToPlayers: false,
    showAura1ToPlayers: true,
    showAura2ToPlayers: true,
  },
  newCharSettings: {
    sheetOutput: '@{output_to_all}',
    deathSaveOutput: '@{output_to_all}',
    initiativeOutput: '@{output_to_all}',
    showNameOnRollTemplate: '@{show_character_name_yes}',
    rollOptions: '@{normal}',
    initiativeRoll: '@{normal_initiative}',
    initiativeToTracker: '@{initiative_to_tracker_yes}',
    breakInitiativeTies: '@{initiative_tie_breaker_var}',
    showTargetAC: '@{attacks_vs_target_ac_no}',
    showTargetName: '@{attacks_vs_target_name_no}',
    autoAmmo: '@{ammo_auto_use_var}',
    autoRevertAdvantage: false,
    houserules: {
      savingThrowsHalfProf: false,
      mediumArmorMaxDex: 2,
    },
  },
  advTrackerSettings: {
    showMarkers: false,
    ignoreNpcs: false,
    advantageMarker: 'green',
    disadvantageMarker: 'red',
    output: 'public',
  },
  sheetEnhancements: {
    rollHPOnDrop: true,
    autoHD: true,
    autoSpellSlots: true,
  },
  genderPronouns: [
    {
      matchPattern: '^f$|female|girl|woman|feminine',
      nominative: 'she',
      accusative: 'her',
      possessive: 'her',
      reflexive: 'herself',
    },
    {
      matchPattern: '^m$|male|boy|man|masculine',
      nominative: 'he',
      accusative: 'him',
      possessive: 'his',
      reflexive: 'himself',
    },
    {
      matchPattern: '^n$|neuter|none|construct|thing|object',
      nominative: 'it',
      accusative: 'it',
      possessive: 'its',
      reflexive: 'itself',
    },
  ],
  defaultGenderIndex: 2,

};


class Migrator {

  constructor(startVersion) {
    this._versions = [{ version: startVersion || 0.1, migrations: [] }];
  }

  skipToVersion(version) {
    this._versions.push({ version, migrations: [] });
    return this;
  }

  nextVersion() {
    const currentVersion = this._versions.slice(-1)[0].version;
    const nextVersion = (currentVersion * 10 + 1) / 10; // Avoid FP errors
    this._versions.push({ version: nextVersion, migrations: [] });
    return this;
  }

  addProperty(path, value) {
    const expandedProperty = utils.createObjectFromPath(path, value);
    return this.transformConfig((config) => utils.deepExtend(config, expandedProperty),
      `Adding property ${path} with value ${value}`);
  }

  overwriteProperty(path, value) {
    return this.transformConfig((config) => {
      const parts = path.split('.');
      const obj = parts.length > 1 ? utils.getObjectFromPath(config, parts.slice(0, -1).join('.')) : config;
      obj[parts.slice(-1)[0]] = value;
      return config;
    }, `Overwriting property ${path} with value ${JSON.stringify(value)}`);
  }

  copyProperty(oldPath, newPath) {
    return this.transformConfig(Migrator.propertyCopy.bind(null, oldPath, newPath),
      `Copying property from ${oldPath} to ${newPath}`);
  }


  static propertyCopy(oldPath, newPath, config) {
    const oldVal = utils.getObjectFromPath(config, oldPath);
    if (!_.isUndefined(oldVal)) {
      const expandedProperty = utils.createObjectFromPath(newPath, oldVal);
      utils.deepExtend(config, expandedProperty);
    }
    return config;
  }

  static propertyDelete(path, config) {
    const parts = path.split('.');
    const obj = parts.length > 1 ? utils.getObjectFromPath(config, parts.slice(0, -1).join('.')) : config;
    if (obj && !_.isUndefined(obj[parts.slice(-1)[0]])) {
      delete obj[parts.slice(-1)[0]];
    }
    return config;
  }

  deleteProperty(propertyPath) {
    return this.transformConfig(Migrator.propertyDelete.bind(null, propertyPath),
      `Deleting property ${propertyPath} from config`);
  }

  moveProperty(oldPath, newPath) {
    return this.transformConfig((config) => {
      config = Migrator.propertyCopy(oldPath, newPath, config);
      return Migrator.propertyDelete(oldPath, config);
    }, `Moving property from ${oldPath} to ${newPath}`);
  }

  transformConfig(transformer, message) {
    const lastVersion = this._versions.slice(-1)[0];
    lastVersion.migrations.push({ transformer, message });
    return this;
  }

  migrateConfig(state, logger) {
    logger.info('Checking config for upgrade, starting state: $$$', state);
    if (_.isEmpty(state)) {
      // working with a fresh install here
      state.version = 0;
    }
    if (!this._versions.find(version => version.version >= state.version)) {
      throw new Error(`Unrecognised schema state ${state.version} - cannot upgrade.`);
    }

    return this._versions
      .filter(version => version.version > state.version)
      .reduce((versionResult, version) => {
        logger.info('Upgrading schema to version $$$', version.version);

        versionResult = version.migrations.reduce((result, migration) => {
          logger.info(migration.message);
          return migration.transformer(result);
        }, versionResult);
        versionResult.version = version.version;
        logger.info('Post-upgrade state: $$$', versionResult);
        return versionResult;
      }, state);
  }
}

/*
 FOR REFERENCE: CURRENT SCHEMA
 {
 logLevel: 'INFO',
 tokenSettings: {
 number: false,
 bar1: {
 attribute: 'HP',
 max: true,
 link: false,
 showPlayers: false,
 },
 bar2: {
 attribute: 'speed',
 max: false,
 link: true,
 showPlayers: false,
 },
 bar3: {
 attribute: '',
 max: false,
 link: false,
 showPlayers: false,
 },
 aura1: {
 radius: '',
 color: '#FFFF99',
 square: false,
 },
 aura2: {
 radius: '',
 color: '#59e594',
 square: false,
 },
 light: {
 otherPlayers: false,
 hasSight: true,
 angle: 360,
 losAngle: 360,
 multiplier: 1,
 },
 showName: true,
 showNameToPlayers: false,
 showAura1ToPlayers: true,
 showAura2ToPlayers: true,
 },
 newCharSettings: {
 sheetOutput: '@{output_to_all}',
 deathSaveOutput: '@{output_to_all}',
 initiativeOutput: '@{output_to_all}',
 showNameOnRollTemplate: '@{show_character_name_yes}',
 rollOptions: '@{normal}',
 initiativeRoll: '@{normal_initiative}',
 initiativeToTracker: '@{initiative_to_tracker_yes}',
 breakInitiativeTies: '@{initiative_tie_breaker_var}',
 showTargetAC: '@{attacks_vs_target_ac_no}',
 showTargetName: '@{attacks_vs_target_name_no}',
 autoAmmo: '@{ammo_auto_use_var}',
 autoRevertAdvantage: false,
 houserules: {
 savingThrowsHalfProf: false,
 mediumArmorMaxDex: 2,
 },
 tab: 'core',
 },
 advTrackerSettings: {
 showMarkers: false,
 ignoreNpcs: false,
 advantageMarker: 'green',
 disadvantageMarker: 'red',
 output: 'public',
 },
 sheetEnhancements: {
 rollHPOnDrop: true,
 autoHD: true,
 autoSpellSlots: true,
 autoTraits: true,
 },
 genderPronouns: [
 {
 matchPattern: '^f$|female|girl|woman|feminine',
 nominative: 'she',
 accusative: 'her',
 possessive: 'her',
 reflexive: 'herself',
 },
 {
 matchPattern: '^m$|male|boy|man|masculine',
 nominative: 'he',
 accusative: 'him',
 possessive: 'his',
 reflexive: 'himself',
 },
 {
 matchPattern: '^n$|neuter|none|construct|thing|object',
 nominative: 'it',
 accusative: 'it',
 possessive: 'its',
 reflexive: 'itself',
 },
 ],
 defaultGenderIndex: 2,
 variants: {
 rests: {
 longNoHpFullHd: false,
 },
 },
 };
 */

const migrator = new Migrator()
  .addProperty('config', {})
  .skipToVersion(0.4)
  .overwriteProperty('config.genderPronouns', utils.deepClone(oneSixConfig).genderPronouns)
  .skipToVersion(1.2)
  .moveProperty('config.autoHD', 'config.sheetEnhancements.autoHD')
  .moveProperty('config.rollHPOnDrop', 'config.sheetEnhancements.rollHPOnDrop')
  .skipToVersion(1.4)
  .moveProperty('config.newCharSettings.savingThrowsHalfProf', 'config.newCharSettings.houserules.savingThrowsHalfProf')
  .moveProperty('config.newCharSettings.mediumArmorMaxDex', 'config.newCharSettings.houserules.mediumArmorMaxDex')
  .skipToVersion(1.6)
  .transformConfig(state => {
    _.defaults(state.config, oneSixConfig);
    _.defaults(state.config.tokenSettings, oneSixConfig.tokenSettings);
    _.defaults(state.config.newCharSettings, oneSixConfig.newCharSettings);
    _.defaults(state.config.advTrackerSettings, oneSixConfig.advTrackerSettings);
    _.defaults(state.config.sheetEnhancements, oneSixConfig.sheetEnhancements);
    return state;
  }, 'Applying defaults as at schema version 1.6')
  // 1.7
  // add base houserules and variants section
  // add sheetEnhancements.autoTraits
  .nextVersion()
  .addProperty('config.variants', {
    rests: {
      longNoHpFullHd: false,
    },
  })
  .addProperty('config.sheetEnhancements.autoTraits', true)
  // 1.8
  // Set tokens to have vision by default so that people see the auto-generated stuff based on senses
  .nextVersion()
  .overwriteProperty('config.tokenSettings.light.hasSight', true)
  // 1.9 Add default tab setting
  .nextVersion()
  .addProperty('config.newCharSettings.tab', 'core');

Migrator.migrateShapedConfig = migrator.migrateConfig.bind(migrator);

module.exports = Migrator;
