/**
 * Receive datapoints from clients over ctp and unpack them, then put
 * them to job queue.
 */

var inherits = require('util').inherits;
var minimatch = require('minimatch');
var configs = require('./configs');
var patterns = require('./patterns');
var protocol = require('./protocol');
var service = require('./service');
var log = require('./util').log;


/**
 * {Array}, pattterns list
 */
var patterns_ = [];


/**
 * listener, socket evented
 */
function Listener() {}
inherits(Listener, service);


/**
 * test if a datapoint matches our patterns
 *
 * @param {String} name
 * @return {Boolean}  // true for pass
 */

Listener.prototype.match = function(name) {
  var blacklist = configs.listener.blacklist;

  for (var i = 0; i < patterns_.length; i++) {
    if (minimatch(name, patterns_[i])) {
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
 * put a job to beanstalkd
 *
 * @param {Array} data  // [name, [time, value]]
 */

Listener.prototype.putJob = function(datapoint) {
  var job = JSON.stringify(datapoint);
  return this.beans.put(0, 0, 60, job, function(err, jid){
    // put(priority, delay, ttr, payload, callback)
    if (err) {
      log.warnig('Error on putting job: %s, error: %s', job, err);
    } else {
      log.info('Queued: %s, job id: %d', job, jid);
    }
  });
};


/**
 * parse datapoints comming from socket
 *
 * @param {Array} datapoints  // [datapoint, ..]
 */
Listener.prototype.parse = function(datapoints) {
  for (i = 0; i < datapoints.length; i++) {
    var datapoint = datapoints[i];
    if (this.match(datapoint[0]) && datapoint[1][1] !== null) {
      this.putJob(datapoint);
    }
  }
};


/**
 * serve forever
 */
Listener.prototype.serve = function *() {
  // init patterns_
  for (var key in patterns) {
    for (var key_ in patterns[key]) {
      patterns_.push(patterns[key][key_]);
    }
  }
  log.debug('Load patterns: %s .. (total %d)',
            patterns_[0] || '', patterns_.length);

  var self = this;
  var port = configs.listener.port;
  var host = configs.listener.host;

  this.createSocketServer(port, host, function(datapoints) {
    return self.parse(datapoints);
  })
  .createBeansClient();

  yield this.connectBeans('use');
};

exports = module.exports = new Listener();
