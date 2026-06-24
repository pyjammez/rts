(function registerWaveDirector(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before WaveDirector.js');
  app.ai = app.ai || {};
  app.ai.td = app.ai.td || {};

  class WaveDirector {
    constructor({ scaler, spawner, interval = 20 }) {
      this.scaler = scaler;
      this.spawner = spawner;
      this.interval = interval;
      this.cooldown = interval;
      this.waveIndex = 0;
    }

    update(deltaTime) {
      this.cooldown -= Math.max(0, Number(deltaTime) || 0);
      if (this.cooldown > 0) return false;
      this.cooldown = this.interval;
      const budget = this.scaler.budgetForWave(this.waveIndex);
      const spawned = this.spawner.spawnWave({ waveIndex: this.waveIndex, budget, units: [] });
      this.waveIndex++;
      return spawned;
    }
  }

  app.ai.td.WaveDirector = WaveDirector;
})(globalThis);
