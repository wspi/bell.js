var fs = require('fs');
var path = require('path');
var Log = require('log');

var log = new Log();


/**
 * logging
 */
exports.logLevels = {
  1: Log.CRITICAL,
  2: Log.ERROR,
  3: Log.WARNING,
  4: Log.INFO,
  5: Log.DEBUG
};

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
 * copy `src` to `dest`
 */
exports.copy = function(src, dest) {
  return fs.createReadStream(src).pipe(fs.createWriteStream(dest));
};


/**
 * simple id manager
 */

function IDManager(){
  this.pool = {};
}

IDManager.prototype.create = function(){
  var i = 0;
  while (1) {
    if (this.pool[i] === undefined) {
      this.pool[i] = 1;
      return i;
    }
  }
};

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
 */
exports.isEmptyObject = function(obj){
  return typeof obj === 'object' && !Object.keys(obj).length;
};


/**
 * math utils
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

_Array.prototype.wma = function(alpha){
  alpha = alpha || 0.5;

  var mean = this.mean();

  for (var i = 0; i < this.length; i++) {
    mean = mean * (1 - alpha) + alpha * this.array[i];
  }
  return mean;
};

exports.array = function(array){
  return new _Array(array);
};
