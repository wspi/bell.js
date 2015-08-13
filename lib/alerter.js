/**
 * @fileoverview Bell Alerter Service.
 */

// jshint -W124

'use strict';

const logging  = require('logging.js');
const inherits = require('util').inherits;
const configs  = require('./configs');
const service  = require('./service');
const log      = logging.get('bell.alerter');

function Alerter() {
}

inherits(Alerter, service);

Alerter.prototype.serve = function *() {
  var self = this,
      i,
      modules = configs.alerter.modules,
      host = configs.alerter.host,
      port = configs.alerter.port;

  //----------------------------------------------------
  // Load modules
  //----------------------------------------------------
  for (i = 0; i < modules.length; i++) {
    log.debug("Load module for alerter: %s", modules[i]);
    (require(modules[i]).init)(configs, self, log);
  }

  //----------------------------------------------------
  // Create socket server
  //----------------------------------------------------
  this.createSocketServer(port, host, function(event) {
    log.debug("Received: %s", event);
    self.emit('anomaly detected', event);
  });
};

exports = module.exports = new Alerter();
