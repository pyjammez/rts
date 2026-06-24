(function registerDifficultyScaler(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before DifficultyScaler.js');
  app.ai = app.ai || {};
  app.ai.td = app.ai.td || {};

  class DifficultyScaler {
    constructor({ baseBudget = 50, growth = 1.18 } = {}) {
      this.baseBudget = baseBudget;
      this.growth = growth;
    }

    budgetForWave(waveIndex) {
      return Math.round(this.baseBudget * Math.pow(this.growth, Math.max(0, waveIndex)));
    }
  }

  app.ai.td.DifficultyScaler = DifficultyScaler;
})(globalThis);
