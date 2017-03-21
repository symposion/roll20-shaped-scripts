'use strict';
const ShapedModule = require('../shaped-module');
const _ = require('underscore');
const Utils = require('../utils');

module.exports = class EntityLister extends ShapedModule {
  constructor(deps) {
    super(deps);
    this.entities = {};
    this.entityLookup = deps.entityLookup;
  }

  addCommands(commandProc) {
    _.each(this.entities, (entity) => {
      const cmdNames = [`list-${entity.name}`, entity.name];
      const cmd = commandProc
        .addCommand(cmdNames, this.listEntity.bind(this, entity.name), entity.gmOnly)
        .options(entity.criteriaProvider.criteriaOptionsValidator);

      entity.entityManager.addOptionsForListCommand(cmd);
    });
  }

  addEntity(name, singularName, criteriaProvider, entityManager, gmOnly) {
    if (!this.entityLookup.hasEntities(name)) {
      throw new Error(`Invalid entity type ${name}`);
    }

    this.entities[name] = {
      name,
      singularName,
      criteriaProvider,
      entityManager,
      gmOnly,
    };
  }

  listEntity(entityName, options) {
    const entityRecord = this.entities[entityName];
    if (!entityRecord.entityManager.validateListCommandOptions(options)) {
      return;
    }
    const criteria = entityRecord.criteriaProvider.criteria;
    const criteriaNames = _.pluck(criteria, 'name');
    const suppliedCriteria = _.pick(options, criteriaNames);
    this.logger.debug('Looking for entities of type $$$ matching criteria $$$', entityName, suppliedCriteria);
    const entities = this.entityLookup.searchEntities(entityName, suppliedCriteria);
    this.logger.debug('Found: $$$', entities);
    const relistOptions = `--relist ${escape(JSON.stringify(suppliedCriteria))}`;

    const entitySpecificOptions = entityRecord.entityManager.getListCommandOptions(options);

    const buttoniser = entityRecord.entityManager.getButtoniser(options, relistOptions);

    const possibleCriteria = entityRecord.criteriaProvider.getCriteriaToDisplay(suppliedCriteria);

    const header = this.buildHeader(entityName, possibleCriteria, suppliedCriteria, entitySpecificOptions,
      entityRecord);
    const list = this.buildList(entities, buttoniser);
    this.reporter.sendPlayer(`&{template:5e-shaped}{{title=${Utils.toTitleCase(entityName)}}}` +
      `{{content=<div class="entity-list">${header}<hr>${list}</div>}}`, options.playerId);
  }


  buildHeader(entityName, criteria, suppliedCriteria, entitySpecificOptions, entityRecord) {
    const criteriaList = criteria.map((criterion) => {
      if (criterion.buildListEntry) {
        return criterion.buildListEntry(suppliedCriteria, entitySpecificOptions);
      }

      const valueList = criterion.values.map((value) => {
        const selected = _.contains(suppliedCriteria[criterion.name], value);
        const className = selected ? 'selected' : '';
        const newOpts = buildNewOptionsString(suppliedCriteria, criterion.name, value);
        return `<a href="!shaped-list-${entityName} ${newOpts} ${entitySpecificOptions}" class="${className}">` +
          `${value}</a>`;
      }).join(', ');
      const name = Utils.toTitleCase(criterion.name);
      return `<div class="criterion"><span class="criterion-name">${name}. </span>${valueList}</div>`;
    }).join('');

    return `${this.getEntityPicker(entityRecord)}${criteriaList}`;
  }

  buildList(entities, buttoniser) {
    return '<div class="entity-scroller">' +
      `${entities.map(entity => `<span>${buttoniser(entity)}</span>`).join('')}</div>`;
  }

  getEntityPicker(entityRecord) {
    const list = this.entityLookup.getKeys(entityRecord.name, true);

    if (!_.isEmpty(list)) {
      // title case the  names for better display
      list.forEach((part, index) => (list[index] = Utils.toTitleCase(part)));

      // create a clickable button with a roll query to select an entity from the loaded json
      return `<a href="!shaped-import-${entityRecord.singularName} ` +
        `--?{Pick a ${entityRecord.singularName}|${list.join(
          '|')}}">Select a ${entityRecord.singularName} by query</a>`;
    }
    return `Could not find any ${entityRecord.name}.<br/>Please ensure you have a properly formatted ` +
      `${entityRecord.name} json file.`;
  }
};

function buildNewOptionsString(suppliedCriteria, criterionToModify, valueToToggle) {
  const newCriteria = Utils.deepClone(suppliedCriteria);
  if (!newCriteria[criterionToModify]) {
    newCriteria[criterionToModify] = [valueToToggle];
  }
  else {
    const valueList = newCriteria[criterionToModify];
    newCriteria[criterionToModify] = _.contains(valueList, valueToToggle) ? _.without(valueList, valueToToggle) :
      valueList.concat(valueToToggle);
  }
  return _.reduce(newCriteria, (optionString, valueList, criterion) =>
    (_.isEmpty(valueList) ? optionString : `${optionString} --${criterion} ${valueList.join(',')}`), '');
}
