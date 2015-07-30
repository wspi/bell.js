'use strict';

const co = require('co');
const logging = require('logging.js');
const inherits = require('util').inherits;
const configs = require('./configs');
const service = require('./service');

const log = logging.get('bell.cleaner');

function Cleaner() {}
inherits(Cleaner, service);

// Clean dead metrics, this function will check the last time
// of a metric hit bell, if the age exceeds threshold, clean it.
Cleaner.prototype.clean = function *() {
  var hash = configs.ssdb.prefix + 'trend';
  var threshold = configs.cleaner.threshold;
  var list = yield this.ssdb.acquire().hgetall(hash);
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
    var reqs = [this.ssdb.acquire().multi_hdel.apply(null, args)];

    for (i = 0; i < keys.length; i++) {
      reqs.push(this.ssdb.acquire().zclear(keys[i]));
    }

    // send reqs
    yield reqs;
  }
};

Cleaner.prototype.serve = function *() {
  this.createSsdbPool();

  log.info('cleaner started, interval: %ds, threshold: %ds',
           configs.cleaner.interval, configs.cleaner.threshold);

  // clean on startup
  yield this.clean();

  var self = this;
  setInterval(co.wrap(function *() {
    yield self.clean();
  }), configs.cleaner.interval * 1e3);
};

exports = module.exports = new Cleaner();
