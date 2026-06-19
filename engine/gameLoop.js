export default class GameLoop {
  constructor(updateFn, fixedDt = 1000 / 60) {
    this.updateFn = updateFn;
    this.fixedDt = fixedDt;
    this.accum = 0;
    this.last = performance.now();
    this.rafId = null;
  }

  start() {
    this.last = performance.now();
    const tick = (t) => {
      const dt = t - this.last;
      this.last = t;
      this.accum += dt;
      while (this.accum >= this.fixedDt) {
        this.updateFn(this.fixedDt);
        this.accum -= this.fixedDt;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
