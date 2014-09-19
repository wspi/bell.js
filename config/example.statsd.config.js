/**
 * Example configuration for statsd to work with node-bell.
 *
 * Just append 'node-bell' to your backends, and then set configuration
 * items, all avaliable config items:
 *
 *   bellHost, default: '0.0.0.0'
 *   bellPort, default: 8889
 *   bellIgnores, default: ['statsd.*']
 *   bellTimerDataFields, default: ['mean', 'count_ps']
 */

{
  port: 8125
, backends: ['node-bell']
, bellHost: '0.0.0.0'
, bellPort: 8889
}
