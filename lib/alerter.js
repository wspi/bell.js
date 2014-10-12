/**
 * Alert when anomalies were found.
 *
 * Q: why another process `alerter` but not doing this in analyzer(s)?
 * A: analyzers may alert multiple times, but we want only once.
 */

var inherits = require('util').inherits;
var configs = require('./configs');
var protocol = require('./protocol');
var service = require('./service');
var log = require('./util').log;


/**
 * alerter, analyzer socket evented
 */
function Alerter() {}
inherits(Alerter, service);


/**
 * incoming datapoints parser
 *
 * @param {Array} datapoints
 */
Alerter.prototype.parse = function (datapoints) {
  for (var i = 0; i < datapoints.length; i++) {
    var datapoint = datapoints[i];
    log.debug('Received: %s', datapoint);
    this.emit('anomaly detected', datapoint);
  }
};


/**
 * serve forever
 */
Alerter.prototype.serve = function *() {
  var self = this;

  // load modules
  var modules = configs.alerter.modules;
  for (var i = 0; i < modules.length; i++) {
    log.debug('Load module for alerter: %s', modules[i]);
    (require(modules[i]).init)(configs, self, log);
  }

  var port = configs.alerter.port;
  var host = configs.alerter.host;

  this.createSocketServer(port, host, function(datapoints) {
    return self.parse(datapoints);
  });
};  // jshint ignore:line

exports = module.exports = new Alerter();
