'use strict';
const _ = require('underscore');

const generateUUID = (function _generateUUID() {
  let a = 0;
  const b = [];
  return function generateUUIDInternal() {
    let c = (new Date()).getTime();
    const d = c === a;
    a = c;
    const e = new Array(8);
    let f;
    for (f = 7; f >= 0; f--) {
      e[f] = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(c % 64);
      c = Math.floor(c / 64);
    }
    c = e.join('');
    if (d) {
      for (f = 11; f >= 0 && b[f] === 63; f--) {
        b[f] = 0;
      }
      b[f]++;
    }
    else {
      for (f = 0; f < 12; f++) {
        b[f] = Math.floor(64 * Math.random());
      }
    }
    for (f = 0; f < 12; f++) {
      c += '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(b[f]);
    }
    return c;
  };
}());

module.exports = class Utils {
  static deepExtend(original, newValues) {
    if (!original) {
      original = _.isArray(newValues) ? [] : {};
    }
    _.each(newValues, (value, key) => {
      if (_.isArray(original[key])) {
        if (!_.isArray(value)) {
          original[key].push(value);
        }
        else {
          original[key] = _.map(value, (item, index) => {
            if (_.isObject(item)) {
              return this.deepExtend(original[key][index], item);
            }

            return item !== undefined ? item : original[key][index];
          });
        }
      }
      else if (_.isObject(original[key])) {
        original[key] = this.deepExtend(original[key], value);
      }
      else {
        original[key] = value;
      }
    });
    return original;
  }

  static createObjectFromPath(pathString, value) {
    const newObject = {};
    _.reduce(pathString.split(/\./), (object, pathPart, index, pathParts) => {
      const match = pathPart.match(/([^.[]*)(?:\[(\d+)])?/);
      const newVal = index === pathParts.length - 1 ? value : {};

      if (match[2]) {
        object[match[1]] = [];
        object[match[1]][match[2]] = newVal;
      }
      else {
        object[match[1]] = newVal;
      }
      return newVal;
    }, newObject);
    return newObject;
  }

  static getObjectFromPath(obj, path) {
    path = path.replace(/\[(\w+)]/g, '.$1'); // convert indexes to properties
    path = path.replace(/^\./, '');           // strip a leading dot
    path.split('.').every(segment => (obj = obj[segment]));
    return obj;
  }

  static deepClone(object) {
    return JSON.parse(JSON.stringify(object));
  }

  static executor() {
    switch (arguments.length) {
      case 0:
        return undefined;
      case 1:
        return arguments[0]();
      default:
      // Fall through
    }
    const args = Array.apply(null, arguments).slice(2);
    args.unshift(arguments[0]);
    return arguments[1].apply(null, args);
  }

  /**
   * Gets a string as 'Title Case' capitalizing the first letter of each word (i.e. 'the grapes of wrath' -> 'The
   * Grapes Of Wrath')
   * @param {string} s - The string to be converted
   * @return {string} the supplied string in title case
   */
  static toTitleCase(s) {
    return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  static toOptionsString(options) {
    return options.reduce((optionString, option) => {
      if (_.isObject(option)) {
        return `${optionString} --${option.name} ${option.value}`;
      }

      return `${optionString} --${option}`;
    }, '');
  }

  /**
   * Calculates a contrasting color using YIQ luma value
   * @param {string} hexcolor - the color to calculate a contrasting color for
   * @return {string} either 'white' or 'black' as determined to be the best contrasting text color for the input color
   */
  static getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace('#', '');
    if (hexcolor.length === 3) {
      hexcolor += hexcolor;
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? 'black' : 'white';
  }

  /**
   * Builds an html element as a string using the specified options
   * @param {string} tag - the html tag type
   * @param innerHtml - can be a string to be used as the element inner html, or a {tag, innerHtml, attrs} object
   *                    in order to build a child html element string
   * @param attrs - a collection of attributes and their values to be applied to the html element
   * @return {string} the full html element as a string
   */
  static buildHTML(tag, innerHtml, attrs) {
    if (typeof innerHtml === 'object') {
      innerHtml = _.map(innerHtml, html => html && this.buildHTML(html.tag, html.innerHtml, html.attrs)).join('');
    }

    let h = `<${tag}`;
    h += _.chain(attrs)
      .map((attrVal, attrName) => attrVal !== false && ` ${attrName}="${attrVal}"`)
      .compact()
      .value()
      .join('');

    if (innerHtml) {
      h += `>${innerHtml}</${tag}>`;
    }
    else {
      h += '/>';
    }

    return h;
  }

  static missingParam(name) {
    throw new Error(`Parameter ${name} is required`);
  }

  static flattenObject(object) {
    return _.reduce(object, (explodedProps, propVal, propKey) => {
      if (_.isObject(propVal)) {
        return _.extend(explodedProps, this.flattenObject(propVal));
      }

      explodedProps[propKey] = propVal;
      return explodedProps;
    }, {});
  }

  static extendWithArrayValues(into, from) {
    return _.reduce(from, (merged, value, key) => {
      if (_.isUndefined(value) || value === null || (_.isObject(value) && _.isEmpty(value))) {
        return merged;
      }

      if (_.isUndefined(merged[key])) {
        merged[key] = value;
      }
      else {
        if (!_.isArray(merged[key])) {
          merged[key] = [merged[key]];
        }
        merged[key] = merged[key].concat(value);
      }
      return merged;
    }, into);
  }

  static combine(array) {
    if (array.length < 2) {
      return array.map(i => `${i}`);
    }
    const restCombined = this.combine(_.rest(array));
    return [`${array[0]}`].concat(restCombined.map(item => `${array[0]};${item}`)).concat(restCombined);
  }

  static cartesianProductOf() {
    return _.reduce(arguments, (a, b) => _.flatten(_.map(a, x => _.map(b, y => x.concat([y]))), true), [[]]);
  }

  static generateRowID() {
    return generateUUID().replace(/_/g, 'Z');
  }

  static camelToSnakeCase(string) {
    return string.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  static versionCompare(v1, v2) {
    if (!v1 || !v2) {
      if (!v1) {
        return v2 ? -1 : 0;
      }
      return 1;
    }
    return _.zip(v1.split('.'), v2.split('.'))
      .reduce((result, versionPart) => result || (parseInt(versionPart[0], 10) - parseInt(versionPart[1], 10)), 0);
  }

  static getFixedSort(fixedOrder) {
    return (item1, item2) => {
      if (item1 === item2) {
        return 0;
      }
      return fixedOrder.find(entry => entry === item1 || entry === item2) === item1 ? -1 : 1;
    };
  }
};
