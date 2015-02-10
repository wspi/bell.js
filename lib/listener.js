/**
 * Receive datapoints from clients over tcp and unpack them,
 * then put them to job queue.
 */

const inherits = require('util').inherits;
const minimatch = require('minimatch');

const configs = require('./configs');
const log = require('./log');
const patterns = require('./patterns');
const protocol = require('./protocol');
const service = require('./service');

// private _patterns
const _patterns = [];


/**
 * @constructor
 */
function Listener() {}
inherits(Listener, service);


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
 * Test if a datapoint matches our patterns
 *
 * @param {String} name
 * @return {Boolean}  // true for pass
 */
Listener.prototype._match = function(name) {
  var blacklist = configs.listener.blacklist;

  for (var i = 0; i < _patterns.length; i++) {
    if (minimatch(name, _patterns[i])) {
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


/**
 * Put a job to beanstalkd
 *
 * @param {Array} data  // [name, [time, value]]
 */

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


/**
 * Parse datapoints comming from socket
 *
 * @param {Array} datapoints  // [datapoint, ..]
 */
Listener.prototype.parse = function(datapoints) {
  for (var i = 0; i < datapoints.length; i++) {
    var datapoint = datapoints[i];
    if (this.match(datapoint[0]) && datapoint[1][1] !== null) {
      this.putJob(datapoint);
    }
  }
};


/**
 * Socket evented.
 */
Listener.prototype.serve = function *() {
  // init _patterns
  for (var key in patterns) {
    for (var key_ in patterns[key]) {
      _patterns.push(patterns[key][key_]);
    }
  }
  log.debug('Load patterns: %s .. (total %d)',
            _patterns[0] || '', _patterns.length);

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
