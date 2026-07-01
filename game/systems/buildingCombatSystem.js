(function registerBuildingCombatSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before buildingCombatSystem.js');

  function findNearestEnemy(building, units, range) {
    let target = null;
    let closestDistance = Infinity;
    for (const unit of Array.isArray(units) ? units : []) {
      if (!unit || unit.isDead || unit.team === building.team) continue;
      const targetIsAir = unit.movementType === 'air' || unit.airborne === true;
      if (targetIsAir && !building.canTargetAir) continue;
      if (!targetIsAir && building.canTargetGround === false) continue;
      const distance = Math.hypot(unit.x - building.x, unit.y - building.y);
      if (distance >= range || distance >= closestDistance) continue;
      target = unit;
      closestDistance = distance;
    }
    return target;
  }

  function update(dt, state, dependencies) {
    const buildings = Array.isArray(state?.buildings) ? state.buildings : [];
    const units = Array.isArray(state?.units) ? state.units : [];
    const {
      homeType = 'home',
      towerType = 'tower',
      tileSize = 32,
      spawnProjectile = () => false
    } = dependencies || {};

    for (const building of buildings) {
      if (building.isDead) continue;

      const isDefensiveBuilding = building.type === towerType || building.type === homeType;
      if (!isDefensiveBuilding) continue;

      building.fireCooldown = Math.max(0, (building.fireCooldown || 0) - dt);
      if (building.fireCooldown > 0) continue;

      const range = building.type === homeType
        ? building.range || 360
        : building.range || 245;
      const target = findNearestEnemy(building, units, range);
      if (!target) continue;

      const fired = spawnProjectile({
        x: building.x,
        y: building.y - tileSize * (building.type === homeType ? 1.35 : 0.75),
        target,
        team: building.team,
        damage: building.type === homeType
          ? building.damage || 8
          : building.damage || 12,
        shooter: building,
        speed: building.projectileSpeed,
        color: building.projectileColor
      });
      if (fired !== false) building.fireCooldown = building.attackCooldown || 1.15;
    }
  }

  app.systems.buildingCombat = Object.freeze({ update, findNearestEnemy });
})(globalThis);
