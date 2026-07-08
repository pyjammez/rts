(function registerWorkerEconomySystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before workerEconomySystem.js');

  const RESOURCE_YIELDS = Object.freeze({ gold: 18, wood: 35, stone: 26, food: 28 });
  const BUILD_COSTS = Object.freeze({
    tower: Object.freeze({ gold: 40, wood: 80 })
  });
  const GATHER_SECONDS = Object.freeze({ gold: 2.3, wood: 2.8, stone: 3.1, food: 1.8 });
  const BUILD_SECONDS = Object.freeze({ tower: 5.5 });

  function isWorker(unit) {
    if (!unit || unit.isDead) return false;
    const tags = Array.isArray(unit.tags) ? unit.tags : [];
    const abilities = Array.isArray(unit.abilities) ? unit.abilities : [];
    return unit.unitType === 'worker' ||
      unit.model === 'worker' ||
      tags.includes('worker') ||
      tags.includes('builder') ||
      tags.includes('villager') ||
      abilities.includes('build') ||
      abilities.includes('gather');
  }

  function getBuildingDefinitionFor(type) {
    return typeof getBuildingDefinition === 'function' ? getBuildingDefinition(type) : null;
  }

  function getBuildCost(type) {
    const definition = getBuildingDefinitionFor(type);
    return definition?.cost || BUILD_COSTS[type] || {};
  }

  function getBuildSeconds(type) {
    const definition = getBuildingDefinitionFor(type);
    const configured = Number(definition?.buildTime);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return BUILD_SECONDS[type] || 4;
  }

  function canBuildBuilding(type) {
    if (!type) return false;
    if (type in BUILD_COSTS) return true;
    return !!getBuildingDefinitionFor(type);
  }

  function clearJob(unit) {
    if (unit) {
      unit.workerJob = null;
      unit.workerGatherAnimation = null;
    }
  }

  function setDestination(unit, target) {
    if (!unit || !target || typeof unit.issueMoveCommand !== 'function') return;
    const offset = Math.max(tileSize * 0.55, (unit.size || 18) + ((target.size || tileSize) * 0.35));
    const angle = Math.atan2(unit.y - target.y, unit.x - target.x) || 0;
    unit.issueMoveCommand(
      target.x + Math.cos(angle) * offset,
      target.y + Math.sin(angle) * offset,
      { append: false }
    );
  }

  function startGather(unit, target, resourceType) {
    if (!isWorker(unit) || !target || target.isDead) return false;
    const type = RESOURCE_YIELDS[resourceType] ? resourceType : null;
    if (!type) return false;
    unit.workerJob = {
      type: 'gather',
      resourceType: type,
      target,
      progress: 0,
      required: GATHER_SECONDS[type] || 2,
      range: Math.max(tileSize * 0.82, (unit.size || 18) + ((target.size || tileSize) * 0.5))
    };
    unit.attackOrderTarget = null;
    unit.currentEnemy = null;
    unit.workerGatherAnimation = null;
    unit.clearPendingItemAction?.();
    unit.clearMountTarget?.();
    setDestination(unit, target);
    return true;
  }

  function startBuild(unit, buildingType, worldX, worldY, options = {}) {
    if (!isWorker(unit)) return false;
    const type = canBuildBuilding(buildingType) ? buildingType : null;
    if (!type || typeof findNearestBuildableSite !== 'function') return false;
    const stats = getBuildingDefinitionFor(type);
    const requestedTileX = Math.floor(Number(options.tileX));
    const requestedTileY = Math.floor(Number(options.tileY));
    const requestedSite = Number.isInteger(requestedTileX) && Number.isInteger(requestedTileY) &&
      typeof canPlaceBuildingAt === 'function' &&
      canPlaceBuildingAt(type, requestedTileX, requestedTileY, { stats })
      ? { x: requestedTileX, y: requestedTileY }
      : null;
    const site = requestedSite || findNearestBuildableSite(type, worldX, worldY, 8, { stats });
    if (!site) return false;
    const cost = getBuildCost(type);
    if (!app.systems.resources?.spend(unit.team, cost)) return false;
    const target = { x: (site.x + 0.5) * tileSize, y: (site.y + 0.5) * tileSize, size: tileSize * 1.2 };
    unit.workerJob = {
      type: 'build',
      buildingType: type,
      tileX: site.x,
      tileY: site.y,
      stats,
      target,
      progress: 0,
      required: getBuildSeconds(type),
      range: tileSize * 1.3
    };
    unit.attackOrderTarget = null;
    unit.currentEnemy = null;
    unit.workerGatherAnimation = null;
    unit.clearPendingItemAction?.();
    unit.clearMountTarget?.();
    setDestination(unit, target);
    return true;
  }

  function collect(unit, job) {
    if (job.resourceType === 'gold') {
      if (!job.target || job.target.isDead || job.target.amount <= 0) return false;
      const amount = Math.min(RESOURCE_YIELDS.gold, job.target.amount);
      job.target.amount -= amount;
      job.target.hp = Math.max(0, job.target.amount);
      if (job.target.amount <= 0) {
        job.target.isDead = true;
        job.target.selected = false;
        if (typeof markGoldMinesDirty === 'function') markGoldMinesDirty();
      }
      app.systems.resources?.add(unit.team, 'gold', amount);
      return true;
    }

    if (job.resourceType === 'wood') {
      if (!job.target || job.target.isDead || job.target.obstacleType !== OBSTACLE.TREE) return false;
      job.target.takeDamage?.(job.target.maxHp || 999);
      app.systems.resources?.add(unit.team, 'wood', RESOURCE_YIELDS.wood);
      return true;
    }

    if (job.resourceType === 'stone') {
      if (!job.target || job.target.isDead || job.target.obstacleType !== OBSTACLE.ROCK) return false;
      job.target.takeDamage?.(job.target.maxHp || 999);
      app.systems.resources?.add(unit.team, 'stone', RESOURCE_YIELDS.stone);
      return true;
    }

    if (job.resourceType === 'food') {
      if (!job.target || job.target.isDead || job.target.isMounted) return false;
      job.target.takeDamage?.(job.target.maxHp || job.target.hp || 999);
      app.systems.resources?.add(unit.team, 'food', RESOURCE_YIELDS.food);
      return true;
    }

    return false;
  }

  function finishBuild(unit, job) {
    if (typeof buildBuildingAtTile !== 'function') return false;
    return !!buildBuildingAtTile(job.buildingType, unit.team, job.tileX, job.tileY, { stats: job.stats });
  }

  function faceTarget(unit, target) {
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    if (Math.hypot(dx, dy) <= 0.001) return;
    unit.heading = Math.atan2(dy, dx);
    if (Math.abs(dx) > Math.abs(dy)) {
      unit.spriteDirectionRow = dx >= 0 ? 2 : 1;
    } else {
      unit.spriteDirectionRow = dy >= 0 ? 0 : 3;
    }
  }

  function updateUnit(unit, dt) {
    const job = unit.workerJob;
    if (!isWorker(unit) || !job) return;
    const target = job.target;
    if (!target || target.isDead) {
      clearJob(unit);
      return;
    }
    const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
    if (distance > job.range) {
      unit.workerGatherAnimation = null;
      if (!unit.target && !(unit.hasActivePath && unit.hasActivePath())) setDestination(unit, target);
      return;
    }
    unit.clearMovementState?.();
    faceTarget(unit, target);
    job.progress += dt;
    unit.workerGatherAnimation = {
      type: job.resourceType || job.buildingType || 'work',
      progress: job.required > 0 ? Math.max(0, Math.min(1, job.progress / job.required)) : 0,
      target
    };
    if (job.progress < job.required) return;
    if (job.type === 'gather') collect(unit, job);
    if (job.type === 'build') finishBuild(unit, job);
    clearJob(unit);
  }

  function update(dt, context = {}) {
    const sourceUnits = Array.isArray(context.units) ? context.units : [];
    for (const unit of sourceUnits) updateUnit(unit, dt);
  }

  app.systems.workerEconomy = Object.freeze({
    BUILD_COSTS,
    RESOURCE_YIELDS,
    reset() {},
    isWorker,
    canBuildBuilding,
    getBuildCost,
    getBuildSeconds,
    startGather,
    startBuild,
    update,
    clearJob
  });
})(globalThis);
