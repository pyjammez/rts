(function registerBlackboard(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before Blackboard.js');
  app.ai = app.ai || {};
  app.ai.core = app.ai.core || {};

  function distanceSquared(left, right) {
    const dx = (left?.x || 0) - (right?.x || 0);
    const dy = (left?.y || 0) - (right?.y || 0);
    return dx * dx + dy * dy;
  }

  function distance(left, right) {
    return Math.sqrt(distanceSquared(left, right));
  }

  function isAlive(entity) {
    return !!entity && !entity.isDead && Number.isFinite(entity.x) && Number.isFinite(entity.y);
  }

  function isHomeBuilding(building) {
    return building?.type === 'home' || building?.type === 'castle';
  }

  function isRangedUnit(unit) {
    return Number(unit?.shootRange) >= 120 && !unit?.melee;
  }

  function isCombatUnit(unit) {
    return isAlive(unit) && unit.unitType !== 'king';
  }

  function unitHasActiveOrder(unit) {
    return !!unit?.attackOrderTarget ||
      !!unit?.destination ||
      !!unit?.target ||
      (Array.isArray(unit?.path) && unit.pathIndex < unit.path.length) ||
      (Array.isArray(unit?.commandQueue) && unit.commandQueue.length > 0) ||
      !!unit?.pendingPickupItem ||
      !!unit?.pendingDropPoint ||
      !!unit?.mountTarget;
  }

  function nearest(source, candidates, predicate = () => true) {
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates || []) {
      if (!predicate(candidate)) continue;
      const candidateDistance = distanceSquared(source, candidate);
      if (candidateDistance < bestDistance) {
        best = candidate;
        bestDistance = candidateDistance;
      }
    }
    return best;
  }

  class Blackboard {
    constructor({ team, profile }) {
      this.team = team;
      this.profile = profile;
      this.elapsed = 0;
      this.values = new Map();
      this.lastUnitOrders = new Map();
      this.lastPlan = 'opening';
      this.waveCooldown = profile.earlyAttackDelay;
    }

    update(deltaTime, gameState = {}) {
      this.elapsed += Math.max(0, Number(deltaTime) || 0);
      this.waveCooldown -= Math.max(0, Number(deltaTime) || 0);

      const units = Array.isArray(gameState.units) ? gameState.units : [];
      const buildings = Array.isArray(gameState.buildings) ? gameState.buildings : [];
      const friendlyUnits = units.filter(unit => isAlive(unit) && unit.team === this.team);
      const enemyUnits = units.filter(unit => isAlive(unit) && unit.team !== this.team);
      const friendlyBuildings = buildings.filter(building => isAlive(building) && building.team === this.team);
      const enemyBuildings = buildings.filter(building => isAlive(building) && building.team !== this.team);
      const home = friendlyBuildings.find(isHomeBuilding) || null;
      const enemyHome = enemyBuildings.find(isHomeBuilding) || null;
      const threats = home
        ? enemyUnits.filter(unit => distance(unit, home) <= this.profile.defenseRadius)
        : [];

      this.values.set('gameState', gameState);
      this.values.set('units', units);
      this.values.set('buildings', buildings);
      this.values.set('friendlyUnits', friendlyUnits);
      this.values.set('enemyUnits', enemyUnits);
      this.values.set('friendlyBuildings', friendlyBuildings);
      this.values.set('enemyBuildings', enemyBuildings);
      this.values.set('home', home);
      this.values.set('enemyHome', enemyHome);
      this.values.set('king', friendlyUnits.find(unit => unit.unitType === 'king') || null);
      this.values.set('rangedUnits', friendlyUnits.filter(isRangedUnit));
      this.values.set('assaultUnits', friendlyUnits.filter(isCombatUnit));
      this.values.set('idleCombatUnits', friendlyUnits.filter(unit => isCombatUnit(unit) && !unitHasActiveOrder(unit)));
      this.values.set('threats', threats);
      this.values.set('armyStrength', friendlyUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp || 0), 0));
      this.values.set('enemyStrength', enemyUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp || 0), 0));
    }

    get(key, fallback = null) {
      return this.values.has(key) ? this.values.get(key) : fallback;
    }

    set(key, value) {
      this.values.set(key, value);
    }

    rememberOrder(unit, signature) {
      if (unit?.id == null) return;
      this.lastUnitOrders.set(unit.id, signature);
    }

    hasRecentOrder(unit, signature) {
      return this.lastUnitOrders.get(unit?.id) === signature && unitHasActiveOrder(unit);
    }

    markPlan(plan) {
      this.lastPlan = plan;
    }

    getDebugState() {
      return {
        team: this.team,
        elapsed: this.elapsed,
        waveCooldown: this.waveCooldown,
        lastPlan: this.lastPlan,
        armyStrength: this.get('armyStrength', 0),
        enemyStrength: this.get('enemyStrength', 0),
        threats: this.get('threats', []).length
      };
    }
  }

  app.ai.core.Blackboard = Blackboard;
  app.ai.core.metrics = Object.freeze({
    distance,
    distanceSquared,
    isAlive,
    isCombatUnit,
    isHomeBuilding,
    isRangedUnit,
    nearest,
    unitHasActiveOrder
  });
})(globalThis);
