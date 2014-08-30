/**
 * this module can send message to hipchat room once enough anomalies
 * were detected since a certain time, to enable it, add this module
 * to `alerter.modules`.
 */

var util = require('util');
var request = require('request');
var ssdb = require('ssdb');


var messagePattern = '' +
  // params: weburl, metric name, metric name
  '<a href="%s/%s">%s</a>: ' +
  // params: anomalies count, since
  '%d anomalies in last %d seconds';

var apiPattern = '' +
  'http://api.hipchat.com/v1/rooms/message?' +
  'format=json&auth_token=%s';


/**
 * an alerter module should export a function `init` like this:
 */
exports.init = function(configs, alerter, log) {
  var roomId = configs.alerter.hipchat.roomId;
  var token = configs.alerter.hipchat.token;
  var weburl = configs.alerter.hipchat.weburl;
  var since = configs.alerter.hipchat.since;
  var threshold = configs.alerter.hipchat.threshold;
  var api = util.format(apiPattern, token);

  // create a new connection to ssdb
  var ssdbc = ssdb.createClient({
    port: configs.ssdb.port,
    host: configs.ssdb.host
  });

  var notify = function (name, count, callback) {
    log.debug('Notify hipchat, %s, %d', name, count);
    var message = util.format(messagePattern, weburl, name, name, count, since);
    var data = {'room_id': roomId, from: 'Bell', message: message, notify: 1};
    request.post(api).form(data).on('error', function(err) {
      log.error('Hipchat hook request error: %s', err);
    });
  };

  // cache the last time sent notification, {name: time}
  var cache = {};

  alerter.on('anomaly detected', function(datapoint) {
    // datapoint: [name, [timestamp, value, multiple]]
    var name = datapoint[0];
    var time = datapoint[1][0];

    var last = cache[name];
    if (typeof last === 'undefined') {
      last = cache[name] = 0;
    }

    var start = time - since;

    if (last < start) {
      var zset = configs.ssdb.zset.prefix + '_' + name;
      // we should send a notification
      ssdbc.zcount(zset, start, time, function(err, count){
        if (err) {
          log.error('Hook hipchat has error, zcount ssdb: %s', err);
        }
        // send notification if count >= threshold
        if (count >= threshold) {
          notify(name, count);
          cache[name] = time;
        }
      });
    }
  });
};
