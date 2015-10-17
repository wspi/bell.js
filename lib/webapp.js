/**
 * @overview  Bell webapp service.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */
// jshint -W124

'use strict';

const co = require('co');
const cluster = require('cluster');
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
  this.dashGroups = {};
}
util.inherits(WebApp, service);

/**
 * Serve entry
 */
WebApp.prototype.serve = function *() {
  if (cluster.isMaster) {
    for (var i = 0; i < config.webapp.workers; i++) {
      var worker = cluster.fork();
      log.info("forked worker, pid %d", worker.process.pid);
    }
  } else {
    var self = this;
    this.app = koa();
    this.createSsdbPool();
    this.createSequelize();
    models.register(this.sequelize);
    views.register(this.app);
    this.app.listen(config.webapp.port);
    util.setIntervalAndRunNow(co.wrap(function *() {
      yield self.syncTrendings();
      yield self.syncDashGroups();
    }), 1000*config.interval);
  }
};

WebApp.prototype.syncTrendings = function *() {
  var hash = util.format('%strend', config.ssdb.prefix);
  var list = yield this.ssdb.acquire().hgetall(hash);
  var dict = {}, i;

  for (i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  this.trendings = dict;
  log.info("trendings sync done, %d items",
           util.objectLength(this.trendings));
};

WebApp.prototype.syncDashGroups = function *() {
  yield this.sequelize.sync();
  var dashGroups = yield models.DashGroup.findAll();
  var dict = {}, dashGroup, dashBoard, dashBoards, i, j, item;

  for (i = 0; i < dashGroups.length; i++) {
    dashGroup = dashGroups[i];
    dashBoards = yield dashGroup.getDashBoards();
    item = {name: dashGroup.name, dashBoards: {}};
    dict[dashGroup.id] = item;
    for (j = 0; j < dashBoards.length; j++) {
      dashBoard = dashBoards[j];
      item.dashBoards[dashBoard.id] = dashBoard;
    }
  }

  this.dashGroups = dict;
  log.info("dash groups sync done, %d items",
           util.objectLength(this.dashGroups));
};

module.exports = new WebApp();
