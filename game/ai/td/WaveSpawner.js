(function registerWaveSpawner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before WaveSpawner.js');
  app.ai = app.ai || {};
  app.ai.td = app.ai.td || {};

  class WaveSpawner {
    constructor({ commandBus }) {
      this.commandBus = commandBus;
    }

    spawnWave(wave) {
      // Future connection point: add a world.spawn command and enqueue it here.
      // This keeps TD spawning replayable instead of mutating units directly.
      if (!this.commandBus?.enqueue || !this.commandBus?.types?.SPAWN_UNIT) return false;
      for (const entry of wave.units || []) {
        this.commandBus.enqueue({
          type: this.commandBus.types.SPAWN_UNIT,
          playerId: 'td-director',
          payload: entry
        });
      }
      return true;
    }
  }

  app.ai.td.WaveSpawner = WaveSpawner;
})(globalThis);
