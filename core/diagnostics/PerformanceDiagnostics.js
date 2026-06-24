(function registerPerformanceDiagnostics(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.diagnostics = app.diagnostics || {};

  const counters = new Map();
  const timings = new Map();

  function increment(name, amount = 1) {
    counters.set(name, (counters.get(name) || 0) + amount);
    return counters.get(name);
  }

  function recordTiming(name, milliseconds) {
    const value = Math.max(0, Number(milliseconds) || 0);
    const current = timings.get(name) || { count: 0, total: 0, max: 0 };
    current.count += 1;
    current.total += value;
    current.max = Math.max(current.max, value);
    timings.set(name, current);
    return { ...current, average: current.total / current.count };
  }

  function measure(name, fn) {
    const now = root.performance?.now ? () => root.performance.now() : () => Date.now();
    const start = now();
    try {
      return fn();
    } finally {
      recordTiming(name, now() - start);
    }
  }

  function reset() {
    counters.clear();
    timings.clear();
  }

  function describe() {
    const timingSummary = {};
    for (const [name, timing] of timings) {
      timingSummary[name] = {
        count: timing.count,
        total: timing.total,
        max: timing.max,
        average: timing.count ? timing.total / timing.count : 0
      };
    }
    return {
      schemaVersion: 1,
      counters: Object.fromEntries(counters),
      timings: timingSummary
    };
  }

  app.diagnostics.performance = Object.freeze({
    increment,
    recordTiming,
    measure,
    reset,
    describe
  });
  app.diagnostics.register?.('performance', describe);
})(globalThis);
