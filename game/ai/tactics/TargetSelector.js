(function registerTargetSelector(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before TargetSelector.js');
  app.ai = app.ai || {};
  app.ai.tactics = app.ai.tactics || {};

  class TargetSelector {
    constructor({ metrics }) {
      this.metrics = metrics;
    }

    choose(unit, blackboard, intentType) {
      const enemyUnits = blackboard.get('enemyUnits', []);
      const enemyBuildings = blackboard.get('enemyBuildings', []);
      const threats = blackboard.get('threats', []);
      const enemyHome = blackboard.get('enemyHome');

      if (intentType === 'defend' && threats.length > 0) {
        const threat = this.metrics.nearest(unit, threats);
        if (threat) return { kind: 'unit', entity: threat };
      }

      const vulnerableKing = this.metrics.nearest(unit, enemyUnits, enemy => enemy.unitType === 'king');
      if (vulnerableKing && this.metrics.distance(unit, vulnerableKing) <= blackboard.profile.assaultRadius) {
        return { kind: 'unit', entity: vulnerableKing };
      }

      if (enemyHome) return { kind: 'building', entity: enemyHome };

      const nearestEnemy = this.metrics.nearest(unit, enemyUnits);
      if (nearestEnemy) return { kind: 'unit', entity: nearestEnemy };

      const nearestBuilding = this.metrics.nearest(unit, enemyBuildings);
      if (nearestBuilding) return { kind: 'building', entity: nearestBuilding };

      return null;
    }
  }

  app.ai.tactics.TargetSelector = TargetSelector;
})(globalThis);
