/**
 * @fileoverview Utils.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Pop key and val from an object only if the key and value
 * are all the same.
 *
 *  @param {Object} obj
 *  @param {Object} other
 *  @return {Object} // obj
 */
exports.cleanWith = function(obj, other) {
  for (var key in obj) {
    if (key in other && obj.hasOwnProperty(key) && obj[key] === other[key])
      delete obj[key];
  }
  return obj;
};

/**
 * Join pathes and normalize the result
 *
 * example:
 *
 *  join('a', 'b', 'c')
 *  // => 'a/b/c'
 */
function join() {
  var result = path.join.apply(this, arguments);
  return path.normalize(result);
}

exports.path = {
  lib: __dirname,
  bin: join(__dirname, '..', 'bin'),
  config: join(__dirname, '..', 'config'),
  static: join(__dirname, '..', 'static'),
  view: join(__dirname, '..', 'view')
};
exports.path.configs = join(exports.path.config, 'configs.toml');
exports.path.join = join;

/**
 * Update nested objects in place.
 *
 * example:
 *
 *   updateNestedObjects({x: 1, y: {z: 2}}, {x: 2, y: {z: 3, p: 4}, q: 5})
 *   // => {x: 2, y: {z: 3, p: 4}, q: 5}
 *
 *  @param {Object} obj
 *  @param {Object} other
 *  @return {Object} // obj
 */
var updateNestedObjects = exports.updateNestedObjects =
  function (obj, other) {
  var tmp;

  for (var key in other) {
    if (other.hasOwnProperty(key)) {
      var val = other[key];
      if (val !== null && typeof val === 'object') {
        // val is an object
        if (obj[key] === undefined) {
          tmp = obj[key] = {};
        } else {
          tmp = obj[key];
        }
        updateNestedObjects(tmp, val);
      } else {
        obj[key] = val;
      }
    }
  }
  return obj;
};


/**
 * Copy file from path `src` to path `dest`
 *
 *  @param {String} src
 *  @param {String} dest
 */
exports.copy = function(src, dest) {
  return fs.createReadStream(src).pipe(fs.createWriteStream(dest));
};

/**
 * Patch fivebeans reserve to be thunkify
 */
var patchBeansClient = function(beans) {
  // thunkify fivebeans reserve method
  var reserve = function(cb) {
    beans.reserve(cb);
  };

  beans._reserve = function() {
    return function(cb) {
      var _cb = function(e, jid, buf) {
        cb(e, {
          id: jid,
          body: buf.toString()
        });
      };
      reserve.apply(this, [_cb]);
    };
  };
};

exports.patches = {
  patchBeansClient: patchBeansClient
};

/**
 * Math utils
 *
 * example:
 *
 *   var arr = _Array([1, 2, 3])
 *   arr.mean()
 *   // => 2
 *   arr.std()
 *   // => 0.816496580927726
 *
 *  @param {Array} array
 */
function UtilArray(array){
  this.array = array;
  this.cache = {};
  this.length = array.length;
}

UtilArray.prototype.mean = function() {
  var i, sum;

  if (this.cache.mean !== undefined) {
    return this.cache.mean;
  }

  for (i = 0, sum = 0; i < this.length; i++) {
    sum += this.array[i];
  }
  return (this.cache.mean = sum / this.length);
};

UtilArray.prototype.std = function() {
  var mean, i, sum, dis;

  if (this.cache.std !== undefined) {
    return this.cache.std;
  }

  mean = this.mean();

  for (i = 0, sum = 0; i < this.length; i++) {
    dis = this.array[i] - mean;
    sum += dis * dis;
  }
  return (this.cache.std = Math.sqrt(sum / this.length));
};

exports.array = function(array) {
  return new UtilArray(array);
};
