'use strict';

const inherits  = require('util').inherits;
const configs   = require('./configs');
const log       = require('./log');
const patterns  = require('./patterns');
const service   = require('./service');

function Alerter() {}
inherits(Alerter, service);

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
};

exports = module.exports = new Alerter();
