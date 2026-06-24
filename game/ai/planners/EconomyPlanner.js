(function registerEconomyPlanner(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before EconomyPlanner.js');
  app.ai = app.ai || {};
  app.ai.planners = app.ai.planners || {};

  class EconomyPlanner {
    createIntent(blackboard) {
      const home = blackboard.get('home');
      const king = blackboard.get('king');
      if (!home || !king) return null;
      if ((home.upgradeLevel || 0) >= blackboard.profile.castleUpgradeMaxLevel) return null;

      return {
        type: 'upgrade-castle',
        priority: 65,
        home,
        king
      };
    }
  }

  app.ai.planners.EconomyPlanner = EconomyPlanner;
})(globalThis);
