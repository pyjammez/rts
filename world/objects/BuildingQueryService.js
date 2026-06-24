(function registerBuildingQueryService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function liveBuildings(buildings) {
    return Array.isArray(buildings) ? buildings.filter(building => !building.isDead) : [];
  }

  function teamHome(buildings, team, homeType = 'home') {
    return liveBuildings(buildings).find(building => building.team === team && building.type === homeType) || null;
  }

  function atWorldPoint(buildings, worldX, worldY, options = {}) {
    const tileSize = Math.max(1, Number(options.tileSize) || 32);
    return app.world.hitTests?.nearestBoxAtPoint(buildings, worldX, worldY, {
      include: building => !building.isDead,
      halfWidth: building => building.width * tileSize * 0.72,
      halfHeight: building => building.height * tileSize * 0.78
    }) || null;
  }

  function atScreenPoint(buildings, screenX, screenY, options = {}) {
    const camera = options.camera;
    if (!camera) return null;
    const tileSize = Math.max(1, Number(options.tileSize) || 32);
    const projected = liveBuildings(buildings).map(building => ({
      building,
      x: (building.x - camera.x) * camera.zoom,
      y: (building.y - camera.y) * camera.zoom,
      halfWidth: building.width * tileSize * 0.72 * camera.zoom,
      halfHeight: building.height * tileSize * 0.78 * camera.zoom
    }));
    return app.world.hitTests?.nearestBoxAtPoint(projected, screenX, screenY, {
      halfWidth: projectedBuilding => projectedBuilding.halfWidth,
      halfHeight: projectedBuilding => projectedBuilding.halfHeight
    })?.building || null;
  }

  function nearPoint(buildings, worldX, worldY, radius, options = {}) {
    const tileSize = Math.max(1, Number(options.tileSize) || 32);
    const searchRadius = Math.max(0, Number(radius) || 0);
    return liveBuildings(buildings).filter(building => {
      const hitRadius = Math.max(building.width, building.height) * tileSize * 0.5;
      return Math.hypot(building.x - worldX, building.y - worldY) <= searchRadius + hitRadius;
    });
  }

  app.world.buildingQueries = Object.freeze({
    liveBuildings,
    teamHome,
    atWorldPoint,
    atScreenPoint,
    nearPoint,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['liveBuildings', 'teamHome', 'atWorldPoint', 'atScreenPoint', 'nearPoint']
      };
    }
  });

  app.diagnostics?.register?.('building-queries', () => app.world.buildingQueries.describe());
})(globalThis);
