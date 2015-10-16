/**
 * @overview  Sequelize orm models.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

const Sequelize = require('sequelize');

exports.register = function(sequelize) {
  var Rule = define('rule', {
    name: Sequelize.STRING,
    data: Sequelize.STRING,
  });
  var DashGroup = define('dashgroup', {
    name: Sequelize.STRING,
  });
  var DashBoard = define('dashboard', {
    name: Sequelize.STRING,
    patterns: Sequelize.TEXT,
  });
  DashGroup.hasMany(DashBoard);
  exports.Rule = Rule;
  exports.DashGroup = DashGroup;
  exports.DashBoard = DashBoard;
  return exports;
};
