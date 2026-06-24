(function registerWaveTemplates(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before waveTemplates.js');
  app.ai = app.ai || {};
  app.ai.td = app.ai.td || {};

  app.ai.td.waveTemplates = Object.freeze({
    basic: Object.freeze([
      Object.freeze({ unitType: 'soldier', count: 4, budget: 40 }),
      Object.freeze({ unitType: 'scout', count: 2, budget: 30 })
    ])
  });
})(globalThis);
