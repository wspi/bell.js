/**
 * Receive metrics from statsd-bell over ctp and unpack them, then put
 * metrics to job queue.
 */

var inherits = require('util').inherits;
var minimatch = require('minimatch');
var configs = require('./configs');
var service = require('./service');
var log = require('./util').log;


/**
 * listener, socket evented
 */
function Listener() {}
inherits(Listener, service);


/**
 * test if a metric matches our patterns
 *
 * @param {String} name
 * @return {Boolean}  // true for pass
 */

Listener.prototype.match = function(name) {
  var matches = configs.listener.patterns.matches;
  var ignores = configs.listener.patterns.ignores;

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
 * put a job to beanstalkd
 *
 * @param {Array} data  // [name, [time, value]]
 */

Listener.prototype.putJob = function(data) {
  var job = JSON.stringify(data);
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
 * parse chunks comming from socket
 *
 * @param {Array} chunks  // [datapoint, ..]
 */
Listener.prototype.parse = function(chunks) {
  var i;
  var metrics = [];

  for (i = 0; i < chunks.length; i++) {
    var list = JSON.parse(chunks[i]);
    Array.prototype.push.apply(metrics, list);
  }

  for (i = 0; i < metrics.length; i++) {
    var metric = metrics[i];
    if (this.match(metric[0]) && metric[1][1] !== null) {
      this.putJob(metric);
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

  this.createSocketServer(port, host, function(chunks) {
    return self.parse(chunks);
  })
  .createBeansClient();

  yield this.connectBeans('use');
};

exports = module.exports = new Listener();
