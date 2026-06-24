(function registerBuildingPlacementService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function canPlaceAt(type, tileX, tileY, options = {}) {
    const stats = options.stats || {};
    const width = Math.max(1, Math.floor(finiteNumber(stats.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(stats.height, 1)));
    const isInsideMap = options.isInsideMap || (() => false);
    const isWaterTile = options.isWaterTile || (() => false);
    const hasObstacle = options.hasObstacle || (() => false);
    const hasGoldMine = options.hasGoldMine || (() => false);
    const hasHouse = options.hasHouse || (() => false);
    const isBlockedByBuilding = options.isBlockedByBuilding || (() => false);

    for (let y = tileY; y < tileY + height; y++) {
      for (let x = tileX; x < tileX + width; x++) {
        if (!isInsideMap(x, y)) return false;
        if (isWaterTile(x, y)) return false;
        if (hasObstacle(x, y)) return false;
        if (hasGoldMine(x, y)) return false;
        if (hasHouse(x, y)) return false;
        if (isBlockedByBuilding(x, y)) return false;
      }
    }

    if (type === (options.homeType || 'home')) {
      const gateTileX = tileX + Math.floor(width * 0.5);
      for (let y = tileY + height; y <= tileY + height + 1; y++) {
        for (let x = gateTileX - 1; x <= gateTileX + 1; x++) {
          if (!isInsideMap(x, y)) return false;
          if (isWaterTile(x, y)) return false;
          if (hasObstacle(x, y)) return false;
          if (isBlockedByBuilding(x, y)) return false;
        }
      }
    }

    return true;
  }

  function padTiles(type, tileX, tileY, options = {}) {
    const stats = options.stats || {};
    const width = Math.max(1, Math.floor(finiteNumber(stats.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(stats.height, 1)));
    const homeType = options.homeType || 'home';
    const gateTileX = tileX + Math.floor(width * 0.5);
    const minX = type === homeType ? Math.min(tileX, gateTileX - 1) : tileX;
    const maxX = type === homeType ? Math.max(tileX + width - 1, gateTileX + 1) : tileX + width - 1;
    const maxY = tileY + height - 1 + (type === homeType ? 2 : 0);
    const tiles = [];
    for (let y = tileY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) tiles.push({ x, y });
    }
    return tiles;
  }

  function findNearestBuildableSite(type, worldX, worldY, options = {}) {
    const stats = options.stats || {};
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const radiusTiles = Math.max(0, Math.floor(finiteNumber(options.radiusTiles, 8)));
    const canPlace = options.canPlace || (() => false);
    const width = Math.max(1, Math.floor(finiteNumber(stats.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(stats.height, 1)));
    const preferredX = Math.floor(worldX / tileSize - width * 0.5);
    const preferredY = Math.floor(worldY / tileSize - height * 0.5);
    let best = null;
    let bestScore = Infinity;

    for (let radius = 0; radius <= radiusTiles; radius++) {
      for (let y = preferredY - radius; y <= preferredY + radius; y++) {
        for (let x = preferredX - radius; x <= preferredX + radius; x++) {
          if (Math.abs(x - preferredX) !== radius && Math.abs(y - preferredY) !== radius) continue;
          if (!canPlace(type, x, y)) continue;
          const centerX = (x + width * 0.5) * tileSize;
          const centerY = (y + height * 0.5) * tileSize;
          const score = Math.hypot(centerX - worldX, centerY - worldY);
          if (score < bestScore) {
            best = { x, y };
            bestScore = score;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function findTeamBuildingSite(team, type, preferredXRatio, preferredYRatio, options = {}) {
    const stats = options.stats || {};
    const columns = Math.max(1, Math.floor(finiteNumber(options.columns, 1)));
    const rows = Math.max(1, Math.floor(finiteNumber(options.rows, 1)));
    const teamIndex = Math.max(0, Math.floor(finiteNumber(options.teamIndex, team === 'red' ? 0 : 1)));
    const teamCount = Math.max(2, Math.floor(finiteNumber(options.teamCount, 2)));
    const width = Math.max(1, Math.floor(finiteNumber(stats.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(stats.height, 1)));
    const canPlace = options.canPlace || (() => false);
    const sliceWidth = columns / teamCount;
    const homeSideMin = teamCount === 2
      ? team === 'red' ? 2 : Math.floor(columns * 0.52)
      : Math.max(2, Math.floor(teamIndex * sliceWidth) + 1);
    const homeSideMax = teamCount === 2
      ? team === 'red' ? Math.floor(columns * 0.48) : columns - width - 2
      : Math.min(columns - width - 2, Math.floor((teamIndex + 1) * sliceWidth) - width - 1);
    const preferredX = Math.floor(columns * preferredXRatio - width * 0.5);
    const preferredY = Math.floor(rows * preferredYRatio - height * 0.5);
    const clampedX = Math.max(homeSideMin, Math.min(preferredX, homeSideMax));
    const clampedY = Math.max(2, Math.min(preferredY, rows - height - 2));
    let best = null;
    let bestScore = Infinity;

    for (let y = 1; y <= rows - height - 1; y++) {
      for (let x = homeSideMin; x <= homeSideMax; x++) {
        if (!canPlace(type, x, y)) continue;
        const distance = Math.hypot(x - clampedX, y - clampedY);
        if (distance < bestScore) {
          best = { x, y };
          bestScore = distance;
        }
      }
    }

    return best || { fallbackX: clampedX, fallbackY: clampedY };
  }

  app.world.buildingPlacement = Object.freeze({
    canPlaceAt,
    padTiles,
    findNearestBuildableSite,
    findTeamBuildingSite,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['canPlaceAt', 'padTiles', 'findNearestBuildableSite', 'findTeamBuildingSite']
      };
    }
  });

  app.diagnostics?.register?.('building-placement', () => app.world.buildingPlacement.describe());
})(globalThis);
