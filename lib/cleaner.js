/**
 * @fileoverview Bell Cleaner Service.
 */

'use strict';

const co       = require('co');
const logging  = require('logging.js');
const inherits = require('util').inherits;
const configs  = require('./configs');
const service  = require('./service');
const log      = logging.get('bell.cleaner');

function Cleaner() {

}
inherits(Cleaner, service);

/**
 * Clean dead metrics, this function will check the last
 * time of a metric hit bell, if the age exceeds threshold,
 * clean it.
 */
Cleaner.prototype.clean = function *() {
  var hash = configs.ssdb.prefix + 'trend',
      threshold = configs.cleaner.threshold,
      list = yield this.ssdb.acquire().hgetall(hash),
      dict = {},
      i,
      keys = [],
      now = +new Date() / 1e3;


  //----------------------------------------------------
  // Collect names to delete
  //----------------------------------------------------
  for (i = 0; i < list.length; i += 2) {
    dict[list[i]] = +(list[i + 1].split(':')[1]);
  }

  for (var key in dict) {
    if ((now - dict[key] > threshold)) {
      keys.push(key);
      log.info("Clean target: %s (%ds)..", key, now - dict[key]);
    }
  }

  //----------------------------------------------------
  // Delete in ssdb
  //----------------------------------------------------
  if (keys.length === 0) {
    return;
  }

  var args = [hash];

  for (i = 0; i < keys.length; i++) {
    args.push(keys[i]);
  }

  // build delete reqs
  var reqs = [this.ssdb.acquire().multi_hdel.apply(null, args)];

  for (i = 0; i < keys.length; i++) {
    reqs.push(this.ssdb.acquire().zclear(keys[i]));
  }

  yield reqs;
};

Cleaner.prototype.serve = function *() {
  var self = this;

  this.createSsdbPool();

  log.info("cleaner started, interval: %ds, threshold: %ds",
           configs.cleaner.interval, configs.cleaner.threshold);

  // clean on startup
  yield this.clean();

  setInterval(co.wrap(function *() {
    yield self.clean();
  }), configs.cleaner.interval * 1e3);
};

exports = module.exports = new Cleaner();
