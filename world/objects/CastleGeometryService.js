(function registerCastleGeometryService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function tileCenter(tileX, tileY, tileSize = 32) {
    const size = Math.max(1, finiteNumber(tileSize, 32));
    return {
      x: (finiteNumber(tileX, 0) + 0.5) * size,
      y: (finiteNumber(tileY, 0) + 0.5) * size
    };
  }

  function isHomeCastle(building, homeType = 'home') {
    return !!building && building.type === homeType;
  }

  function isPassageTile(building, tileX, tileY, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return false;
    const localX = Math.floor(finiteNumber(tileX, 0)) - building.tileX;
    const localY = Math.floor(finiteNumber(tileY, 0)) - building.tileY;
    return localX >= 0 && localX < building.width && localY >= 0 && localY < building.height;
  }

  function isCourtyardPoint(building, worldX, worldY, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return false;
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const tileX = Math.floor(finiteNumber(worldX, 0) / tileSize);
    const tileY = Math.floor(finiteNumber(worldY, 0) / tileSize);
    const localX = tileX - building.tileX;
    const localY = tileY - building.tileY;
    return localX >= 2 &&
      localX <= building.width - 3 &&
      localY >= 2 &&
      localY <= building.height - 3;
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

  function getDoorPoints(building, laneIndex = 0, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return null;
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const laneOffsets = Array.isArray(options.laneOffsets) && options.laneOffsets.length
      ? options.laneOffsets
      : [0, -1, 1];
    const normalizedLane = Math.abs(Math.floor(finiteNumber(laneIndex, 0))) % laneOffsets.length;
    const gateTileX = building.tileX + Math.floor(building.width * 0.5) + laneOffsets[normalizedLane];
    return {
      inside: tileCenter(gateTileX, building.tileY + building.height - 2, tileSize),
      threshold: tileCenter(gateTileX, building.tileY + building.height - 1, tileSize),
      outside: tileCenter(gateTileX, building.tileY + building.height, tileSize),
      backY: (building.tileY - 0.5) * tileSize,
      frontY: (building.tileY + building.height + 0.5) * tileSize,
      leftX: (building.tileX - 0.5) * tileSize,
      rightX: (building.tileX + building.width + 0.5) * tileSize
    };
  }

  function getDoorApproach(unit, building, door, options = {}) {
    if (!unit || !building || !door) return [];
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const castleBack = building.tileY * tileSize;
    const castleFront = (building.tileY + building.height) * tileSize;
    if (unit.y >= castleFront) return [];

    const useLeft = unit.x <= building.x;
    const sideX = useLeft ? door.leftX : door.rightX;
    const route = [];
    if (unit.y < castleBack) route.push({ x: sideX, y: door.backY });
    route.push({ x: sideX, y: door.frontY });
    return route;
  }

  function routeIntoCastle(unit, building, destination, options = {}) {
    if (!unit || !building || !destination) return [];
    if (isPointInside(building, unit.x, unit.y, options)) return [destination];
    const door = getDoorPoints(building, options.laneIndex, options);
    return door
      ? [...getDoorApproach(unit, building, door, options), door.outside, door.threshold, door.inside, destination]
      : [];
  }

  function routeOutOfCastle(building, destination, options = {}) {
    if (!building || !destination) return [];
    const door = getDoorPoints(building, options.laneIndex, options);
    return door ? [door.inside, door.threshold, door.outside, destination] : [];
  }

  function getWallSlots(building, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return [];
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const slots = [];
    const minX = building.tileX;
    const maxX = building.tileX + building.width - 1;
    const minY = building.tileY;
    const maxY = building.tileY + building.height - 1;

    for (let x = minX; x <= maxX; x++) slots.push({ tileX: x, tileY: minY });
    for (let y = minY + 1; y <= maxY; y++) slots.push({ tileX: maxX, tileY: y });
    for (let x = maxX - 1; x >= minX; x--) slots.push({ tileX: x, tileY: maxY });
    for (let y = maxY - 1; y > minY; y--) slots.push({ tileX: minX, tileY: y });

    return slots.map(slot => ({ ...slot, ...tileCenter(slot.tileX, slot.tileY, tileSize) }));
  }

  function getNearestWallSlotIndex(slots, worldX, worldY) {
    if (!Array.isArray(slots) || slots.length === 0) return 0;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    slots.forEach((slot, index) => {
      const distance = Math.hypot(slot.x - worldX, slot.y - worldY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  function getRampPoints(building, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return null;
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const stairY = building.tileY + Math.min(building.height - 2, Math.floor(building.height * 0.5) + 1);
    const base = tileCenter(building.tileX + building.width - 3, stairY, tileSize);
    const top = tileCenter(building.tileX + building.width - 1, stairY, tileSize);
    const slots = getWallSlots(building, options);
    return {
      base,
      top,
      topSlotIndex: getNearestWallSlotIndex(slots, top.x, top.y)
    };
  }

  function getWallRoute(slots, startIndex, endIndex) {
    if (!Array.isArray(slots) || !slots.length || startIndex === endIndex) return [];
    const clockwiseSteps = (endIndex - startIndex + slots.length) % slots.length;
    const counterSteps = (startIndex - endIndex + slots.length) % slots.length;
    const direction = clockwiseSteps <= counterSteps ? 1 : -1;
    const count = Math.min(clockwiseSteps, counterSteps);
    const route = [];
    for (let step = 1; step <= count; step++) {
      route.push(slots[(startIndex + direction * step + slots.length) % slots.length]);
    }
    return route;
  }

  function getStairPoint(building, index = 0, total = 1, options = {}) {
    if (!isHomeCastle(building, options.homeType)) return null;
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const wallSlots = getWallSlots(building, options);
    const targetWorldX = options.targetWorldX;
    const targetWorldY = options.targetWorldY;
    const hasTarget = Number.isFinite(targetWorldX) && Number.isFinite(targetWorldY);
    const targetIndex = hasTarget
      ? getNearestWallSlotIndex(wallSlots, targetWorldX, targetWorldY)
      : 0;
    const spreadOffset = index === 0 ? 0 : Math.ceil(index * 0.5) * (index % 2 ? 1 : -1);
    const slot = wallSlots[(targetIndex + spreadOffset + wallSlots.length) % Math.max(1, wallSlots.length)] || {
      x: building.x,
      y: building.y - building.height * tileSize * 0.5 + tileSize * 0.5
    };
    const mapWidth = Math.max(tileSize, finiteNumber(options.mapWidthPx, tileSize));
    const mapHeight = Math.max(tileSize, finiteNumber(options.mapHeightPx, tileSize));
    const clamp = typeof options.clamp === 'function'
      ? options.clamp
      : (value, min, max) => Math.max(min, Math.min(value, max));
    const clampedX = clamp(slot.x, tileSize * 0.5, mapWidth - tileSize * 0.5);
    const clampedY = clamp(slot.y, tileSize * 0.5, mapHeight - tileSize * 0.5);
    const isWalkablePoint = typeof options.isWalkablePoint === 'function'
      ? options.isWalkablePoint
      : () => true;
    if (isWalkablePoint(clampedX, clampedY, tileSize * 0.45)) {
      return { x: clampedX, y: clampedY, adjusted: false };
    }
    const findNearest = typeof options.findNearestWalkablePoint === 'function'
      ? options.findNearestWalkablePoint
      : null;
    return findNearest?.(clampedX, clampedY, tileSize * 0.45) || { x: clampedX, y: clampedY };
  }

  app.world.castleGeometry = Object.freeze({
    tileCenter,
    isPassageTile,
    isCourtyardPoint,
    isPointInside,
    getDoorPoints,
    getDoorApproach,
    routeIntoCastle,
    routeOutOfCastle,
    getWallSlots,
    getNearestWallSlotIndex,
    getRampPoints,
    getWallRoute,
    getStairPoint,
    describe() {
      return {
        schemaVersion: 1,
        methods: [
          'getDoorPoints',
          'routeIntoCastle',
          'routeOutOfCastle',
          'getWallSlots',
          'getRampPoints',
          'getStairPoint'
        ]
      };
    }
  });

  app.diagnostics?.register?.('castle-geometry', () => app.world.castleGeometry.describe());
})(globalThis);
