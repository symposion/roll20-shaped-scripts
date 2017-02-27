'use strict';
const _ = require('underscore');
const utils = require('./utils');


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
    return this.transformConfig(config => utils.deepExtend(config, expandedProperty),
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

  needsUpdate(state) {
    return !state.version || state.version < _.last(this._versions).version;
  }

  isValid(state) {
    return _.isEmpty(state) || state.version <= _.last(this._versions).version;
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

module.exports = Migrator;
