/**
 * Built-in alerter `hipchat`.
 */

var minimatch = require('minimatch');
var request = require('request');
var util = require('util');


var log;
var configs;
var patterns;


/**
 * metricName <=> trend
 */
var trends = {};


/**
 * Update trendings
 */
function update(event) {
  var datapoint = event[0];
  var trend = event[1];
  var name = datapoint[0];

  if (typeof trends[name] === 'undefined') {
    trends[name] = [];
  }
  trends[name].push(trend);
}


/**
 * Check trends ervery interval
 */
function check() {
  for (var key in patterns) {
    for (var key_ in patterns[key]) {
      var sum = 0;
      var count = 0;
      var pattern = patterns[key][key_];

      for (var name in trends) {
        if (minimatch(name, pattern)) {
          for (var i = 0; i < trends[name].length; i++) {
            sum += trends[name].shift();
            count += 1;
          }
        }
      }

      if (count > 0) {
        alert(key, key_, sum / count);
      }
    }
  }
}


/**
 * Alert by levels & score
 */
function alert(key, key_, score) {
  var levels = configs.alerter.hipchat.levels || [0.4, 0.7, 0.9];

  for (var lev = levels.length - 1; lev >= 0; lev--) {
    if (Math.abs(score) >= levels[lev]) {
      notify(key, key_, lev, score);
    }
  }
}


/**
 * Notify hipchat
 */
var tpl = 'trending %s <a href="%s/?pattern=%s&sort=%s">%s :: %s (%s)</a>';
var api = 'http://api.hipchat.com/v1/rooms/message?format=json&auth_token=%s';

function notify(key, key_, lev, score) {
  log.info('Notify hipchat: %s, %s, %d', key, key_, score);

  var roomId = configs.alerter.hipchat.roomId;
  var weburl = configs.alerter.hipchat.weburl;
  var atwho = configs.alerter.hipchat.atwho || [];

  var pattern = patterns[key][key_];

  var trend = score > 0 ? '↑' : '↓';
  var color = ['gray', 'yellow', 'red'][lev];

  var message = util.format(
    tpl, trend, weburl, pattern, trend, key, key_,
    score.toFixed(3));

  if (lev === 2 && atwho.length > 0) {
      message = util.format('%s %s', atwho.join(' '), message);
  }

  var api_ = util.format(api, configs.alerter.hipchat.token);

  var notify_ = lev > 0 ? 1 : 0;

  var data = {'room_id': roomId, from: 'Bell Alerter', message: message,
    notify: +notify_, color: color};

  request.post(api_).form(data).on('error', function(err) {
    log.error('Hipchat request error: %s', err);
  });
}


/**
 * an alerter module should export a function `init` like
 * this
 */
exports.init = function(configs_, patterns_, alerter, log_) {
  configs = configs_;
  patterns = patterns_;
  log = log_;

  alerter.on('anomaly detected', update);
  setInterval(check, (configs.alerter.hipchat.interval || 300) * 1000);
};
