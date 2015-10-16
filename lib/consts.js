/**
 * @overview  Bell consts.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const util = require('./util');

const viewPath = util.join(__dirname, '..', 'view');
const staticPath = util.join(__dirname, '..', 'static');

module.exports = {
  viewPath: viewPath,
  staticPath: staticPath,
};
