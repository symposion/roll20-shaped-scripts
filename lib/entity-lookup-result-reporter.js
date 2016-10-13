'use strict';
const _ = require('underscore');

module.exports = class EntityLookupResultReporter {

  constructor(logger, reporter) {
    this.report = function report(result) {
      const summary = _.mapObject(result, (resultObject, type) => {
        if (type === 'errors') {
          return resultObject.length;
        }

        return _.mapObject(resultObject, operationResultArray => operationResultArray.length);
      });
      logger.info('Summary of adding $$$ entity group to the lookup: $$$', result.entityGroupName, summary);
      logger.debug('Details: $$$', result);
      if (!_.isEmpty(result.errors)) {
        const message = _.chain(result.errors)
            .groupBy('entity')
            .mapObject(entityErrors =>
                _.chain(entityErrors)
                    .pluck('errors')
                    .flatten()
                    .value()
            )
            .map((errors, entityName) => `<li>${entityName}:<ul><li>${errors.join('</li><li>')}</li></ul></li>`)
            .value();

        reporter.reportError(`JSON import error for ${result.entityGroupName} entity group:<ul>${message}</ul>`);
      }
    };
  }
};
