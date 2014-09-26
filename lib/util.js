var format = require('util').format;
var fs = require('fs');
var path = require('path');
var bunyan = require('bunyan');


/**
 * logging
 */
exports.logLevels = {
  1: bunyan.FATAL,
  2: bunyan.ERROR,
  3: bunyan.WARN,
  4: bunyan.INFO,
  5: bunyan.DEBUG
};

var log = bunyan.createLogger({name: 'bell', stream: process.stdout});
exports.log = log;


/**
 * fatal
 */
exports.fatal = function() {
   log.error.apply(log, arguments);
   process.exit(1);
};


/**
 * join pathes and normalize the result
 *
 * example:
 *
 *  join('a', 'b', 'c')
 *  // => 'a/b/c'
 *
 * @param {String} ...path
 * @return {String}
 */
function join() {
  var result = path.join.apply(this, arguments);
  return path.normalize(result);
}


/**
 * pathes
 */
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
 * update nested objects
 *
 * example:
 *
 *   updateNestedObjects({x: 1, y: {z: 2}}, {x: 2, y: {z: 3, p: 4}, q: 5})
 *   // => {x: 2, y: {z: 3, p: 4}, q: 5}
 *
 * @param {Object} obj
 * @param {Object} other
 * @return {Object}
 */
function updateNestedObjects(obj, other) {
  var tmp;

  for (var key in other) {
    if (other.hasOwnProperty(key)) {
      var val = other[key];
      if (val !== null && typeof val === 'object') {  // if val is an object
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
exports.updateNestedObjects = updateNestedObjects;


/**
 * copy file from path `src` to path `dest`
 *
 * @param {String} src
 * @param {String} dest
 */
exports.copy = function(src, dest) {
  return fs.createReadStream(src).pipe(fs.createWriteStream(dest));
};


/**
 * simple id manager
 *
 * example:
 *
 *   var idm = new IDManager()
 *   idm.create()
 *   // => 1
 *   idm.remove(1)
 *   // => 1
 *   idm.create()
 *   // => 1
 */

function IDManager(){
  this.pool = {};
}

IDManager.prototype.create = function(){
  var i = 0;
  while (++i) {
    if (typeof this.pool[i] === 'undefined') {
      this.pool[i] = 1;
      return i;
    }
  }
};


/**
 * @param {Number} id
 * @return {Number}  // id
 */
IDManager.prototype.remove = function(id){
  delete this.pool[id];
  return id;
};

exports.idm = new IDManager();


/**
 * patch fivebeans reserve to be thunkify
 */
var patchBeansClient = function(beans){
  // thunkify fivebeans reserve method
  var reserve = function(cb) {beans.reserve(cb);};
  beans._reserve = function() {
    return function(cb) {
      var _cb = function(e, jid, buf){
        cb(e, {id: jid, body: buf.toString()});
      };
      reserve.apply(this, [_cb]);
    };
  };
};

exports.patches = {
  patchBeansClient: patchBeansClient
};


/**
 * empty object tester
 *
 * example:
 *
 *   isEmptyObject({})
 *   // => true
 */
exports.isEmptyObject = function(obj){
  return typeof obj === 'object' && !Object.keys(obj).length;
};


/**
 * math utils
 *
 * example:
 *
 *   var arr = _Array([1, 2, 3])
 *   arr.mean()
 *   // => 2
 *   arr.std()
 *   // => 0.816496580927726
 */
function _Array(array){
  this.array = array;
  this.cache = {};
  this.length = array.length;
}

_Array.prototype.mean = function(){
  if (this.cache.mean !== undefined) {
    return this.cache.mean;
  }

  for (var i = 0, sum = 0; i < this.length; i++) {
    sum += this.array[i];
  }
  return (this.cache.mean = sum / this.length);
};

_Array.prototype.std = function(){
  if (this.cache.std !== undefined) {
    return this.cache.std;
  }

  var mean = this.mean();

  for (var i = 0, sum = 0; i < this.length; i++) {
    var dis = this.array[i] - mean;
    sum += dis * dis;
  }
  return (this.cache.std = Math.sqrt(sum / this.length));
};

exports.array = function(array){
  return new _Array(array);
};
