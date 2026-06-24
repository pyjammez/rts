(function registerNavigationService(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before NavigationService.js');
  app.world = app.world || {};

  function createNavigationService(deps = {}) {
    const tileSize = deps.tileSize || 32;
    const terrainTypes = deps.terrainTypes || {};
    const obstacleTypes = deps.obstacleTypes || {};
    const decorTypes = deps.decorTypes || {};
    const heightLevels = deps.heightLevels || {};
    const groundHeight = Number(heightLevels.GROUND) || 1;
    const rampHeight = Number(heightLevels.RAMP) || 3;

    function terrainData() {
      return deps.getTerrainData?.() || [];
    }

    function obstacleData() {
      return deps.getObstacleData?.() || [];
    }

    function decorationData() {
      return deps.getDecorationData?.() || [];
    }

    function heightData() {
      return deps.getHeightData?.() || [];
    }

    function normalizeMovementOptions(options = {}) {
      if (typeof options === 'string') return { movementType: options };
      return options && typeof options === 'object' ? options : {};
    }

    function isInsideMap(tileX, tileY) {
      const terrain = terrainData();
      return tileY >= 0 && tileY < terrain.length && tileX >= 0 && tileX < (terrain[0]?.length || 0);
    }

    function getTileHeightLevel(tileX, tileY) {
      if (!isInsideMap(tileX, tileY)) return groundHeight;
      const value = heightData()[tileY]?.[tileX];
      return Number.isFinite(value) ? value : groundHeight;
    }

    function getTileTraversalHeight(tileX, tileY) {
      const value = getTileHeightLevel(tileX, tileY);
      return value === rampHeight ? groundHeight : value;
    }

    function isRampTile(tileX, tileY) {
      return getTileHeightLevel(tileX, tileY) === rampHeight;
    }

    function getWorldElevation(worldX, worldY) {
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      const level = getTileTraversalHeight(tileX, tileY);
      return (level - groundHeight) * 0.42;
    }

    function canTraverseHeightStep(fromTile, toTile) {
      if (!fromTile || !toTile) return true;
      if (!isInsideMap(fromTile.x, fromTile.y) || !isInsideMap(toTile.x, toTile.y)) return false;
      if (isRampTile(fromTile.x, fromTile.y) || isRampTile(toTile.x, toTile.y)) return true;
      return Math.abs(getTileTraversalHeight(toTile.x, toTile.y) - getTileTraversalHeight(fromTile.x, fromTile.y)) <= 1;
    }

    function isAirMovement(options = {}) {
      const resolved = normalizeMovementOptions(options);
      return resolved.movementType === 'air' || resolved.unit?.movementType === 'air' || resolved.unit?.airborne === true;
    }

    function isWalkableTile(tileX, tileY, options = {}) {
      if (!isInsideMap(tileX, tileY)) return false;

      const movementOptions = normalizeMovementOptions(options);
      if (isAirMovement(movementOptions)) return true;

      const terrain = terrainData();
      const obstacles = obstacleData();
      const decorations = decorationData();
      const terrainType = terrain[tileY]?.[tileX];
      const obstacleType = obstacles[tileY]?.[tileX];

      if (terrainType === terrainTypes.WATER) return false;
      if (obstacleType === obstacleTypes.TREE || obstacleType === obstacleTypes.ROCK) return false;
      if (decorations[tileY]?.[tileX] === decorTypes.CLIFF) return false;
      if (deps.isTileBlockedByBuilding?.(tileX, tileY)) return false;
      if (movementOptions.fromTile && !canTraverseHeightStep(movementOptions.fromTile, { x: tileX, y: tileY })) return false;

      return true;
    }

    function getMovementCost(tileX, tileY, options = {}) {
      if (!isWalkableTile(tileX, tileY, options)) return Infinity;
      if (isAirMovement(options)) return 0.9;

      const terrainType = terrainData()[tileY]?.[tileX];
      const obstacleType = obstacleData()[tileY]?.[tileX];
      const heightLevel = getTileHeightLevel(tileX, tileY);

      let cost = 1;
      if (terrainType === terrainTypes.SAND) cost = 1.35;
      else if (terrainType === terrainTypes.DIRT) cost = 1.15;

      if (heightLevel === heightLevels.LOW) cost += 0.12;
      if (heightLevel === heightLevels.HIGH) cost += 0.18;
      if (heightLevel === heightLevels.RAMP) cost += 0.25;
      if (obstacleType === obstacleTypes.SHRUB) cost += 0.2;

      return cost;
    }

    function canSpawnAt(x, y, unitSize = 20, options = {}) {
      const movementOptions = normalizeMovementOptions(options);
      const offsets = [
        { dx: -unitSize / 2, dy: -unitSize / 2 },
        { dx: unitSize / 2, dy: -unitSize / 2 },
        { dx: -unitSize / 2, dy: unitSize / 2 },
        { dx: unitSize / 2, dy: unitSize / 2 }
      ];
      const centerTile = {
        x: Math.floor(x / tileSize),
        y: Math.floor(y / tileSize)
      };

      for (const offset of offsets) {
        const tileX = Math.floor((x + offset.dx) / tileSize);
        const tileY = Math.floor((y + offset.dy) / tileSize);
        if (!isWalkableTile(tileX, tileY, { ...movementOptions, fromTile: movementOptions.fromTile || centerTile })) {
          return false;
        }
      }

      return true;
    }

    function isCommandWalkablePoint(worldX, worldY, unitSize = 20, options = {}) {
      if (isAirMovement(options)) return canSpawnAt(worldX, worldY, unitSize, options);
      return canSpawnAt(worldX, worldY, unitSize, options) && deps.isVisualLandPoint?.(worldX, worldY) !== false;
    }

    function findNearestWalkablePoint(worldX, worldY, unitSize = 20, maxRadius = 16, options = {}) {
      if (maxRadius && typeof maxRadius === 'object') {
        options = maxRadius;
        maxRadius = 16;
      }
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
      if (terrainData().length === 0) return null;

      const mapWidth = deps.getMapWidthPx?.() || 0;
      const mapHeight = deps.getMapHeightPx?.() || 0;
      const clampedX = Math.max(unitSize * 0.5, Math.min(worldX, mapWidth - unitSize * 0.5));
      const clampedY = Math.max(unitSize * 0.5, Math.min(worldY, mapHeight - unitSize * 0.5));

      if (isCommandWalkablePoint(clampedX, clampedY, unitSize, options)) {
        return { x: clampedX, y: clampedY, adjusted: false };
      }

      let best = null;
      let bestDistance = Infinity;
      const maxDistance = maxRadius * tileSize;
      const searchStep = Math.max(4, Math.floor(tileSize / 4));

      for (let radius = searchStep; radius <= maxDistance; radius += searchStep) {
        for (let dy = -radius; dy <= radius; dy += searchStep) {
          for (let dx = -radius; dx <= radius; dx += searchStep) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;

            const candidateX = Math.max(unitSize * 0.5, Math.min(clampedX + dx, mapWidth - unitSize * 0.5));
            const candidateY = Math.max(unitSize * 0.5, Math.min(clampedY + dy, mapHeight - unitSize * 0.5));
            if (!isCommandWalkablePoint(candidateX, candidateY, unitSize, options)) continue;

            const distance = Math.hypot(candidateX - clampedX, candidateY - clampedY);
            if (distance < bestDistance) {
              best = { x: candidateX, y: candidateY };
              bestDistance = distance;
            }
          }
        }

        if (best) return { x: best.x, y: best.y, adjusted: true };
      }

      return null;
    }

    function hasLineOfSight(startTile, endTile, options = {}) {
      const x0 = startTile.x;
      const y0 = startTile.y;
      const x1 = endTile.x;
      const y1 = endTile.y;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let x = x0;
      let y = y0;
      let previousTile = null;

      while (true) {
        if (!isWalkableTile(x, y, { ...options, fromTile: previousTile })) return false;
        if (x === x1 && y === y1) break;

        const e2 = 2 * err;
        let nextX = x;
        let nextY = y;
        if (e2 > -dy) {
          err -= dy;
          nextX += sx;
        }
        if (e2 < dx) {
          err += dx;
          nextY += sy;
        }

        if (nextX !== x && nextY !== y) {
          const side1Blocked = !isWalkableTile(nextX, y, { ...options, fromTile: { x, y } });
          const side2Blocked = !isWalkableTile(x, nextY, { ...options, fromTile: { x, y } });
          if (side1Blocked || side2Blocked) return false;
        }

        previousTile = { x, y };
        x = nextX;
        y = nextY;
      }

      return true;
    }

    function smoothPath(path, options = {}) {
      if (!path || path.length === 0) return [];

      const newPath = [];
      let currentIndex = 0;

      while (currentIndex < path.length - 1) {
        let furthest = path.length - 1;
        let found = false;

        while (furthest > currentIndex + 1) {
          const start = path[currentIndex];
          const end = path[furthest];
          const movingDiagonally = Math.abs(end.x - start.x) > 0 && Math.abs(end.y - start.y) > 0;
          let blockedDiagonal = false;
          if (movingDiagonally) {
            const side1Blocked = !isWalkableTile(end.x, start.y, { ...options, fromTile: start });
            const side2Blocked = !isWalkableTile(start.x, end.y, { ...options, fromTile: start });
            blockedDiagonal = side1Blocked || side2Blocked;
          }

          if (!blockedDiagonal && hasLineOfSight(start, end, options)) {
            found = true;
            break;
          }
          furthest--;
        }

        if (!found) furthest = currentIndex + 1;
        newPath.push(path[furthest]);
        if (furthest <= currentIndex) break;
        currentIndex = furthest;
      }

      const lastTile = path[path.length - 1];
      if (!newPath.some(tile => tile.x === lastTile.x && tile.y === lastTile.y)) {
        newPath.push(lastTile);
      }

      return newPath;
    }

    return Object.freeze({
      normalizeMovementOptions,
      isInsideMap,
      getTileHeightLevel,
      getTileTraversalHeight,
      isRampTile,
      getWorldElevation,
      canTraverseHeightStep,
      isAirMovement,
      isWalkableTile,
      getMovementCost,
      canSpawnAt,
      isCommandWalkablePoint,
      findNearestWalkablePoint,
      hasLineOfSight,
      smoothPath
    });
  }

  app.world.navigation = Object.freeze({ createNavigationService });
})(globalThis);
