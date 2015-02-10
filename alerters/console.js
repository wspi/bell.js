/**
 * Demo alerter module
 */

exports.init = function(configs, patterns, alerter, log) {
  alerter.on('anomaly detected', function(event) {
    var trend = event[1];
    var datapoint = event[0];
    log.info('Anomaly detected, datapoint: %s, trend: %d',
            datapoint, trend);
  });
};
