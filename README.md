Node-Bell
=========

![build](https://travis-ci.org/eleme/node-bell.svg)

Latest version: v0.5.3

![snap](snap.png)

Node-Bell is a real-time anomalies detection system for periodic time series, built to be
able to monitor a large quantity of metrics. It collects metrics from clients like [statsd](https://github.com/etsy/statsd),
analyzes them with the [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)
and visualizes results on the web. Once enough anomalies were found in a short time, it alerts
you via alerters like hipchat.

Use Case
--------

We ([Eleme](http://ele.me)) use node-bell to monitor our website interfaces, including:

   - interface called frequency
   - interface response time
   - exceptions count
   - ...

Our services and applications send these statistics to [statsd](https://github.com/etsy/statsd),
then statsd sends aggregates to node-bell, node-bell analyzes the current stats
with history data, calculated the trending, and alerts us if the current trending behaves
anomalous.

We don't have to set a threshold for each metric, that would be tired, node-bell will find the "thresholds" automatically.

Installation
------------

1. Install nodejs (0.11.9+), [ssdb](https://github.com/ideawu/ssdb) and [beanstalkd](https://github.com/kr/beanstalkd)
2. Install node-bell via npm

   ```bash
   $ npm install node-bell -g
   ```
3. Add `'node-bell/clients/statsd'` to statsd's backends.
4. Generate default configuration and edit it.

   ```bash
   $ bell -s
   ```
5. Start ssdb, beanstalkd, statsd and node-bell services

Usage
-----

To start a node-bell service:

```bash
$ bell <service-name> -c <path-to-config-file>
```

Configuration
-------------

**The default configuration is at [config/configs.toml](config/configs.toml)**.

Services
---------

Node-Bell has 5 "services", they do different jobs:

1. **listener**

   Receive incoming stats from clients(like statsd) over TCP, pack to jobs and send them to job queue.

2. **analyzer(s)**

   Get jobs from queue, analyze current datapoint via [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule).
   Store analyzation result and all statistics in ssdb. Node-Bell is scalable, we can start multiple analyzer instances to process
   lots of metrics.

3. **webapp**

   Visualize metrics and analyzation on the web, default prot: 8989.

4. **alerter**

   Alert once enough anomalies were detected.

5. **cleaner**

   Check the last time of a metric hitting node-bell every certain interval, if the age exceeds the threshold, clean it.

More Specific Topics
--------------------

- [Custom Client](docs/topics.md#custom-client)
- [Custom Alerter](docs/topics.md#custom-alerter)
- [Analyzers Scalability](docs/topics.md#analyzers-scalability)
- [Cross Machines Analyzers](docs/topics.md#cross-machines-analyzers)
- [Listener Net Protocol](docs/topics.md#listener-net-protocol)
- [Week Analyzation Ability](docs/topics.md#week-analyzation-ability)
- [SSDB FAQ](docs/topics.md#ssdb-faq)

Insight
-------

1. **algorithm**

   Node-Bell uses the `3-sigma` rule (similar to z-score) to detect if a datapoint is an anomaly (or an outlier):

   > States that nearly all values(99.7%) lie within 3 standard deviations of the mean in a normal distribution.

2. **storage schema**

   Metrics are stored in ssdb using zset, the schema is:

   ```
   key       |  score
   ------------------------------------------------
   timestamp | value:anomalous severity:timestamp
   ```

3. **full data flow**

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
-------

[changes.md](changes.md)

License
-------

MIT Copyright (c) 2014 Eleme, Inc.
