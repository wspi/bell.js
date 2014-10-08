Node-Bell
=========

Node-Bell is a real-time anomalies detection for periodic time series, 
built to be able to monitor thousands of metrics. It collects metrics
from clients like [statsd](https://github.com/etsy/statsd), analyzes
them with the [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)
and visualizes results on the web. Once enough anomalies were found in a short time, 
it alerts you via alerters like hipchat.

![node-bell snapshot](snap.png)

Latest version: v0.3.5

We([Eleme](http://ele.me)) have [blogged](http://eleme.io/blog/2014/metrics-monitor/) 
how we created it.

Requirements
------------

- [node.js](http://nodejs.org/) 0.11+  (bell is written in nodejs)
- [ssdb](https://github.com/ideawu/ssdb) 1.6.8.8+ (datastore)
- [beanstalkd](https://github.com/kr/beanstalkd) (job queue between listeners and analyzes)

Installation
------------

```bash
$ npm install node-bell -g
```

to add `node-bell` to statsd's backends, edit statsd's config.js ([example](config/example.statsd.config.js)):

```js
{
, backends: ["node-bell/upstreams/statsd"]
}
```

Getting Start
-------------

1. Start ssdb & beanstalkd & clients.
2. Generate sample config and edit it, default: [config/configs.toml](config/configs.toml):

   ```bash
   $ bell -s 
   $ mv sample.configs.toml configs.toml
   $ vi configs.toml
   ```
3. Start services: listener, analyzers, webapp, alerter, cleaner

   ```bash
   $ bell analyzer -c configs.toml
   $ bell listener -c configs.toml
   $ bell webapp -c configs.toml
   $ bell alerter -c configs.toml
   $ bell cleaner -c configs.toml
   ```

Services
--------

1. **listener** 

   Receive incoming metrics from clients over tcp, then put them to job queue (beanstalkd), default port: 8889.

2. **analyzer(s)**

   Get jobs from queue, analyze if current datapoint is an anomaly or not via 3-sigma rule. The results and all metrics
   are stored in ssdb. We can start multiple analyzer processes, see 
   [analyzer-cluster](faq.md#analyzers-cluster).

3. **webapp**

   Visualize analyzation results and metrics on web, default port: 8989.

4. **alerter**

   Alert once enough anomalies were detected. It receives anomalous datapoints from all analyzers over tcp, 
   default port: 8789

5. **cleaner**

   Check the last time of a metric hitting node-bell every certain time interval, if the age exceeds
   the threshold, clean it.

Questions
---------

Search [faq.md](faq.md) or open an issue.

- [Analyzers Cluster](faq.md#analyzers-cluster)
- [Custom Alerters](faq.md#custom-alerters)

Inside
------

1. **algorithm**

   Node-bell use the [3-sigma](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule) rule(similar to z-score) 
   to detect if a datapoint is an anomaly:
   > states that nearly all values(99.7%) lie within 3 standard deviations of the mean in a normal distribution.

2. **storage schema**

   Metrics are stored in ssdb, using zset, and the schema is:

   ```
   key       |  score
   ------------------------------------------------
   timestamp | value:anomalous multiples:timestamp
   ```

3. **data flow**

   ```
   [clients]->[listener]->[beanstalkd]
                              |
                              v
               --------> [analyzers] ------> [alerter]
               |              |
       history |         save v    visualize
               ------------ [ssdb] --------> [webapp]
   ```

Changes
-------- 

See [changes.md](changes.md).

License
--------

MIT Copyright (c) 2014 Eleme, Inc.
