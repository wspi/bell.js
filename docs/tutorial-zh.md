Node-Bell教程
=============

[Node-Bell](https://github.com/eleme/node-bell) 是一款实时的Metric异常系统，针对周期性时间序列，
例如我们饿了么每一时刻的下单量会呈现出日周期。

Metrics的来源可以有多种，Node-Bell接收数据的网络协议非常简单([link](https://github.com/eleme/node-bell/blob/master/faq.md#listener-net-protocol))
，repo中有几种语言的客户端实现示例。我司使用[statsd](https://github.com/etsy/statsd/)来收集和合计统计数据，主要是我们的服务接口的执行时间和调用次数
等信息，以下以statsd为例介绍node-bell的使用。

依赖
----

Node-Bell依赖如下:

- [nodejs](http://nodejs.org/) v0.11+ (运行平台，要求版本不低于0.11)
- [ssdb](https://github.com/ideawu/ssdb) (数据持久化存储)
- [beanstalkd](https://github.com/kr/beanstalkd) (job队列)

Statsd作为数据源
----------------

首先，在statsd的主机上安装node-bell (要保证statsd可以找到node-bell这个模块):

```bash
$ npm install node-bell -g
```

然后修改statsd的配置config.js，添加node-bell到backends:

```
{
, backends: ["node-bell/clients/statsd"]
}
```

另外几个可选的配置项见[clients/statsd.js](clients/statsd.js).

重启statsd, 使配置生效。

然后，安装ssdb和beanstalkd并启动这两个服务。

Node-Bell的安装与配置
---------------------

在将要运行node-bell的主机上，安装node-bell:

```bash
$ npm install node-bell -g
```

看下bell的命令行使用方法:

```bash
$ bell -h
```

生成一份默认配置configs.toml:

```bash
$ bell -s
```

然后编辑它，其中一些不是很明了的配置项：

- **patterns**

   patterns.js的路径, 默认的patterns.js见[lib/patterns.js](lib/patterns.js)

- **interval**

   所有metric产生新数据的间隔，比如statsd默认的是10s

- **ssdb.zset.expire**

   数据的过期时间，默认我们保存5天的数据

- **analyzer.strict**

   是否启用严格模式，即是否认为单点毛刺也算作异常 (默认开启)

- **analyzer.minSize**

   如果时间序列的数据点个数小于这个数值，bell会不再分析直到达到这个阈值

- **analyzer.filter.periodicity**

   所有metric的周期，默认是一天

- **analyzer.filter.offset**

   取历史数据时对同相位时刻的偏离对单个周期的比例 默认0.01

- **analyzer.trending.factor**

   采用wma算法计算趋势数据的因数，必须在0到1之间，该因数越大，趋势的时效性越强，默认0.1

- **cleaner.interval**

   bell清理死metric的时间间隔，默认10min

- **cleaner.threshold**

   当一个metric不再给bell发送数据的时长超过此阈值，bell就会清理掉这个metric 默认2天

其中一些配置项如果不明白，可以开issue，大部分默认配置都是我针对饿了么的情况设置的。

启动各项服务
------------

Node-Bell有五个服务:

1. **listener** 负责接收客户端发来的数据，并把数据点入队列
2. **analyzer** 负责从队列取数据并做异常分析，并把分析结果入库 (多进程工作)
3. **webapp** 负责metric的可视化  (多进程工作)
4. **alerter** 负责报警，内置hipchat报警module
5. **cleaner** 负责清理死metric

bell启动一个服务的方式为:

```bash
$ bell <service> [-c path/to/configs.toml]
```

其中，listener和analyzer是必要启动的服务:

```bash
$ bell analyzer -c configs.toml
$ bell listener -c configs.toml
```

至此，已经可以使用bell来监控你的网站的接口了，bell在饿了么的使用规模还非常小，
目前6k+的metric数量，5天大约13G的数据。

常见问题与建议
--------------

1. 建议ssdb的机器打开“最大同时打开文件数”为至少10k
2. ssdb的配置最好打开压缩，即设置compression为yes
3. 如果出现anlyzers处理能力不足：
   1. 增加 analyzer.workers （推荐）
   2. 如果增加workers还不能解决分析能力弱的问题，可以减小配置 `analyzer.filter.offset`
      这样会减少bell和db之间的IO大小，从而提高处理速度。
4. 如何观察我的bell是否有足够的分析能力？可以使用这个小工具：https://github.com/hit9/beanstats
