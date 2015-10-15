/**
 * @fileoverview Bell Alerter Service.
 */

// jshint -W124

'use strict';

const logging = require('logging.js');
const config  = require('./config');
const service = require('./service');
const util    = require('./util');
const log     = logging.get('bell.alerter');

function Alerter() {
  this.name = 'alerter';
}
util.inherits(Alerter, service);

Alerter.prototype.serve = function *() {
  var self = this,
      i,
      modules = config.alerter.modules,
      host = config.alerter.host,
      port = config.alerter.port;

  //----------------------------------------------------
  // Load modules
  //----------------------------------------------------
  for (i = 0; i < modules.length; i++) {
    log.debug("load module for alerter: %s", modules[i]);
    (require(modules[i]).init)(config, self, log);
  }

  //----------------------------------------------------
  // Create socket server
  //----------------------------------------------------
  this.createSocketServer(port, host, function(event) {
    self.emit('anomaly detected', event);
  });
};

module.exports = new Alerter();
