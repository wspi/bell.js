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
const logging = require('logging.js');
const url     = require('./url');
const util    = require('./util');
const log     = logging.get('bell.views');

//----------------------------------------------------
// Exports Register
//----------------------------------------------------
exports.register = function(app) {
  app.use(mount(url('/static', static_(consts.staticPath))));
  app.use(error401);
  app.use(auth(config.webapp.auth));
};

//----------------------------------------------------
// View Handlers
//----------------------------------------------------
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

/**
 * Logging one request
 */
function logRequest(path, params) {
  var chunks = [];

  for (var key in params)
    chunks.push(util.format('%s: %j', key, params[key]));

  return log.info('%s => %s', path, chunks.join(', '));
}
