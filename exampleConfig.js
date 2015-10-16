/**
 * Configurations for eleme/bell.js.
 *
 * Global Options
 *   interval       incoming metrics time interval (in sec). [default: 10]
 *   autoReload     if set true, config will be auto reread and applied, note
 *                  that not all options are auto reloading. [default: true]
 *   logging        the directory to place logs (including analyzer.log,
 *                  analyzer.err etc), [default: logging to stderr].
 *
 * Beanstalkd Options
 *   host           hostname/IP of beanstalkd server. [default: '0.0.0.0']
 *   port           port of beanstalkd server. [default: '0.0.0.0']
 *   tube           tube to use/watch. [default: 'bell']
 *
 * SSDB Options:
 *   host           hostname/IP of ssdb server. [default: '0.0.0.0']
 *   port           port of ssdb server. [default: 8888]
 *   auth           auth to connect to ssdb server. [default: null]
 *   size           connection pool size. [default: 6]
 *   prefix         the prefix to name bell zset/hash.. [default: 'bell.']
 *
 * SQLite Options:
 *   file           file path for sqlite (maintains admin etc.) [default: 'bell.db']
 *
 * Listener Options
 *   port           listener port to listen. [default: 2015]
 *   whitelist      metrics whitelist. [auto reloading, default: ['*']]
 *   blacklist      metrics blacklist. [auto reloading, default: ['statsd.*']]
 *                  listener will allow one metric to pass only if it matches one
 *                  pattern in whitelist and dosen't match any pattern in blacklist.
 *
 * Analyzer Options
 *   workers        number of analyzer workers to start. [default: 4]
 *   strict         strict mode flag. [auto reloading, default: true]
 *   startSize      analyzers won't start until the data set is larger than
 *                  this size. [default: 50]
 *   periodicity    metrics periodicity (in sec). [default: 24*3600 (1 day)]
 *   expiration     datapoint expiration (in ms) for all metrics. [default: 5*24*3600 (5 days)]
 *   filterOffset   analyzers filter history data within some offset
 *                  (as a percentage of periodicity). [auto reloading, default: 0.01]
 *   trendingFactor the factor to calculate trending value via weighted moving
 *                  average algorithm. [auto reloading, default: 0.1]
 *
 * Webapp Options
 *   port           webapp port to listen. [default: 2016]
 *   workers        number of webapp workers to start. [default: 2]
 *   root           the root path to serve at. [default: null]
 *   auth           username and password for admin basic auth. [default: 'admin:admin']
 *
 * Cleaner Options
 *   interval       cleaning time interval (in secs). [default: 10*60 (10min)]
 *   threshold      one metric will be cleaned if the age it hitting bell
 *                  exceeds this threshold (in sec). [default: 2*24*3600 (2 day)]
 * Alerter Options
 *   host           alerter host to bind/connect. [default: '0.0.0.0']
 *   port           alerter port to listen/connect. [default: 2017]
 *   modules        module to send message (i.e. sms, email) for alerter
 */

{
  interval: 10,
  autoReload: true,
  logging: 'stderr',

  beanstalkd: {
    host: '0.0.0.0',
    port: 11300,
    tube: 'bell',
  },

  ssdb: {
    host: '0.0.0.0',
    port: 8888,
  },

  sqlite: {
    file: 'bell.db',
  },

  listener: {
    port: 2015,
    whitelist: ['*'],
    blacklist: ['statsd.*'],
  },

  analyzer: {
    workers: 4,
    strict: true,
  },

  webapp: {
    port: 2016,
    workers: 2,
    auth: {name: 'admin', pass: 'secret'},
  },

  cleaner: {
    interval: 10*60,
    threshold: 2*24*3600,
  },

  alerter: {
    port: 2017,
    modules: [],
  },
}
