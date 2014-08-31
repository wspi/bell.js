/**
 * Alert when anomalies were found.
 *
 * Q: why another process `alerter` but not doing this in analyzer(s)?
 * A: analyzers may alert multiple times, but we want only once.
 */

var inherits = require('util').inherits;
var configs = require('./configs');
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
 * @param {Array} chunks
 */
Alerter.prototype.parse = function (chunks) {
  var datapoints = [];

  for (var i = 0; i < chunks.length; i++) {
    var datapoint = JSON.parse(chunks[i]);
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

  this.createSocketServer(configs.alerter.port, function(chunks) {
    return self.parse(chunks);
  });
};

exports = module.exports = new Alerter();
