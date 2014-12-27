/**
 * Logging (to stdout)
 */
var util = require('util');
var strftime = require('strftime');


// level names to levels mapping
var levels = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};


// levels to names mapping
var levels_ = {
  1: 'debug',
  2: 'info',
  3: 'warn',
  4: 'error',
  5: 'fatal'
};


/**
 * @constructor
 * @param {Object} options
 */
function Log(options) {
  options = options || {};
  this.name = options.name;
  this.level = options.level || levels.info;
}


Log.prototype.log = function(level) {
  if (level >= this.level) {
    var args = [].slice.call(arguments, 1);
    var msg = util.format.apply(null, args);
    var now = strftime('%b %d %Y %H:%M:%S.%L', new Date());
    var pid = process.pid;
    var levelName = levels_[level];
    out = util.format('%s %s %s/%d> %s\n', now, levelName, this.name, pid,
                      msg);
    process.stdout.write(out);
  }
};


for (var name in levels) {
  (function(name){
    Log.prototype[name] = function() {
      var args = [].slice.call(arguments);
      args.splice(0, 0, levels[name]);
      return this.log.apply(this, args);
    };
  })(name);  // jshint ignore:line
}


exports = module.exports = new Log();
