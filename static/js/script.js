(function(){
  // cubism context with default settings
  var context = cubism.context()
  .serverDelay(0)
  .clientDelay(0)
  .size(3 * 60 * 60 / 10)  // 3 hours / 10s
  ;

  // parameters from bell backend
  var pattern;
  var sort;
  var limit;
  var type;
  var past;
  var stop;
  var dashboard;

  // the seconds past
  var pastSecs;

  // document elements
  var chartUntilSpan = document.getElementById('chart-until');
  var chartTimeStepSpan = document.getElementById('chart-timestep');
  var loader = document.getElementById('loader');

  // entry function
  this.initBell = function(options) {
    pattern = options.pattern;
    sort = options.sort;
    limit = options.limit;
    type = options.type;
    past = options.past;
    stop = options.stop;
    dashboard = options.dashboard;

    pastSecs = timespan2secs(past);

    // reset context
    context
    .serverDelay(pastSecs * 1e3)  // past
    .step(step * 1e3)
    ;

    if (dashboard) {
      updateTrendingAverage();
    }

    // stop update
    if (stop === 1) {
      context.stop();
    }

    plot();

    if (stop === 0) {
      if (dashboard) {
        setInterval(updateTrendingAverage, 10 * 60 * 1e3);  // 1min;
      }
      setInterval(function(){
        d3.select('#chart').selectAll('*').remove();
        plot();
      }, 10 * 60 * 1e3);  // replot every 10 min
    }
  };

  // GET' request an url, and call callback with responsed JSON data
  //
  // param {String} url
  // param {Function} callback  // callback: @param {Object} data
  //
  function request(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
        var data = JSON.parse(xmlhttp.responseText);
        callback(data);
      }
    };
  }

  // Metrics source
  //
  // @param {String} name
  // @return {Object}  // context.metric
  //
  function makeMetric(name) {
    return context.metric(function(start, stop, step, callback){
      // cast to timestamp from date
      start = (+start - pastSecs) / 1e3;
      stop = (+stop - pastSecs) / 1e3;
      step = +step / 1e3;

      // api url to fetch metrics
      var url = [api, 'datapoints'].join('/') + '?' + buildUrlParams({
        name: name,
        type: type,
        start: start,
        stop: stop
      });
      var values = [], i = 0;

      // request data and call callback with values
      //
      // data schema: {times: {Array}, vals: {Array}}
      //
      request(url, function(data){
        // the timestamps from statsd DONT have exactly steps `10`
        while (start < stop) {
          while (start < data.times[i]) {
            start += step;
            values.push(start > data.times[i] ? data.vals[i] : 0);
          }
          values.push(data.vals[i++]);
          start += step;
        }
        callback(null, values);

        // update title
        updateTitle(name, data.trend);
      });

      // udpate time range div
      chartUntilSpan.innerHTML = secs2str(stop);
    }, name);
  }

  // make a horizon chart (hmm, horizon chart is amazing..)
  function horizon() {
    var hrz = context.horizon();

    if (type === 'm') {
      return hrz
      .extent([-2, 2])
      .mode('mirror')
      .colors(['#dd1144', 'teal', 'teal', '#dd1144'])
      ;
    } else if (type === 'v') {
      return hrz;
    }
  }

  // update title <a>
  function updateTitle(name, trend) {
    document.getElementById(sprintf('title-{0}', name))
      .className = Math.abs(trend) >= 1? 'anomalous' : 'normal';
    document.getElementById(sprintf('title-trend-{0}', name))
      .innerHTML = trend > 0? '↑' : '↓';
  }

  // update trending average
  function updateTrendingAverage() {
    var url = [api, 'tavg'].join('/') + '?' + buildUrlParams({dashboard: dashboard});
    request(url, function(data) {
      var boxCls = "alert alert-dismissible ";
      var status;

      if (Math.abs(data.data) < 0.25) {
        boxCls += "alert-success";
        status = 'OK';
      } else if (Math.abs(data.data) > 0.5 && Math.abs(data.data) < 0.75) {
        boxCls += "alert-warning";
        status = 'WARNING';
      } else {
        boxCls += "alert-danger";
        status = 'CRITICAL';
      }

      document.getElementById('tavg-box').className = boxCls;
      document.getElementById('tavg-status').innerHTML = status;
      document.getElementById('tavg-data').innerHTML = data.data.toFixed(2);
      document.getElementById('tavg-time').innerHTML = secs2str(data.time);
    });
  }

  // plot
  function plot () {
    var params = {limit: limit, sort: sort};

    if (dashboard) {
      params.dashboard = dashboard;
    } else {
      params.pattern = pattern;
    }

    var url = [api, 'names'].join('/') + '?'
      + buildUrlParams(params);

    request(url, function(res){
      // hide loader
      loader.style.display = 'none';

      var data = [];
      var stat = {};  // {name: trend}
      for (var i = 0; i < res.length; i++) {
        data.push(makeMetric(res[i][0]));
        stat[res[i][0]] = res[i][1];
      }

      d3.select('#chart').call(function(div) {
        div.append('div')
        .attr('class', 'axis')
        .call(context.axis().orient('top'));

        div.selectAll('.horizon')
        .data(data)
        .enter().append('div')
        .attr('class', 'horizon')
        .call(horizon());

        div.append('div')
        .attr('class', 'rule')
        .call(context.rule());
      });

      d3.selectAll('.title')
      .html(function(d){
        var name = d.toString();
        var params = {
          pattern: name,
          sort: sort,
          limit: 1,
          type: type,
          past: past
        };
        var trend = stat[name];
        // arrow
        var arr = trend > 0? '↑' : '↓';
        // color
        var cls = Math.abs(trend) >= 1? 'anomalous' : 'normal';
        // link
        var url = root + '?' + buildUrlParams(params);

        return sprintf(
          '<a id="title-{3}" class="{0}" href="{1}">' +
          '<span id="title-trend-{3}">{2} </span> {3}</a>',
          cls, url, arr, name
        );
      });
    });
  }

  // cubism context rule
  context.on('focus', function(i) {
    offset = document.getElementById("chart").offsetWidth - i;
    d3.selectAll('.value')
    .style('right', i === null ? null : offset + 'px');
  });
})(this);


