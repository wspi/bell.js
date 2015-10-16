/**
 * @overview  Bell webapp views.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const auth = require('koa-basic-auth');
const mount = require('koa-mount');
const route = require('koa-route');
const static_ = require('koa-static');
const config = require('./config');
const consts = require('./consts');
const log = require('./log');
const middlewares = require('./middlewares')
const url = require('./url');
const util = require('./util');

//----------------------------------------------------
// Exports Register
//----------------------------------------------------
exports.register = function(app) {
  app.use(mount(url('/static'), static_(consts.staticPath)));
  app.use(middlewares.log);
  app.use(middlewares.error401);
  app.use(auth(config.webapp.auth));
};

//----------------------------------------------------
// View Handlers
//----------------------------------------------------
function *error401(next) {
}

function *index() {
  this.body = "hello world";
}
