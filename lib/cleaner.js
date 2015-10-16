/**
 * @overview  Bell cleaner service.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const co = require('co');
const config = require('./config');
const log = require('./log');
const service = require('./service');
const util = require('./util');

/**
 * Service cleaner.
 */
function Cleaner() {
  this.name = 'cleaner';
}
util.inherits(Cleaner, service);

/**
 * Clean dead metrics, this function will check the last
 * time of a metric hit bell, if the age exceeds threshold,
 * clean it.
 */
Cleaner.prototype.clean = function *() {
  var hash = config.ssdb.prefix + 'trend',
      threshold = config.cleaner.threshold,
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
      log.info("clean target: %s (%ds)..", key, now - dict[key]);
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
           config.cleaner.interval, config.cleaner.threshold);

  // clean on startup
  yield this.clean();

  setInterval(co.wrap(function *() {
    yield self.clean();
  }), config.cleaner.interval * 1e3);
};

module.exports = new Cleaner();
