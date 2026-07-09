(function registerBuildingMobilitySystem(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.systems = app.systems || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function canLift(building) {
    return !!building && !building.isDead && !!building.mobility?.canLiftOff;
  }

  function canLand(building) {
    return canLift(building) && !!building.mobility?.canLand;
  }

  function isFlying(building) {
    return building?.mobilityState === 'flying' || building?.mobilityState === 'lifting' || building?.mobilityState === 'landing';
  }

  function liftOff(building) {
    if (!canLift(building) || building.mobilityState !== 'landed') return false;
    building.mobilityState = 'lifting';
    building.liftProgress = 0;
    building.landProgress = 0;
    building.relocationTarget = null;
    return true;
  }

  function relocate(building, x, y) {
    if (!canLift(building)) return false;
    if (building.mobilityState === 'landed') liftOff(building);
    if (building.mobilityState !== 'flying' && building.mobilityState !== 'lifting') return false;
    building.relocationTarget = {
      x: finiteNumber(x, building.x),
      y: finiteNumber(y, building.y)
    };
    return true;
  }

  function land(building) {
    if (!canLand(building) || building.mobilityState !== 'flying') return false;
    building.mobilityState = 'landing';
    building.landProgress = 0;
    building.relocationTarget = null;
    return true;
  }

  function updateTileFromCenter(building, tileSize = 32) {
    const width = Math.max(1, Math.floor(finiteNumber(building.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(building.height, 1)));
    building.tileX = Math.max(0, Math.floor(building.x / tileSize - width * 0.5));
    building.tileY = Math.max(0, Math.floor(building.y / tileSize - height * 0.5));
  }

  function update(dt, context = {}) {
    const buildings = Array.isArray(context.buildings) ? context.buildings : [];
    const tileSize = Math.max(1, finiteNumber(context.tileSize, root.tileSize || 32));
    for (const building of buildings) {
      if (!building || building.isDead || !building.mobility) continue;
      const liftTime = Math.max(0.1, finiteNumber(building.mobility.liftTime, 1));
      const landTime = Math.max(0.1, finiteNumber(building.mobility.landTime, 1));
      const maxHeight = Math.max(18, finiteNumber(building.mobility.flightHeight, tileSize * 0.95));

      if (building.mobilityState === 'lifting') {
        building.liftProgress = Math.min(1, finiteNumber(building.liftProgress, 0) + dt / liftTime);
        building.flightHeight = maxHeight * building.liftProgress;
        if (building.liftProgress >= 1) building.mobilityState = 'flying';
      } else if (building.mobilityState === 'landing') {
        building.landProgress = Math.min(1, finiteNumber(building.landProgress, 0) + dt / landTime);
        building.flightHeight = maxHeight * (1 - building.landProgress);
        if (building.landProgress >= 1) {
          building.mobilityState = 'landed';
          building.flightHeight = 0;
          updateTileFromCenter(building, tileSize);
        }
      } else if (building.mobilityState === 'flying') {
        building.flightHeight = maxHeight;
      }

      if (building.relocationTarget && (building.mobilityState === 'flying' || building.mobilityState === 'lifting')) {
        const speed = Math.max(1, finiteNumber(building.mobility.flySpeed, 72));
        const dx = building.relocationTarget.x - building.x;
        const dy = building.relocationTarget.y - building.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed * dt) {
          building.x = building.relocationTarget.x;
          building.y = building.relocationTarget.y;
          building.relocationTarget = null;
        } else if (dist > 0) {
          building.x += dx / dist * speed * dt;
          building.y += dy / dist * speed * dt;
        }
        updateTileFromCenter(building, tileSize);
      }
    }
  }

  app.systems.buildingMobility = Object.freeze({
    canLift,
    canLand,
    isFlying,
    liftOff,
    relocate,
    land,
    update
  });
})(globalThis);
