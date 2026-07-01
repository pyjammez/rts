(function registerArmyPlanner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before ArmyPlanner.js');
  app.ai = app.ai || {};
  app.ai.planners = app.ai.planners || {};

  class ArmyPlanner {
    createIntent(blackboard) {
      return null;
    }
  }

  app.ai.planners.ArmyPlanner = ArmyPlanner;
})(globalThis);
