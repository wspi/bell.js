/**
 * Standalone metrics cleaner.
 */


var inherits = require('util').inherits;
var co = require('co');
var configs = require('./configs');
var log = require('./log');
var service = require('./service');


/**
 * cleaner, setInterval evented
 */
function Cleaner() {}
inherits(Cleaner, service);


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

  for (var key in dict) {
    if ((now - dict[key] > threshold)) {
      keys.push(key);
      log.info('Clean target: %s (%ds)..', key, now - dict[key]);
    }
  }

  // build a copy arguments for multi_hdel
  if (keys.length > 0) {
    var args = [hash];

    for (i = 0; i < keys.length; i++) {
      args.push(keys[i]);
    }

    // build delete reqs
    var reqs = [this.ssdb.multi_hdel.apply(null, args)];  // jshint ignore: line

    for (i = 0; i < keys.length; i++) {
      reqs.push(this.ssdb.zclear(keys[i]));
    }

    // send reqs
    yield reqs;
  }
};


/**
 * serve entry
 */
Cleaner.prototype.serve = function *() {
  this.createSsdbClient();

  log.info('cleaner started, interval: %ds, threshold: %ds',
           configs.cleaner.interval, configs.cleaner.threshold);

  // clean on startup
  yield this.clean();

  var self = this;
  setInterval(function(){
    co(function *(){
      yield self.clean();
    })();
  }, configs.cleaner.interval * 1000);

};  // jshint ignore: line


exports = module.exports = new Cleaner();
