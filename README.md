Bell.js
=======

![snap](snap.png)

Introduction
------------

Bell.js is a real-time anomalies(outliers) detection system for periodic time series, built
to be able to monitor a large quantity of metrics. It collects metrics form clients
like [statsd](https://github.com/etsy/statsd), analyzes them with the [3-sigma](docs/design-notes.md),
once enough anomalies were found in a short time it alerts us via sms/hipchat etc.

We [eleme](github.com/eleme) use it to monitor our website/rpc interfaces, including
api called frequency, api response time(time cost per call) and exceptions count. Our
services send these statistics to statsd, statsd aggregates them every 10 seconds and
broadcasts the results to its backends including bell, bell analyzes current stats with
history data, calculates the trending, and alerts us if the trending behaves anomalous.

For example, we have an api named 'get_name', this api's response time is reported to bell
from statsd every 10 seconds:

```
50, 40, 48, 61, 65, 57, 48, 40, .., 299
```

Bell will catch the datapoint `299`, and report it as an anomaly.

Why don't we just set a fixed threshold instead (i.e. 200ms)? This may also work but we may
have a lot of apis to monitor, some are fast (~10ms) and some are slow (~1000ms), it is hard
to set a good threshold for each one, and also hard to set an appropriate global threshold for all.
Bell sloves this via [3-sigma](docs/design-notes.md), it gives dynamic thresholds for each metric,
rely on history dataponts. We don't have to set a threshold for each metric, bell will find the
"thresholds" automatically.

Requirments
-----------

- nodejs (>= 0.12) or iojs (>=1.1) *(generator feature required)*
- beanstalkd (https://github.com/kr/beanstalkd) (we are using version 1.9)
- ssdb (https://github.com/ideawu/ssdb) (we are using version 1.6.8.8)

Installation
------------

Install bell.js via npm:

```bash
$ npm install bell.js -g
```

After the installation, there is a command named `bell` avaliable, to start a service
(i.e. analyzer): `bell analyzer -c configs.toml`:

```
$ bell <service-name> -c <path-to-config-file>
```

Quick Start
-----------

Here is a simple quickstart for the case with statsd, make sure
[statsd](https://github.com/etsy/statsd) is ready to work.

1. First, generate a sample config file via `bell -s`.
2. Open the sample config file (in language toml) and edit it.
3. Start ssdb, beanstalkd.
4. Start bell services (analyzer, listener, webapp, alerter, cleaner).
5. Add `'bell.js/clients/statsd'` to statsd's backends and start statsd.

Configs
-------

Default config file is at [config/configs.toml](config/configs.toml).

Services
--------

Bell has 5 "services", they are started with different entries, running in separate
processes:

1. **listener**: Receive incoming stats from clients(like statsd) over TCP, pack to jobs
   and send them to job queue.
2. **analyzer(s)**: Get jobs from queue, analyze current datapoint via [3-sigma rule](docs/design-notes.md).
   Store analyzation result and all statistics in ssdb. Bell is scalable, we can start multiple
   analyzer instances to process lots of metrics.
3. **webapp**: Visualize metrics and analyzation on the web, default prot: 8989.
4. **alerter**: Alert once enough anomalies were detected.
5. **cleaner**: Check the last time of a metric hitting bell every certain interval, if
   the age exceeds the threshold, clean it.

More Specific Topics
--------------------

- [Design Notes](docs/design-notes.md)
- [Custom Client](docs/topics.md#custom-client)
- [Custom Alerter](docs/topics.md#custom-alerter)
- [Analyzers Scalability](docs/topics.md#analyzers-scalability)
- [Cross Machines Analyzers](docs/topics.md#cross-machines-analyzers)
- [Listener Net Protocol](docs/topics.md#listener-net-protocol)
- [Week Analyzation Ability](docs/topics.md#week-analyzation-ability)


License
-------

MIT Copyright (c) 2014 - 2015 Eleme, Inc.
