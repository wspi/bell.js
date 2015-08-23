Bell.js
=======

![snap](snap.png)

Introduction
------------

Bell.js is a real-time anomalies detection system for periodic time series, built
to be able to monitor a large quantity of metrics. It collects metrics form clients
like [statsd](https://github.com/etsy/statsd), analyzes them with the [3-sigma](docs/design-notes.md),
once enough anomalies were found in a short time it alerts us via sms/hipchat etc.

We [eleme](github.com/eleme) use it to monitor our website/rpc interfaces, including
called frequency, response time(time cost per call) and exceptions count. Our services
send these statistics to statsd, statsd aggregates them every 10 seconds and broadcasts
the results to its backends including bell, bell analyzes current stats with history data,
calculates the trending, and alerts us if the trending behaves anomalous.

For example, we have an api named 'get_name', this api's response time is reported to bell
from statsd every 10 seconds:

```
50, 40, 48, 61, 65, 57, 48, 40, .., 299
```

bell will detect the `299` is an anomaly, or an outlier.

But why don't we just set a fixed threshold(i.e. 200) for response time, why do we need
bell to analyze history data via 3-sigma balabala..? This also works but the problem is how
large/small the threshold should be, and it is hard to set good thresholds one by one
for a lot of metrics.
