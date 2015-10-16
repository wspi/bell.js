/**
 * @overview  Util functions
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

//------------------------------------------
// Exports
//------------------------------------------

module.exports = {
  objectLength        : objectLength,
  updateNestedObjects : updateNestedObjects,
  loadObjectFromPath  : loadObjectFromPath,
  cleanWith           : cleanWith,
  join                : join,
  fileOnChanges       : fileOnChanges,
  patchBeansClient    : patchBeansClient,
  ReadOnlyArray       : ReadOnlyArray,
  setIntervalAndRunNow: setIntervalAndRunNow,
};

// extend all utils from standlib util
util._extend(module.exports, util);

//------------------------------------------
// Objects
//------------------------------------------

function objectLength(obj) {
  return Object.keys(obj).length;
}

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
function updateNestedObjects(obj, other) {
  var tmp, key, val;

  for (key in other) {
    if (other.hasOwnProperty(key)) {
      val = other[key];
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
}

/**
 * Load object from file path.
 *
 * @param {String} filePath
 * @return {Object}
 */
function loadObjectFromPath(path) {
  var content = fs.readFileSync(path);
  return eval('var _; _ = ' + content);
}

/**
 * Pop key and val from an object only if the key and value are
 * all the same. (In place)
 *
 * @param {Object} obj
 * @param {Object} other
 * @return {Object} // obj
 */
function cleanWith(obj, other) {
  for (var key in obj) {
    if (key in other && obj.hasOwnProperty(key) && obj[key] === other[key])
      delete obj[key];
  }
  return obj;
}

//------------------------------------------
// Strings
//------------------------------------------
/**
 * Join pathes and normalize the result, e.g.
 *
 *    join('a', 'b', 'c')
 *    // => 'a/b/c'
 */
function join() {
  var result = path.join.apply(this, arguments);
  return path.normalize(result);
}


//------------------------------------------
// Files
//------------------------------------------

/**
 * Nodejs `fs.watch` currently not working well on osx,
 * here offers a compatiable way to do something if any
 * changes are made to the file.
 *
 * @param {String} file
 * @param {Function} callback // function()
 */
function fileOnChanges(file, callback) {
  if (process.platform == 'darwin') {
    return fs.watchFile(file, {interval: 2000}, function(curr, prev) {
      if (curr.mtime != prev.mtime)
        return callback();
    });
  } else {
    return fs.watch(file, function(event, filename) {
      if (event == 'change')
        return callback();
    });
  }
}

//------------------------------------------
// Hacks
//------------------------------------------

/**
 * Thunkify fivebeans `reserve` method.
 *
 * @param {Object} c  // fivebeans client
 */
function patchBeansClient(c) {
  var reserve = function(cb) {
    c.reserve(cb);
  };

  c._reserve = function() {
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
}

//------------------------------------------
// Math
//------------------------------------------

/**
 * ReadOnly array
 */
function ReadOnlyArray(array) {
  this.array = array;
  this.cache = {};
  this.length = array.length;
  return this;
}

ReadOnlyArray.prototype.mean = function() {
  var i, sum, mean;

  if (typeof this.cache.mean !== 'undefined')
    return this.cache.mean;

  for (i = 0, sum = 0; i < this.length; i++)
    sum += this.array[i];

  mean = sum / this.length;
  this.cache.mean = mean;
  return mean;
};

ReadOnlyArray.prototype.std = function() {
  var i, mean, sum, dis, std;

  if (typeof this.cache.std !== 'undefined')
    return this.cache.std;

  mean = this.mean();

  for (i = 0, sum = 0; i < this.length; i++) {
    dis = this.array[i] - mean;
    sum += dis * dis;
  }

  std = Math.sqrt(sum / this.length);
  this.cache.std = std;
  return std;
};

//------------------------------------------
// Timers
//------------------------------------------

function setIntervalAndRunNow(fn, ms) {
  fn();
  return setInterval(fn, ms);
}
