bell.js
=======

*Node-Bell is Renamed to bell.js now !*

![nodei](https://nodei.co/npm/bell.js.png?downloads=true&downloadRank=true)

![build](https://travis-ci.org/eleme/bell.js.svg)

![snap](snap.png)

bell.js is a real-time anomalies detection system for periodic time series, built to be
able to monitor a large quantity of metrics. It collects metrics from clients like [statsd](https://github.com/etsy/statsd),
analyzes them with the [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)
and visualizes results on the web. Once enough anomalies were found in a short time, it alerts
you via alerters like hipchat.

Use Case
--------

We ([Eleme](http://ele.me)) use it to monitor our website interfaces, including:

   - interface called frequency
   - interface response time
   - exceptions count
   - ...

Our services and applications send these statistics to [statsd](https://github.com/etsy/statsd),
then statsd sends aggregations to bell, bell analyzes the current stats
with history data, calculates the trending, and alerts us if the current trending behaves
anomalous.

We don't have to set a threshold for each metric, that would be tired, bell will find the "thresholds" automatically.

Installation
------------

1. Install nodejs (>=0.12) or iojs (>=1.1), [ssdb](https://github.com/ideawu/ssdb) and [beanstalkd](https://github.com/kr/beanstalkd)
2. Install bell via npm

   ```bash
   $ npm install bell.js -g
   ```
3. Add `'bell.js/clients/statsd'` to statsd's backends.
4. Generate default configuration and edit it.

   ```bash
   $ bell -s
   ```
5. Start ssdb, beanstalkd, statsd and bell services

*NOTE: We are using bell with beanstalkd 1.9 and ssdb 1.6.8.8*

Usage
-----

To start a bell service:

```bash
$ bell <service-name> -c <path-to-config-file>
```

Configuration
-------------

**The default configuration is at [config/configs.toml](config/configs.toml)**.

Services
---------

Bell has 5 "services", they do different jobs:

1. **listener**

   Receive incoming stats from clients(like statsd) over TCP, pack to jobs and send them to job queue.

2. **analyzer(s)**

   Get jobs from queue, analyze current datapoint via [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule).
   Store analyzation result and all statistics in ssdb. Bell is scalable, we can start multiple analyzer instances to process
   lots of metrics.

3. **webapp**

   Visualize metrics and analyzation on the web, default prot: 8989.

4. **alerter**

   Alert once enough anomalies were detected.

5. **cleaner**

   Check the last time of a metric hitting bell every certain interval, if the age exceeds the threshold, clean it.

More Specific Topics
--------------------

- [Design Notes](docs/design-notes.md)
- [Custom Client](docs/topics.md#custom-client)
- [Custom Alerter](docs/topics.md#custom-alerter)
- [Analyzers Scalability](docs/topics.md#analyzers-scalability)
- [Cross Machines Analyzers](docs/topics.md#cross-machines-analyzers)
- [Listener Net Protocol](docs/topics.md#listener-net-protocol)
- [Week Analyzation Ability](docs/topics.md#week-analyzation-ability)
- [SSDB FAQ](docs/topics.md#ssdb-faq)

Changes
-------

[changes.md](changes.md)

License
-------

MIT Copyright (c) 2015 Eleme, Inc.
