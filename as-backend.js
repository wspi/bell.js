/**
 * Exports function `init` as a statsd's backend
 *
 * Optional configs:
 *   bellHost, default: '0.0.0.0'
 *   bellPort, default: 8889
 *   bellIgnores, default: ['statsd.*']
 *   bellTimerDataFields, default: ['mean', 'count_ps']
 *
 * Metric types supported: `counter_rates` & `timer_data`
 */

var net = require('net');
var minimatch = require('minimatch');

var config;
var debug;
var logger;


/**
 * datapoints creator for each metric type
 */
var makers = {
  'counter_rates': function (key, val, time) {
    return [['counter.' + key, [time, val]]];
  },
  'timer_data': function (key, stats, time) {
    var fields = config.bellTimerDataFields || ['mean', 'count_ps'];
    var datapoints = [];

    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var name = ['timer', field, key].join('.');
      var val = stats[field];
      datapoints.push([name, [time, val]]);
    }
    return datapoints;
  }
};


/**
 * test if metric name matches our patterns
 */
function match(key) {
  var ignores = config.ignores || ['statsd.*'];
  for (var i = 0; i < ignores.length; i++) {
    if (minimatch(key, ignores[i])) {
      return true;
    }
  }
  return false;
}


/**
 * bell constructor
 */
function Bell() {}


/**
 * connect to bell listener
 */
Bell.prototype.connect = function() {
  var self = this;

  this.conn = net.connect({
    host: config.bellHost || '0.0.0.0',
    port: config.bellPort || 8889
  }, function(){
    if (debug) {
      logger.log('bell connected successfully');
    }
  })
  .on('error', function(err) {
    if (debug) {
      logger.log('bell connection error: ' + err.message);
      logger.log('closing socket connection');
    }
    self.conn.destroy();
    self.conn = undefined;
  });

  return this;
};


/**
 * flush datapoints to bell
 */
Bell.prototype.flush = function(time, data) {
  var list = [];
  var types = Object.keys(makers);

  // collect datapoints
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    var dict = data[type];

    for (var key in dict) {
      if (!match(key)) {
        var val = dict[key];
        var maker = makers[type];
        var datapoints = maker(key, val, time);
        Array.prototype.push.apply(list, datapoints);
      }
    }
  }

  var length = list.length;

  // send to bell if not empty
  if (length > 0) {
    var string = JSON.stringify(list);
    var buffer = new Buffer('' + string.length + '\n' + string);

    if (!this.conn) {
      this.connect();
    }

    this.conn.write(buffer, 'utf8', function(){
      if (debug) {
        var message = 'sent to bell: ' + JSON.stringify(list[0]);

        if (length > 1) {
          message += ', (' + (length - 1) + ' more..)';
        }

        logger.log(message);
      }
    });
  }
};


exports.init = function(uptime, _config, events, _logger) {
  logger = _logger || console;
  debug = _config.debug;
  config = _config || {};
  var bell = new Bell();
  events.on('flush', function(time, data){bell.flush(time, data);});
  bell.connect();
  return true;
};