// build url parameters
//
// example
//
//   buildUrlParams({'name': 'mike', 'age': 3})
//   // => 'name=mike&age=3'
//
// @param {String} dict
// @return {String}
//
function buildUrlParams(dict) {
  var list = [];
  for (var key in dict) {
    list.push([key, '=', dict[key]].join(''));
  }
  return list.join('&');
}


// convert string format timespan to seconds
//
// example:
//
//   timespan2secs('1d')
//   // => 86400
//   timespan2secs('1h')
//   // => 3600
//   timespan2secs('1h2m')
//   // => 3720
//
// @param {String} timespan
// @return {Number}
//
function timespan2secs(timespan) {
  var map = {
    's': 1,
    'm': 60,
    'h': 60 * 60,
    'd': 24 * 60 * 60
  };

  var secs = 0;

  while (timespan.length > 0) {
    for (var i = 0; i < timespan.length; i++) {
      var ch = timespan[i];
      var measure = map[ch];

      if (!isNaN(measure)) {
        var count = +timespan.slice(0, i);
        secs += count * measure;
        timespan = timespan.slice(i + 1);
        break;
      }
    }

    if (i === timespan.length) {
      return secs;
    }
  }

  return secs;
}

// convert unix timestamp to readable string format
//
// @param {Number} secs
// @return {String}
//
function secs2str(secs) {
  var date = new Date(secs * 1000);
  // getMonth() return 0~11 numbers
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  // normalize
  month = ('00' + month).slice(-2);
  day = ('00' + day).slice(-2);
  hours = ('00' + hours).slice(-2);
  minutes = ('00' + minutes).slice(-2);
  seconds = ('00' + seconds).slice(-2);

  return [month, day].join('/') + ' ' + [hours, minutes, seconds].join(':');
}

// help to sprintf a string
function sprintf() {
  var fmt = [].slice.apply(arguments, [0, 1])[0];
  var args = [].slice.apply(arguments, [1]);
  return fmt.replace(/{(\d+)}/g, function(match, idx) {
    return typeof args[idx] != 'undefined'? args[idx] : match;
  });
}
