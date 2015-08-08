{
  timers: {
    title: "Timers",
    dashboards: {
      count_ps: {
        title: "Our timers",
        patterns: ["timer.count_ps.*"]
      },
      mean_90: {
        patterns: ["timer.mean_90.*"]
      }
    }
  },
  counters: {
    title: "Our counters",
    dashboards: {
      counters: {
        patterns: ["counter.*"]
      }
    }
  }
}
