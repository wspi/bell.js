'use strict';

const logging   = require('logging.js');
const minimatch = require('minimatch');
const inherits  = require('util').inherits;
const configs   = require('./configs');
const service   = require('./service');

const log       = logging.get('bell.listener');

function Listener() {}
inherits(Listener, service);

// Get if a name matches our patterns, via cache
//
// @param {String} name
// @return {Boolean}
//
Listener.prototype.match = function(name) {
  if (!(name in this._cache)) {
    this._cache[name] = this._match(name);
  }
  return this._cache[name];
};

// Test if a datapoint matches our patterns
//
// @param {String} name
// @return {Boolean}  // true for pass
//
Listener.prototype._match = function(name) {
  var blacklist = configs.listener.blacklist;
  var patterns = configs.listener.patterns;

  for (var i = 0; i < patterns.length; i++) {
    if (minimatch(name, patterns[i])) {
      for (var k = 0; k < blacklist.length; k++) {
        if (minimatch(name, blacklist[k])) {
          log.debug('%j hit black pattern %j', name, blacklist[k]);
          return false;
        }
      }
      return true;
    }
  }
  log.debug('%j dosent hit any patterns', name);
  return false;
};

// Put a job to beanstalkd
// @param {Array} data  // [name, [time, value]]
//
Listener.prototype.putJob = function(datapoint) {
  var job = JSON.stringify(datapoint);
  // put(priority, delay, ttr, payload, callback)
  return this.beans.put(0, 0, 60, job, function(err, jid) {
    if (err) {
      log.warnig('Error on putting job: %s, error: %s', job, err);
    } else {
      log.info('Queued: %s, job id: %d', job, jid);
    }
  });
};

// Parse datapoints comming from socket
// @param {Array} datapoints  // [datapoint, ..]
//
Listener.prototype.parse = function(datapoints) {
  for (var i = 0; i < datapoints.length; i++) {
    var datapoint = datapoints[i];
    if (this.match(datapoint[0]) && datapoint[1][1] !== null) {
      this.putJob(datapoint);
    }
  }
};

Listener.prototype.serve = function *() {
  // init pattern matches cache {string: bool}
  this._cache = {};

  var self = this;
  var port = configs.listener.port;
  var host = configs.listener.host;

  this.createSocketServer(port, host, function(datapoints) {
    return self.parse(datapoints);
  }).createBeansClient();

  yield this.connectBeans('use');
};

exports = module.exports = new Listener();
