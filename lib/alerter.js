/**
 * Alert when anomalies were found.
 *
 * Q: why another process `alerter` but not doing this in analyzer(s)?
 * A: analyzers may alert multiple times, but we want only once.
 */

var inherits = require('util').inherits;
var configs = require('./configs');
var patterns = require('./patterns');
var service = require('./service');
var log = require('./log');


/**
 * alerter, analyzer socket evented
 */
function Alerter() {}
inherits(Alerter, service);


/**
 * serve forever
 */
Alerter.prototype.serve = function *() {
  var self = this;

  // load modules
  var modules = configs.alerter.modules;
  for (var i = 0; i < modules.length; i++) {
    log.debug('Load module for alerter: %s', modules[i]);
    (require(modules[i]).init)(configs, patterns, self, log);
  }

  var port = configs.alerter.port;
  var host = configs.alerter.host;

  this.createSocketServer(port, host, function(event) {
     log.debug('Received: %s', event);
     self.emit('anomaly detected', event);
  });
};  // jshint ignore:line

exports = module.exports = new Alerter();
