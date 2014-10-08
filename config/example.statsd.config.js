/**
 * Example configuration for statsd to work with node-bell.
 *
 * Just append 'node-bell/upstreams/statsd' to statsd backends, set config items, and
 * then restart statsd. Avaliable config items:
 *
 *   bellHost, default: '0.0.0.0'
 *   bellPort, default: 8889
 *   bellIgnores, default: ['statsd.*']
 *   bellTimerDataFields, default: ['mean_90', 'count_ps']
 */

{
  port: 8125
, backends: ['node-bell/upstreams/statsd']
, bellHost: '0.0.0.0'
, bellPort: 8889
}
