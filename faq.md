Node-bell Q&A
==============

Scale & Performace?
--------------------

I didnt do any benchmarks. The status we eleme using it is: 

```
metrics amount: 3k+
datastore size: 40G+
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


"Too many open files" in my ssdb log
------------------------------------

You need to set your linux's `max open files` to at least 10k, 
see [how to](http://stackoverflow.com/questions/34588/how-do-i-change-the-number-of-open-files-limit-in-linux).


Why do you use ssdb (not redis, or not sql-based-db..) ?
--------------------------------------------------------

I need a disk-based data structure server. No, redis is limited to the memory capacity.

How to run webapp with multiple workers
----------------------------------------

For example, using [cluster-master](https://github.com/isaacs/cluster-master),
touch a file, i.e `webapp-master.js`:

```js
var clusterMaster = require('cluster-master');

clusterMaster({
  exec: '/usr/bin/bell',  // bell bin path
  size: 5,  // workers count
  args: ['webapp', '-c', './configs.toml', '-l', '5']
})
```

and then run it:

```bash
$ node --harmony-generators webapp-master.js
```

