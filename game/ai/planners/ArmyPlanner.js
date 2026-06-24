(function registerArmyPlanner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before ArmyPlanner.js');
  app.ai = app.ai || {};
  app.ai.planners = app.ai.planners || {};

  class ArmyPlanner {
    createIntent(blackboard) {
      const home = blackboard.get('home');
      if (!home) return null;

      const target = blackboard.get('threats', [])[0] ||
        blackboard.get('enemyHome') ||
        blackboard.get('enemyUnits', [])[0] ||
        null;

      const defenders = blackboard.get('rangedUnits', [])
        .filter(unit => unit.castleTopBuildingId !== home.id || !unit.castleRampClimbed)
        .slice(0, blackboard.profile.rampartDefenders);

      if (defenders.length === 0) return null;
      return {
        type: 'prepare-ramparts',
        priority: 80,
        home,
        target,
        defenders
      };
    }
  }

  app.ai.planners.ArmyPlanner = ArmyPlanner;
})(globalThis);
