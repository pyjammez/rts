(function registerCarryableObjectService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function findNearestCarryableObject(worldX, worldY, options = {}) {
    const radius = Math.max(0, Number(options.radius) || 90);
    const items = Array.isArray(options.items) ? options.items : [];
    const obstacles = Array.isArray(options.obstacles) ? options.obstacles : [];
    let closest = null;
    let closestDistance = Infinity;

    for (const item of items) {
      if (item.isDead || item.isPickedUp || !item.pickupable) continue;
      const distance = Math.hypot(item.x - worldX, item.y - worldY);
      if (distance <= radius && distance < closestDistance) {
        closest = item;
        closestDistance = distance;
      }
    }

    for (const obstacle of obstacles) {
      if (obstacle.isDead || obstacle.isPickedUp || !obstacle.pickupable) continue;
      const distance = Math.hypot(obstacle.x - worldX, obstacle.y - worldY);
      const reach = radius + obstacle.size * 0.5;
      if (distance <= reach && distance < closestDistance) {
        closest = obstacle;
        closestDistance = distance;
      }
    }

    return closest;
  }

  function canDropObstacleAt(tileX, tileY, options = {}) {
    const isInsideMap = options.isInsideMap || (() => false);
    const isWaterTile = options.isWaterTile || (() => false);
    const hasObstacle = options.hasObstacle || (() => false);
    const isBlockedByBuilding = options.isBlockedByBuilding || (() => false);
    const tileCenter = options.tileCenter || ((x, y) => ({ x, y }));
    const tileSize = Math.max(1, Number(options.tileSize) || 32);
    const units = Array.isArray(options.units) ? options.units : [];

    if (!isInsideMap(tileX, tileY)) return false;
    if (isWaterTile(tileX, tileY)) return false;
    if (hasObstacle(tileX, tileY)) return false;
    if (isBlockedByBuilding(tileX, tileY)) return false;

    const center = tileCenter(tileX, tileY);
    return !units.some(unit =>
      !unit.isDead && Math.hypot(unit.x - center.x, unit.y - center.y) < tileSize * 0.72
    );
  }

  function findObstacleDropTile(worldX, worldY, options = {}) {
    const tileSize = Math.max(1, Number(options.tileSize) || 32);
    const maxRadius = Math.max(0, Math.floor(Number(options.maxRadius) || 5));
    const originX = Math.floor(worldX / tileSize);
    const originY = Math.floor(worldY / tileSize);
    const canDrop = options.canDrop || (() => false);

    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let offsetY = -radius; offsetY <= radius; offsetY++) {
        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
          if (radius > 0 && Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
          const tileX = originX + offsetX;
          const tileY = originY + offsetY;
          if (canDrop(tileX, tileY)) return { tileX, tileY };
        }
      }
    }
    return null;
  }

  app.world.carryables = Object.freeze({
    findNearestCarryableObject,
    canDropObstacleAt,
    findObstacleDropTile,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['findNearestCarryableObject', 'canDropObstacleAt', 'findObstacleDropTile']
      };
    }
  });

  app.diagnostics?.register?.('world-carryables', () => app.world.carryables.describe());
})(globalThis);
