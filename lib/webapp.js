/**
 * @overview  Bell webapp service.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */
// jshint -W124

'use strict';

const koa = require('koa');
const config = require('./config');
const log = require('./log');
const models = require('./models');
const service = require('./service');
const views = require('./views');
const util = require('./util');

/**
 * Service analyzer
 */
function WebApp() {
  this.name = 'webapp';
  this.trendings = {};
}
util.inherits(WebApp, service);

/**
 * Serve entry
 */
WebApp.prototype.serve = function *() {
  this.app = koa();
  this.createSsdbPool();
  this.createSequelize();

  models.register(this.sequelize);
  views.register(this.app);
  this.app.listen(config.webapp.port);
  util.setIntervalAndRunNow(this.syncTrendings,
                            1000*config.interval);
};

WebApp.prototype.syncTrendings = function *() {
  var hash = util.format('%s.trend', config.ssdb.prefix);
  var list = yield this.ssdb.acquire().hgetall(hash);
  var dict = {}, i;

  for (i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  this.trendings = dict;
  log.info("sync trendings done, %d items",
           util.objectLength(this.trendings));
};

module.exports = new WebApp();
