'use strict';

const util = require('util');
const strftime = require('strftime');

const levelsNameToValue = {
  debug: 1,
  info : 2,
  warn : 3,
  error: 4,
  fatal: 5
};

const levelsValueToName = {
  1: 'debug',
  2: 'info',
  3: 'warn',
  4: 'error',
  5: 'fatal'
};

function Log(options) {
  options = options || {};
  this.name = options.name;
  this.level = options.level || levelsNameToValue.info;
}

// @param {Number} level
Log.prototype.log = function(level) {
  if (level >= this.level) {
    var args = [].slice.call(arguments, 1);
    var msg = util.format.apply(null, args);
    var now = strftime('%b %d %Y %H:%M:%S.%L', new Date());
    var pid = process.pid;
    var levelName = levelsValueToName[level];
    var out = util.format('%s %s %s/%d> %s\n', now, levelName, this.name, pid,
                      msg);
    process.stdout.write(out);
  }
};

// register logging methods
for (var name in levelsNameToValue) {
  (function(name){
    Log.prototype[name] = function() {
      var args = [].slice.call(arguments);
      args.splice(0, 0, levelsNameToValue[name]);
      return this.log.apply(this, args);
    };
  })(name);
}

exports = module.exports = new Log();
