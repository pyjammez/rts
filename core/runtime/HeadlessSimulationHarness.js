(function registerHeadlessSimulationHarness(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.testing = app.testing || {};
  app.simulation = app.simulation || {};

  class HeadlessSimulationHarness {
    constructor({
      runtime = null,
      context = null,
      fixedDt = 1 / 30
    } = {}) {
      this.runtime = runtime || app.runtime || new app.GameRuntime();
      this.context = context || app.simulation?.createContext?.() || {};
      this.fixedDt = fixedDt;
      this.commands = [];
      this.results = [];
      this.runtime.setContext?.({ simulation: this.context, headless: true });
    }

    enqueue(command) {
      this.commands.push(command);
      return command;
    }

    flushCommands() {
      if (!app.commands?.enqueue) return;
      while (this.commands.length > 0) {
        app.commands.enqueue(this.commands.shift());
      }
    }

    step(dt = this.fixedDt) {
      this.flushCommands();
      this.runtime.update(dt);
      const snapshot = app.runtime?.matchSnapshots?.captureCurrent?.() || null;
      this.results.push({
        frame: this.runtime.frame,
        elapsed: this.runtime.elapsed,
        snapshot
      });
      return this.results[this.results.length - 1];
    }

    runFrames(frameCount, dt = this.fixedDt) {
      const count = Math.max(0, Math.floor(Number(frameCount) || 0));
      for (let index = 0; index < count; index++) this.step(dt);
      return this.results;
    }

    describe() {
      return {
        schemaVersion: 1,
        frame: this.runtime.frame,
        elapsed: this.runtime.elapsed,
        fixedDt: this.fixedDt,
        queuedCommands: this.commands.length,
        resultCount: this.results.length
      };
    }
  }

  function createHeadlessSimulationHarness(options = {}) {
    return new HeadlessSimulationHarness(options);
  }

  app.testing.HeadlessSimulationHarness = HeadlessSimulationHarness;
  app.testing.createHeadlessSimulationHarness = createHeadlessSimulationHarness;
})(globalThis);
