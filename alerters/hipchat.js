/**
 * this module can send message to a hipchat room once enough anomalies
 * were detected since a certain time, to enable it, add this module to
 * `alerter.modules` in configs.toml.
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
 * an alerter module should export a function `init` like this
 */
exports.init = function(configs, alerter, log) {
  var roomId = configs.alerter.hipchat.roomId;
  var token = configs.alerter.hipchat.token;
  var weburl = configs.alerter.hipchat.weburl;
  var since = configs.alerter.hipchat.since;
  var threshold = configs.alerter.hipchat.threshold;

  // api url
  var api = util.format(apiPattern, token);

  // create a new connection to ssdb
  var ssdbc = ssdb.createClient({
    port: configs.ssdb.port,
    host: configs.ssdb.host
  });

  // notify hipchat
  var notify = function (name, count) {
    log.debug('Notify hipchat.., %s, %d', name, count);
    var message = util.format(messagePattern, weburl, name, name, count, since);
    var data = {'room_id': roomId, from: 'Bell Alerter', message: message,
      notify: 1};
    request.post(api).form(data).on('error', function(err){
      log.error('Hipchat hook request error: %s', err);
    });
  };

  // cache the last time sent notification, {name: time}
  var cache = {};
  // key prefix
  var prefix = 'bellhipchat';

  alerter.on('anomaly detected', function(datapoint){
    // datapoint: [name, [timestamp, value, multiples]]
    var name = datapoint[0];
    var time = datapoint[1][0];

    // cache to ssdb, key: 'bellhipchattimer.mean.foo1411099647'
    ssdbc.setx([prefix, name, time].join(''), 0, since);

    // last time sent notification
    var last = cache[name] = cache[name] || 0;

    if (last + since < time) {
      var start = [prefix, name, time - since].join('');
      var stop = [prefix, name, time].join('');
      ssdbc.keys(start, stop, -1, function(err, data){
        if (err) {
          log.error('Hook hipchat error: %s', err);
        }

        // send notification if count >= threshold
        if(data.length >= threshold) {
          notify(name, data.length);
          // update cache
          cache[name] = time;
        }
      });
    }
  });
};
