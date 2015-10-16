/**
 * @overview  Simple logging.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const util = require('./util');

const levels = {
  DEBUG: 10,
  INFO : 20,
  WARN : 30,
  ERROR: 40,
  CRIT : 50,
};

function log(levelName, args) {
  if (levels[levelName.toUpperCase()] >= exports.level) {
    var msg = util.format.apply(null, args);
    return util.log("%s :: %s", levelName, msg);
  }
}

exports = module.exports = {
  level: levels.INFO,
  debug: function() { log('debug', arguments); },
  info : function() { log('info', arguments); },
  warn : function() { log('warn', arguments); },
  error: function() { log('error', arguments); },
  crit : function() { log('crit', arguments); },
};
util._extend(exports, levels);
