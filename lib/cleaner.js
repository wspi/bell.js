/**
 * Standalone metrics cleaner.
 */


var inherits = require('util').inherits;
var co = require('co');
var minimatch = require('minimatch');
var configs = require('./configs');
var service = require('./service');
var log = require('./util').log;


/**
 * cleaner, setInterval evented
 */
function Cleaner() {}
inherits(Cleaner, service);


/**
 * test if a metric matches cleaner patterns, the same
 * like `listener.match`
 *
 * @param {String} name  // metric name
 * @return {Boolean}  // true for ok
 */
Cleaner.prototype.match = function(name) {
  var matches = configs.cleaner.patterns.matches;
  var ignores = configs.cleaner.patterns.ignores;

  for (var i = 0; i < matches.length; i++) {
    if (minimatch(name, matches[i])) {
      for (var k = 0; k < ignores.length; k++) {
        if (minimatch(name, ignores[k])) {
          log.debug('%s matches ignore pattern %s', name, ignores[k]);
          return false;
        }
      }
      return true;
    }
  }
  log.debug('%s dosent match any match patterns', name);
  return false;
};


/**
 * clean dead metrics, this function will check the last time of a metric
 * hit node-bell, if the age exceeds threshold, clean it.
 */
Cleaner.prototype.clean = function *() {
  var hash = configs.ssdb.prefix + 'trend';
  var threshold = configs.cleaner.threshold;
  var list = yield this.ssdb.hgetall(hash);
  var dict = {};  // name => timestamp

  for (var i = 0; i < list.length; i += 2) {
    dict[list[i]] = +(list[i + 1].split(':')[1]);
  }

  // collect dest keys
  var keys = [];
  var now = +new Date() / 1000;

  for (var key in Object.keys(dict)) {
    if (this.match(key) && (now - dict[key] > threshold)) {
      keys.push(key);
    }
  }

  /**
   * do cleanning tasks
   */

  // build a copy arguments for multi_hdel
  var args = [hash];

  for (i = 0; i < keys.length; i++) {
    args.push(keys[i]);
  }

  // build delete reqs
  var reqs = [this.ssdb.multi_hdel.apply(null, args)];  // jshint ignore: line
  for (i = 0; i < keys.length; i++) {
    reqs.push(this.ssdb.zclear(keys[i]));
    log.info('Clean %s..', keys[i]);
  }
  yield reqs;
};


/**
 * serve entry
 */
Cleaner.prototype.serve = function *() {
  this.createSsdbClient();

  var self = this;

  setInterval(function(){
    co(function *(){
      yield self.clean();
    })();
  }, configs.cleaner.interval * 1000);
};  // jshint ignore: line


exports = module.exports = new Cleaner();
