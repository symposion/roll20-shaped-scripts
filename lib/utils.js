'use strict';
const _ = require('underscore');

// noinspection JSUnusedGlobalSymbols
module.exports = {
  deepExtend(original, newValues) {
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
  },

  createObjectFromPath(pathString, value) {
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
  },

  getObjectFromPath(obj, path) {
    path = path.replace(/\[(\w+)]/g, '.$1'); // convert indexes to properties
    path = path.replace(/^\./, '');           // strip a leading dot
    path.split('.').every(segment => (obj = obj[segment]));
    return obj;
  },

  deepClone(object) {
    return JSON.parse(JSON.stringify(object));
  },

  executor() {
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
  },

  /**
   * Gets a string as 'Title Case' capitalizing the first letter of each word (i.e. 'the grapes of wrath' -> 'The
   * Grapes Of Wrath')
   * @param {string} s - The string to be converted
   * @return {string} the supplied string in title case
   */
  toTitleCase(s) {
    return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  },

  toOptionsString(options) {
    let res = options.join(' --');
    if (res.length > 0) {
      res = `--${res}`;
    }

    return res;
  },

  /**
   * Calculates a contrasting color using YIQ luma value
   * @param {string} hexcolor - the color to calculate a contrasting color for
   * @return {string} either 'white' or 'black' as determined to be the best contrasting text color for the input color
   */
  getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace('#', '');
    if (hexcolor.length === 3) {
      hexcolor += hexcolor;
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? 'black' : 'white';
  },

  /**
   * Builds an html element as a string using the specified options
   * @param {string} tag - the html tag type
   * @param innerHtml - can be a string to be used as the element inner html, or a {tag, innerHtml, attrs} object
   *                    in order to build a child html element string
   * @param attrs - a collection of attributes and their values to be applied to the html element
   * @return {string} the full html element as a string
   */
  buildHTML(tag, innerHtml, attrs) {
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
  },

  missingParam(name) {
    throw new Error(`Parameter ${name} is required`);
  },

  flattenObject(object) {
    return _.reduce(object, (explodedProps, propVal, propKey) => {
      if (_.isObject(propVal)) {
        return _.extend(explodedProps, this.flattenObject(propVal));
      }

      explodedProps[propKey] = propVal;
      return explodedProps;
    }, {});
  },
};
