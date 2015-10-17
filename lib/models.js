/**
 * @overview  Sequelize orm models.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const Sequelize = require('sequelize');

exports.register = function(sequelize) {
  var Rule = sequelize.define('rule', {
    pattern: {type: Sequelize.STRING},
    content: {type: Sequelize.STRING},
  });

  var Receiver = sequelize.define('receiver', {
    name: {type: Sequelize.STRING, unique: true},
    email: {type: Sequelize.STRING, unique: true},
    phone: {type: Sequelize.STRING, unique: true},
  });

  var DashGroup = sequelize.define('dashgroup', {
    name: {type: Sequelize.STRING},
  });

  var DashBoard = sequelize.define('dashboard', {
    name: {type: Sequelize.STRING},
    patterns: {type: Sequelize.TEXT},
  });

  Rule.belongsToMany(Receiver, {through: 'subscribes'});
  Receiver.belongsToMany(Rule, {through: 'subscribes'});
  DashGroup.hasMany(DashBoard);
  exports.Rule = Rule;
  exports.DashGroup = DashGroup;
  exports.DashBoard = DashBoard;
  return exports;
};
