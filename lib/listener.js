/**
 * @overview  Bell listener service.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const logging   = require('logging.js');
const minimatch = require('minimatch');
const config    = require('./config');
const service   = require('./service');
const util      = require('./util')
const log       = logging.get('bell.listener');

/**
 * Service listener.
 */
function Listener() {
  this.name = 'listener';
  this.cache = {};
}
util.inherits(Listener, service);

/**
 * Get if a name matches our patterns, via cache
 *
 * @param {String} name
 * @return {Boolean}
 */

Listener.prototype.match = function(name) {
  if (!(name in this._cache)) {
    this._cache[name] = this._match(name);
  }
  return this._cache[name];
};

/**
 * Test if a datapoint matches our whitelist or blacklist.
 *
 * @param {String} name
 * @return {Boolean}  // true for pass
 */
Listener.prototype._match = function(name) {
  var blacklist = config.listener.blacklist,
      whitelist = config.listener.whitelist,
      i, k;

  for (i = 0; i < whitelist.length; i++) {
    if (minimatch(name, whitelist[i])) {
      for (k = 0; k < blacklist.length; k++) {
        if (minimatch(name, blacklist[k])) {
          log.debug("%j hit black pattern %j", name, blacklist[k]);
          return false;
        }
      }
      return true;
    }
  }
  log.debug("%j dosent hit any white pattern", name);
  return false;
};

/**
 * Put a job to beanstalkd
 * @param {Array} data  // [name, [time, value]]
 */
Listener.prototype.putJob = function(datapoint) {
  var job = JSON.stringify(datapoint);
  // put(priority, delay, ttr, payload, callback)
  return this.beans.put(0, 0, 60, job, function(err, jid) {
    if (err) {
      log.warnig('error on putting job: %s, error: %s', job, err);
    } else {
      log.info('queued: %s, job id: %d', job, jid);
    }
  });
};

/**
 * Parse datapoints comming from socket
 * @param {Array} datapoints  // [datapoint, ..]
 */
Listener.prototype.parse = function(datapoints) {
  var i, datapoint;

  for (i = 0; i < datapoints.length; i++) {
    datapoint = datapoints[i];
    if (this.match(datapoint[0]) && datapoint[1][1] !== null) {
      this.putJob(datapoint);
    }
  }
};

Listener.prototype.serve = function *() {
  var self = this;

  // init pattern matches cache {string: bool}
  this._cache = {};
  config.emitter.on('reload', function() {
    self.cache = {};
  });

  this.createSocketServer(config.listener.port, function(datapoints) {
    return self.parse(datapoints);
  }).createBeansClient();

  yield this.connectBeans('use');

};

module.exports = new Listener();
