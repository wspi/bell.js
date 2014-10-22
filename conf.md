Node-Bell Configuration Manual
-------------------------------

- **patterns**

   string, patterns file path, use `""` to use default:

   ```js
   {
     timer: {
       count_ps: 'timer.count_ps.*',
       mean_90: 'timer.mean_90.*'
     },
     counter: {
       rate: 'counter.*'
     }
   }
   ```

   schema:

   ```js
   {
     item: {
       subItem: pattern
     }
   }
   ```

- **beanstalkd.host**

   string, beanstalkd server host, default: `"0.0.0.0"`

- **beanstalkd.port**

   integer, beanstalkd server port, default: `11300`

- **beanstalkd.tube**

   string, beanstalk tube to use, default: `"bell"`

- **ssdb.host**

   string, ssdb server host, default: `"0.0.0.0"`

- **ssdb.port**

   integer, ssdb server port, default: `8888`

- **ssdb.prefix**

   string, the prefix for zset/hash.., default: `"bell."`

- **ssdb.zset.expire**

   integer, datapoints lifetime(in seconds), default: `432000` (5 day)

- **listener.host**

   string, listener host, default: `"0.0.0.0"`

- **listener.port**

   integer, listener port to listen, default: `8889`

- **analyzer.strict**

   boolean, if use strict mode in analyzation, default: `true`

- **analyzer.minSize**

   integer, start to analyze only if datapoints count is bigger than this value, default: `50`

- **analyzer.filter.offset**

   float, filter history datapoints within offset:

   ```js
   current_time - history_time < abs(offset * periodicity)
   ```

   default: 0.01

- **analyzer.filter.periodicity**

   integer, periodicity for all metrics (in seconds), default: `86400` (1 day)

- **analyzer.trending.factor**

   float, the factor to calculate trending value via weighted moving average algorithm, default: `0.1`

- **webapp.port**

   integer, the port for webapp to listen, default: `8989`

- **webapp.root**

   string, if your webapp is going to be served like `domain/sub_dir`, set this to `sub_dir`, default: `""`

- **webapp.syncInterval**

   integer, time interval to sync trendings from ssdb (in seconds), default: `10` (10s)

- **cleaner.interval**
