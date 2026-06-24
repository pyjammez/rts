(function registerDefensePlanner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before DefensePlanner.js');
  app.ai = app.ai || {};
  app.ai.planners = app.ai.planners || {};

  class DefensePlanner {
    createIntent(blackboard) {
      const threats = blackboard.get('threats', []);
      if (threats.length === 0) return null;
      return {
        type: 'defend',
        priority: 100 + threats.length * 10,
        threats
      };
    }
  }

  app.ai.planners.DefensePlanner = DefensePlanner;
})(globalThis);
