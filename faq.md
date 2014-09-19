Node-bell Q&A
==============

Scale & Performace?
--------------------

I didnt do any benchmarks. The status we eleme using it is: 

```
metrics amount: 4k+
datastore size: 93G+ (5days)
analyzers workers: 24
number of cpu: 24
machine load average (only node-bell): 6.01, 7.86, 8.88
```

How many analyzers should I run?
---------------------------------

The more metrics, the more analyzers should be up. 

If the analyzation cannot catch up with the incomming mertics, we should increase analyzer instances.
[Beanstats](https://github.com/hit9/beanstats) is a simple console tool to watch a single beanstalk tube
, and show you how fast jobs are going in and out of the queue.


What dose the metrics prefix mean?
----------------------------------

- **counter**: count average
- **timer.mean**: time cost average
- **timer.count_ps**: count per second or frequency

For instances:

- If timer.count_ps gets bigger, that means high-traffic.
- If timer.mean gets bigger, that means timeout.

"Too many open files" in my ssdb log
------------------------------------

You need to set your linux's `max open files` to at least 10k, 
see [how to](http://stackoverflow.com/questions/34588/how-do-i-change-the-number-of-open-files-limit-in-linux).


Why do you use ssdb (not redis, or not sql-based-db..) ?
--------------------------------------------------------

I need a disk-based data structure server. No, redis is limited to the memory capacity.


Analyzers Cluster ?
-------------------

For example, using [cluster-master](https://github.com/isaacs/cluster-master),
touch a file, i.e `analyzer-cluster.js`:

```js
var clusterMaster = require('cluster-master');

clusterMaster({
  exec: '/usr/bin/bell',  // bell bin path
  size: 5,  // workers count
  args: ['analyzer', '-c', './configs.toml']
})
```

and then run it:

```bash
$ node --harmony-generators analyzer-cluster.js
```

My ssdb makes cpu load 100%!
----------------------------

Compact leveldb maybe helpful: stop analyzers, then run this command in ssdb-cli: `compact`.
