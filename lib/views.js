/**
 * @overview  Bell webapp views.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */
// jshint -W124

'use strict';

const auth = require('koa-basic-auth');
const extend = require('extend');
const mount = require('koa-mount');
const route = require('koa-route');
const static_ = require('koa-static');
const config = require('./config');
const consts = require('./consts');
const log = require('./log');
const middlewares = require('./middlewares');
const render = require('./render');
const webapp = require('./webapp');
const url = require('./url');
const util = require('./util');

//----------------------------------------------------
// Exports Register
//----------------------------------------------------
exports.register = function(app) {
  app.use(mount(url('/static'), static_(consts.staticPath)));
  app.use(middlewares.log);
  app.use(middlewares.error401);
  app.use(mount('/admin', auth(config.webapp.auth)));
  app.use(route.get('/', index));
};

//----------------------------------------------------
// Util functions
//----------------------------------------------------
function buildParams(request) {
  var params;

  if (request.query.dashboard) {
    params = {dashboard: request.query.dashboard};
  } else {
    params = {pattern: request.query.pattern || '*'};
  }

  extend(params, {
    type: request.query.type === 'v' ? 'v' : 'm',
    limit: request.query.limit || 50,
    sort: request.query.sort === '↓' ? '↓' : '↑',
    past: request.query.past || '0s',
    stop: request.query.stop || 0,
    lang: request.query.lang === 'zh' ? 'zh' : 'en',
  });

  return params;
}

//----------------------------------------------------
// View Handlers
//----------------------------------------------------

function *index() {
  this.body = yield render('index.html', {
    params: buildParams(this.request),
    dashGroups: webapp.dashGroups,
  });
}
