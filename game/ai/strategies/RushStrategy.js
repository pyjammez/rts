(function registerRushStrategy(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before RushStrategy.js');
  app.ai = app.ai || {};
  app.ai.strategies = app.ai.strategies || {};

  class RushStrategy {
    constructor(profile) {
      this.profile = profile;
      this.id = 'rush';
    }

    choosePrimaryPlan(blackboard) {
      if (blackboard.get('threats', []).length >= 3) return 'defend';
      if (blackboard.get('assaultUnits', []).length >= 1) return 'attack';
      return 'rally';
    }
  }

  app.ai.strategies.RushStrategy = RushStrategy;
})(globalThis);
