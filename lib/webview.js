/**
 * @overview  Bell webapp views.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const auth    = require('koa-basic-auth');
const mount   = require('koa-mount');
const route   = require('koa-route');
const static_ = require('koa-static');
const consts  = require('./consts');
const config  = require('./config');
const util    = require('./util');
const webutil = require('./webutil');
const url     = webutil.url;

exports.register = function(app) {
  app.use(mount(url('/static', static_(consts.staticPath))));
  app.use(error401);
  app.use(auth(config.webapp.auth));
};

function *error401(next) {
  try {
    yield next;
  } catch (err) {
    if (401 == err.status) {
      this.status = 401;
      this.set('WWW-Authenticate', 'Basic');
      this.body = 'Unauthorized';
    } else {
      throw err;
    }
  }
}
