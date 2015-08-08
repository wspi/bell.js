{
  timers: {
    count_ps: {
      title: "调用量",
      patterns: ["timer.count_ps.*"]
    },
    mean_90: {
      patterns: ["timer.mean_90.*"]
    }
  },
  counters: {
    counters: {
      patterns: ["counter.*"]
    }
  }
}
