(function registerAttackPlanner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before AttackPlanner.js');
  app.ai = app.ai || {};
  app.ai.planners = app.ai.planners || {};

  class AttackPlanner {
    createIntent(blackboard, primaryPlan) {
      if (primaryPlan !== 'attack' && primaryPlan !== 'harass') return null;
      return {
        type: primaryPlan,
        priority: primaryPlan === 'attack' ? 70 : 45,
        target: blackboard.get('enemyHome') || blackboard.get('enemyUnits', [])[0] || null
      };
    }
  }

  app.ai.planners.AttackPlanner = AttackPlanner;
})(globalThis);
