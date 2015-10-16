/**
 * @overview  Bell webapp views.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const mount     = require('koa-mount');
const route     = require('koa-route');
const static_   = require('koa-static');
const consts    = require('./consts');
const util      = require('./util');
const webutil   = require('./webutil');
const url       = webutil.url;
const staticPath = util.join(__dirname, )

exports.register = function(app) {
  app.use(mount(webutil.url('/static', static_(consts.staticPath))));
  // PASS
};
