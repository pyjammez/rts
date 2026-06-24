(function registerTurtleStrategy(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before TurtleStrategy.js');
  app.ai = app.ai || {};
  app.ai.strategies = app.ai.strategies || {};

  class TurtleStrategy {
    constructor(profile) {
      this.profile = profile;
      this.id = 'turtle';
    }

    choosePrimaryPlan(blackboard) {
      if (blackboard.get('threats', []).length > 0) return 'defend';
      if (blackboard.get('rangedUnits', []).length < this.profile.rampartDefenders) return 'rally';
      if (blackboard.waveCooldown <= 0 && blackboard.get('assaultUnits', []).length >= this.profile.attackReadiness) {
        return 'attack';
      }
      return 'rally';
    }
  }

  app.ai.strategies.TurtleStrategy = TurtleStrategy;
})(globalThis);
