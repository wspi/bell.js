exports.init = function(configs, alerter, log) {
  alerter.on('anomaly detected', function(datapoint) {
    console.log('hipchat: ', datapoint);
  });
};
