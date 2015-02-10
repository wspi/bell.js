/**
 * Configs hub
 */

'use strict';

const fs = require('fs');
const toml = require('toml');

const util = require('./util');

exports = module.exports = toml.parse(
  fs.readFileSync(util.path.configs)
    .toString());
