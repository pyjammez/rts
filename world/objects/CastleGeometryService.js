(function registerCastleGeometryService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function isHomeCastle(building, homeType = 'home') {
    return !!building && building.type === homeType;
  }

  function isPointInside(building, worldX, worldY, options = {}) {
    if (!isHomeCastle(building, options.homeType) || building.isDead) return false;
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const left = building.tileX * tileSize;
    const top = building.tileY * tileSize;
    return worldX >= left &&
      worldX < left + building.width * tileSize &&
      worldY >= top &&
      worldY < top + building.height * tileSize;
  }

  app.world.castleGeometry = Object.freeze({
    isPointInside,
    describe() {
      return {
        schemaVersion: 2,
        collisionModel: 'solid-footprint',
        methods: ['isPointInside']
      };
    }
  });

  app.diagnostics?.register?.('castle-geometry', () => app.world.castleGeometry.describe());
})(globalThis);
