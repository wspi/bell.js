/**
 * Receive datapoints from clients over ctp and unpack them, then put
 * them to job queue.
 */

var inherits = require('util').inherits;
var configs = require('./configs');
var protocol = require('./protocol');
var service = require('./service');
var log = require('./util').log;
var startsWith = require('./util').startsWith;


/**
 * listener, socket evented
 */
function Listener() {}
inherits(Listener, service);


/**
 * test if a datapoint matches our prefix rules
 *
 * @param {String} name
 * @return {Boolean}  // true for pass
 */

Listener.prototype.match = function(name) {
  var matches = configs.listener.prefixes.matches;
  var ignores = configs.listener.prefixes.ignores;

  for (var i = 0; i < matches.length; i++) {
    if (startsWith(name, matches[i])) {
      for (var k = 0; k < ignores.length; k++) {
        if (startsWith(name, ignores[i])) {
          log.debug('%j hit ignore prefix %j', name, ignores[k]);
        }
      }
      return true;
    }
  }
  log.debug('%j desent hit any match prefixes', name);
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
