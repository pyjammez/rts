(function registerBalancedStrategy(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before BalancedStrategy.js');
  app.ai = app.ai || {};
  app.ai.strategies = app.ai.strategies || {};

  class BalancedStrategy {
    constructor(profile) {
      this.profile = profile;
      this.id = 'balanced';
    }

    choosePrimaryPlan(blackboard) {
      if (blackboard.get('threats', []).length > 0) return 'defend';
      const readyCount = Math.min(this.profile.attackReadiness, blackboard.get('friendlyUnits', []).length);
      if (blackboard.waveCooldown <= 0 && blackboard.get('assaultUnits', []).length >= readyCount) return 'attack';
      if (blackboard.get('idleCombatUnits', []).length > 0 && blackboard.get('enemyUnits', []).length > 0) return 'harass';
      return 'rally';
    }
  }

  app.ai.strategies.BalancedStrategy = BalancedStrategy;
})(globalThis);
