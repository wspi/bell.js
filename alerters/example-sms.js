/**
 * Example sms alerter for bell.js, cannot work but only a demo.
 */

'use strict';

const util = require('util');

/**
 * Send sms message, should be implemented by yourself.
 *
 * @param {String} msg
 * @param {Number} receiver
 * @param {Object} log
 */

function send(msg, receiver, log) {
  throw new Error("Not Implemented Error");
}


/**
 * A table to record last timestamp the metric sent at.
 * Schema: { name: lastSentAt }
 */
const stats = {};

/**
 * Mobile list to receive the message.
 */
const mobiles = [];

/**
 * Alert interval (for most frequency)
 */
const interval = 30 * 60; // 60min

/**
 * Message builder
 */
function wrap(name, value, trend) {
  var tpl = "%s is anmolous with trending %s, current value: %s";
  return util.format(tpl, name, trend.toFixed(2), value.toFixed(2));
}


/**
 * Hook to export to alerter.
 *
 * @param {Object} configs // bell configs
 * @param {Alerter} alerter // alerter service
 * @param {Object} log // bell's logger
 */
exports.init = function(configs, alerter, log) {
  var trend = event[1],
      name = event[0][0],
      value = event[0][1][1];

  if ((Math.abs(trend) >= 1) &&
      (+new Date() - stats[name] >= interval * 1000)) {
    mobiles.forEach(function(mobile) {
      send(wrap(name, value, trend), mobile, log);
    });
    stats[name] = +new Date();
  }
}
