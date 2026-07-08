const tileSize = 32;
let MAP_ROWS = 34;
let MAP_COLS = 60;
let MAP_SEED = 0;
const worldRuntime = OpenRTS.world.runtime.configure({ tileSize, rows: MAP_ROWS, columns: MAP_COLS });

function registerWorldCollections() {
  const collections = [
    ['terrain', 'terrain tile rows'],
    ['obstacles', 'obstacle tile rows'],
    ['decorations', 'decoration tile rows'],
    ['heights', 'height tile rows'],
    ['sheep', 'wildlife sheep'],
    ['ducks', 'wildlife ducks'],
    ['horses', 'unmounted horses'],
    ['items', 'carryable world items'],
    ['goldMines', 'gold resource nodes'],
    ['houses', 'neutral garrisonable houses'],
    ['obstacleEntities', 'interactive obstacle entities'],
    ['obstacleEntityGrid', 'obstacle entity lookup grid'],
    ['buildings', 'team buildings']
  ];
  for (const [name, itemType] of collections) {
    worldRuntime.registerCollection(name, {
      itemType,
      description: `Authoritative ${itemType} collection.`
    });
  }
}

registerWorldCollections();

function replaceWorldCollection(name, value) {
  return worldRuntime.replace(name, value);
}

function worldRandom() {
  return OpenRTS.random.stream('world').next();
}

function wildlifeRandom() {
  return OpenRTS.random.stream('wildlife').next();
}

const TERRAIN = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  DIRT: 3
};

const OBSTACLE = {
  NONE: 0,
  TREE: 1,
  ROCK: 2,
  SHRUB: 3
};

const DECOR = {
  NONE: 0,
  COBBLE: 1,
  FLOWERS: 2,
  TUFT: 3,
  RUIN_WALL: 4,
  STANDARD: 5,
  HUT: 6,
  WELL: 7,
  HILL: 8,
  DITCH: 9,
  CLIFF: 10,
  RAMP: 11
};

const HEIGHT = {
  LOW: 0,
  GROUND: 1,
  HIGH: 2,
  RAMP: 3
};

const TILE = {
  WATER: TERRAIN.WATER,
  SAND: TERRAIN.SAND,
  GRASS: TERRAIN.GRASS,
  DIRT: TERRAIN.DIRT,
  TREE: OBSTACLE.TREE,
  ROCK: OBSTACLE.ROCK,
  SHRUB: OBSTACLE.SHRUB
};

const tileSprites = OpenRTS.world.mapSprites.createTileSprites({ ImageCtor: Image });

function hashNoise(x, y, seed = MAP_SEED) {
  return OpenRTS.world.terrain.hashNoise(x, y, seed);
}

function smoothValueNoise(x, y, scale) {
  return OpenRTS.world.terrain.smoothValueNoise(x, y, scale, MAP_SEED);
}

function fbmNoise(x, y) {
  return OpenRTS.world.terrain.fbmNoise(x, y, MAP_SEED);
}

function terrainName(terrainType) {
  if (terrainType === TERRAIN.GRASS) return 'grass';
  if (terrainType === TERRAIN.SAND) return 'sand';
  if (terrainType === TERRAIN.DIRT) return 'dirt';
  return 'water';
}

function isVolcanicTerrain() {
  return (window.mapConfig || mapConfig || {}).mapStyle === 'volcanic_lava';
}

function currentTerrainVisualStyle(config = window.mapConfig || mapConfig || {}) {
  return String(config.visualStyle || config.mapStyle || '').toLowerCase();
}

function isArabiaLikeMap(config = window.mapConfig || mapConfig || {}) {
  return config.mapStyle === 'eok_arabia';
}

function arabiaCornerRatios() {
  return [
    [0.18, 0.22],
    [0.82, 0.22],
    [0.18, 0.78],
    [0.82, 0.78]
  ];
}

function arabiaStartRatios(teamIndex = 0, teamCount = 2) {
  const corners = arabiaCornerRatios();
  const pair = (MAP_SEED % 2) === 0 ? [0, 3] : [1, 2];
  if (teamCount === 2) return corners[pair[teamIndex % 2]];
  return corners[(MAP_SEED + teamIndex) % corners.length];
}

function isNearArabiaStart(tileX, tileY, radius = 8) {
  if (!isArabiaLikeMap()) return false;
  return arabiaCornerRatios().some(([rx, ry]) => {
    const sx = rx * MAP_COLS;
    const sy = ry * MAP_ROWS;
    return Math.hypot(tileX - sx, tileY - sy) <= radius;
  });
}

function generateTerrainTile(x, y) {
  return OpenRTS.world.terrain.typeAt(x + 0.5, y + 0.5, {
    seed: MAP_SEED,
    thresholds: mapConfig.terrain,
    types: TERRAIN
  });
}

function generateVisualTerrainType(worldX, worldY) {
  return OpenRTS.world.terrain.typeAt(worldX / tileSize, worldY / tileSize, {
    seed: MAP_SEED,
    thresholds: mapConfig.terrain,
    types: TERRAIN
  });
}

function shuffleArray(arr) {
  return OpenRTS.random.stream('world').shuffle(arr);
}

// Placeholder arrays - will be regenerated when game starts
let terrainData = replaceWorldCollection('terrain', []);
let obstacleData = replaceWorldCollection('obstacles', []);
let decorationData = replaceWorldCollection('decorations', []);
let heightData = replaceWorldCollection('heights', []);
let sheepData = replaceWorldCollection('sheep', []);
let duckData = replaceWorldCollection('ducks', []);
let horseData = replaceWorldCollection('horses', []);
let itemData = replaceWorldCollection('items', []);
let goldMineData = replaceWorldCollection('goldMines', []);
let houseData = replaceWorldCollection('houses', []);
let nextWildlifeId = 1;
let nextWorldItemId = 1;
let nextGoldMineId = 1;
let nextHouseId = 1;
let goldMineRevision = 0;
let houseRevision = 0;
let obstacleEntityData = replaceWorldCollection('obstacleEntities', []);
let obstacleEntityGrid = replaceWorldCollection('obstacleEntityGrid', []);
let obstacleRevision = 0;
let selectedWorldObject = null;
var buildingData = replaceWorldCollection('buildings', []);
var nextBuildingId = 1;
let terrainRenderCanvas = null;
let terrainRenderCtx = null;
let terrainVisualCellSize = 2;
let terrainVisualCols = 0;
let terrainVisualTypes = [];
let navigationService = null;

function getNavigationService() {
  if (!navigationService) {
    navigationService = OpenRTS.world.navigation.createNavigationService({
      tileSize,
      terrainTypes: TERRAIN,
      obstacleTypes: OBSTACLE,
      decorTypes: DECOR,
      heightLevels: HEIGHT,
      getTerrainData: () => terrainData,
      getObstacleData: () => obstacleData,
      getDecorationData: () => decorationData,
      getHeightData: () => heightData,
      isTileBlockedByBuilding,
      isVisualLandPoint,
      getMapWidthPx,
      getMapHeightPx
    });
  }
  return navigationService;
}

function mapSizeDimensions(sizeId) {
  if (sizeId === '1v1') return { rows: 68, columns: 120 };
  if (sizeId === '2v2') return { rows: 78, columns: 120 };
  if (sizeId === '3v3') return { rows: 80, columns: 120 };
  if (sizeId === '4v4') return { rows: 80, columns: 120 };
  if (sizeId === 'default_large') return { rows: 68, columns: 120 };
  if (sizeId === 'small') return { rows: 26, columns: 44 };
  if (sizeId === 'large') return { rows: 46, columns: 82 };
  return { rows: 34, columns: 60 };
}

function generatedStartRatios(sizeId = '1v1') {
  const starts = {
    '1v1': [[0.18, 0.5], [0.82, 0.5]],
    '2v2': [[0.18, 0.28], [0.82, 0.72], [0.18, 0.72], [0.82, 0.28]],
    '3v3': [[0.16, 0.25], [0.84, 0.75], [0.16, 0.75], [0.84, 0.25], [0.5, 0.18], [0.5, 0.82]],
    '4v4': [[0.14, 0.22], [0.86, 0.78], [0.14, 0.78], [0.86, 0.22], [0.5, 0.14], [0.5, 0.86], [0.24, 0.5], [0.76, 0.5]]
  };
  return starts[sizeId] || starts['1v1'];
}

function generatedStartRatio(teamIndex = 0, teamCount = 2, config = window.mapConfig || mapConfig || {}) {
  const slots = generatedStartRatios(config.generatedMapSize || config.mapSize || '1v1');
  const count = Math.max(1, Math.floor(Number(teamCount) || 1));
  if (count >= slots.length) return slots[(teamIndex + MAP_SEED) % slots.length];
  if (count === 2 && slots.length >= 4) {
    const offset = MAP_SEED % slots.length;
    const pair = [offset, (offset + Math.floor(slots.length / 2)) % slots.length];
    return slots[pair[teamIndex % 2]];
  }
  const step = slots.length / count;
  const offset = MAP_SEED % slots.length;
  return slots[Math.floor(offset + teamIndex * step) % slots.length];
}

function shouldUseGeneratedStartRatios(config = window.mapConfig || mapConfig || {}) {
  if (config.loadedMap) return false;
  if (config.modeId === 'unit_comparison' || config.modeId === 'map_builder') return false;
  if (config.generatedMapSize) return true;
  if (['1v1', '2v2', '3v3', '4v4', 'default_large'].includes(config.mapSize)) return true;
  return config.modeId === 'versus';
}

function getTeamStartRatio(teamIndex = 0, teamCount = 2, config = window.mapConfig || mapConfig || {}) {
  if (isArabiaLikeMap(config)) return arabiaStartRatios(teamIndex, teamCount);
  if (shouldUseGeneratedStartRatios(config)) return generatedStartRatio(teamIndex, teamCount, config);
  return null;
}

function getGeneratedStartPoint(teamIndex = 0, teamCount = 2, config = window.mapConfig || mapConfig || {}) {
  const ratio = getTeamStartRatio(teamIndex, teamCount, config);
  if (!ratio) return null;
  const [rx, ry] = ratio;
  return { x: rx * getMapWidthPx(), y: ry * getMapHeightPx(), ratio: [rx, ry] };
}

function configureMapDimensions(config = window.mapConfig || mapConfig || {}) {
  const loaded = config.loadedMap && typeof config.loadedMap === 'object' ? config.loadedMap : null;
  const saved = loaded?.rows && loaded?.columns
    ? { rows: loaded.rows, columns: loaded.columns }
    : mapSizeDimensions(config.mapBuilderSize || config.mapSize || 'medium');
  MAP_ROWS = Math.max(16, Math.min(80, Math.floor(Number(saved.rows) || 34)));
  MAP_COLS = Math.max(24, Math.min(120, Math.floor(Number(saved.columns) || 60)));
  worldRuntime.configure({ tileSize, rows: MAP_ROWS, columns: MAP_COLS });
}

function computeTerrainThresholds() {
  mapConfig.terrain = OpenRTS.world.terrain.computeThresholds({
    rows: MAP_ROWS,
    columns: MAP_COLS,
    waterLevel: mapConfig.waterLevel,
    seed: MAP_SEED
  });
}

function applyGeneratedLandscapeLayout() {
  const landscape = String(mapConfig.generatedLandscape || '').toLowerCase();
  if (!landscape || mapConfig.loadedMap || isArabiaLikeMap()) return;

  const paintDisc = (centerX, centerY, radius, terrainType, decorationType = null, heightType = null) => {
    for (let y = Math.max(1, centerY - radius); y <= Math.min(MAP_ROWS - 2, centerY + radius); y++) {
      for (let x = Math.max(1, centerX - radius); x <= Math.min(MAP_COLS - 2, centerX + radius); x++) {
        const dist = Math.hypot(x - centerX, y - centerY);
        if (dist > radius * (0.78 + hashNoise(x + centerX, y + centerY) * 0.28)) continue;
        if (terrainType !== null) terrainData[y][x] = terrainType;
        if (decorationType !== null) decorationData[y][x] = decorationType;
        if (heightType !== null) heightData[y][x] = heightType;
      }
    }
  };

  const paintOvalLake = (centerX, centerY, radiusX, radiusY, rotation = 0) => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const reach = Math.ceil(Math.max(radiusX, radiusY) * 1.22);
    for (let y = Math.max(1, centerY - reach); y <= Math.min(MAP_ROWS - 2, centerY + reach); y++) {
      for (let x = Math.max(1, centerX - reach); x <= Math.min(MAP_COLS - 2, centerX + reach); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const rx = (dx * cos + dy * sin) / Math.max(1, radiusX);
        const ry = (-dx * sin + dy * cos) / Math.max(1, radiusY);
        const normalized = rx * rx + ry * ry;
        const edgeNoise = (smoothValueNoise(x + centerX * 3, y + centerY * 5, 5) - 0.5) * 0.16;
        if (normalized <= 1 + edgeNoise) {
          terrainData[y][x] = TERRAIN.WATER;
        } else if (normalized <= 1.22 + edgeNoise && terrainData[y][x] !== TERRAIN.WATER) {
          terrainData[y][x] = TERRAIN.SAND;
        }
      }
    }
  };

  if (landscape === 'ocean') {
    const shore = Math.max(4, Math.floor(Math.min(MAP_ROWS, MAP_COLS) * 0.1));
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const edgeDist = Math.min(x, y, MAP_COLS - 1 - x, MAP_ROWS - 1 - y);
        if (edgeDist < shore * (0.65 + hashNoise(x + 101, y + 303) * 0.7)) terrainData[y][x] = TERRAIN.WATER;
      }
    }
  }

  if (landscape === 'lakes' || landscape === 'swamp') {
    const lakes = landscape === 'swamp' ? 8 : 5;
    for (let i = 0; i < lakes; i++) {
      const radius = Math.max(4, Math.floor(Math.min(MAP_ROWS, MAP_COLS) * (0.06 + hashNoise(i + 91, MAP_SEED + 7) * 0.05)));
      paintOvalLake(
        Math.floor((0.18 + hashNoise(i + 17, MAP_SEED + 41) * 0.64) * MAP_COLS),
        Math.floor((0.18 + hashNoise(i + 53, MAP_SEED + 79) * 0.64) * MAP_ROWS),
        radius * (1.15 + hashNoise(i + 137, MAP_SEED + 19) * 0.65),
        radius * (0.72 + hashNoise(i + 173, MAP_SEED + 23) * 0.46),
        hashNoise(i + 211, MAP_SEED + 31) * Math.PI
      );
    }
  }

  if (landscape === 'hilly' || landscape === 'cliffs') {
    const ridges = landscape === 'cliffs' ? 7 : 5;
    for (let i = 0; i < ridges; i++) {
      const cx = Math.floor((0.12 + hashNoise(i + 211, MAP_SEED + 17) * 0.76) * MAP_COLS);
      const cy = Math.floor((0.12 + hashNoise(i + 419, MAP_SEED + 23) * 0.76) * MAP_ROWS);
      const radius = Math.max(5, Math.floor(Math.min(MAP_ROWS, MAP_COLS) * (landscape === 'cliffs' ? 0.075 : 0.095)));
      paintDisc(cx, cy, radius, null, landscape === 'cliffs' ? DECOR.CLIFF : DECOR.HILL, HEIGHT.HIGH);
    }
  }
}

function getMostCommonNeighborTerrain(x, y, fallback = TERRAIN.GRASS) {
  const counts = new Map();
  for (let yy = y - 1; yy <= y + 1; yy++) {
    for (let xx = x - 1; xx <= x + 1; xx++) {
      if (xx === x && yy === y) continue;
      if (!isInsideMap(xx, yy)) continue;
      const terrainType = terrainData[yy][xx];
      if (terrainType === TERRAIN.WATER) continue;
      counts.set(terrainType, (counts.get(terrainType) || 0) + 1);
    }
  }
  let best = fallback;
  let bestCount = -1;
  for (const [terrainType, count] of counts.entries()) {
    if (count > bestCount) {
      best = terrainType;
      bestCount = count;
    }
  }
  return best;
}

function smoothWaterBodies(iterations = 2) {
  if (!terrainData.length || mapConfig.loadedMap) return;
  for (let pass = 0; pass < iterations; pass++) {
    const next = terrainData.map(row => [...row]);
    for (let y = 1; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        let waterNeighbors = 0;
        let cardinalWater = 0;
        for (let yy = y - 1; yy <= y + 1; yy++) {
          for (let xx = x - 1; xx <= x + 1; xx++) {
            if (xx === x && yy === y) continue;
            if (terrainData[yy][xx] !== TERRAIN.WATER) continue;
            waterNeighbors++;
            if (Math.abs(xx - x) + Math.abs(yy - y) === 1) cardinalWater++;
          }
        }
        const isWater = terrainData[y][x] === TERRAIN.WATER;
        if (isWater && (waterNeighbors <= 2 || cardinalWater <= 1)) {
          next[y][x] = getMostCommonNeighborTerrain(x, y, TERRAIN.SAND);
        } else if (!isWater && (waterNeighbors >= 6 || (waterNeighbors >= 5 && cardinalWater >= 3))) {
          next[y][x] = TERRAIN.WATER;
        }
      }
    }
    terrainData = replaceWorldCollection('terrain', next);
  }
}

function applyArabiaTerrainLayout() {
  if (!isArabiaLikeMap()) return;

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const patch = smoothValueNoise(x + 33, y + 91, 9);
      const scrub = smoothValueNoise(x + 207, y + 411, 18);
      const startSafe = isNearArabiaStart(x, y, 7);
      terrainData[y][x] = patch > 0.66 || scrub > 0.82 ? TERRAIN.GRASS : TERRAIN.SAND;
      if (startSafe && hashNoise(x + 17, y + 29) > 0.74) terrainData[y][x] = TERRAIN.GRASS;
    }
  }

  const hills = [
    [0.5, 0.5, 6],
    [0.36, 0.28, 4],
    [0.64, 0.72, 4],
    [0.32, 0.68, 4],
    [0.68, 0.32, 4]
  ];

  for (const [rx, ry, radius] of hills) {
    const cx = Math.floor(rx * MAP_COLS);
    const cy = Math.floor(ry * MAP_ROWS);
    for (let y = Math.max(1, cy - radius); y <= Math.min(MAP_ROWS - 2, cy + radius); y++) {
      for (let x = Math.max(1, cx - radius); x <= Math.min(MAP_COLS - 2, cx + radius); x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius || isNearArabiaStart(x, y, 6)) continue;
        heightData[y][x] = dist > radius - 1.2 ? HEIGHT.RAMP : HEIGHT.HIGH;
        if (dist < radius - 1.5 && hashNoise(x + 509, y + 701) > 0.62) decorationData[y][x] = DECOR.HILL;
        if (terrainData[y][x] !== TERRAIN.GRASS && hashNoise(x + 719, y + 811) > 0.58) terrainData[y][x] = TERRAIN.DIRT;
      }
    }
  }
}

function clearArabiaStartAreas() {
  if (!isArabiaLikeMap()) return;
  for (const [rx, ry] of arabiaCornerRatios()) {
    const sx = Math.floor(rx * MAP_COLS);
    const sy = Math.floor(ry * MAP_ROWS);
    for (let y = Math.max(1, sy - 7); y <= Math.min(MAP_ROWS - 2, sy + 7); y++) {
      for (let x = Math.max(1, sx - 7); x <= Math.min(MAP_COLS - 2, sx + 7); x++) {
        if (Math.hypot(x - sx, y - sy) > 7) continue;
        obstacleData[y][x] = OBSTACLE.NONE;
        decorationData[y][x] = DECOR.NONE;
        heightData[y][x] = HEIGHT.GROUND;
        if (terrainData[y][x] !== TERRAIN.GRASS) terrainData[y][x] = TERRAIN.SAND;
      }
    }
  }
}

function paintArabiaCluster(centerX, centerY, radius, obstacleType, density = 0.75) {
  for (let y = Math.max(1, centerY - radius); y <= Math.min(MAP_ROWS - 2, centerY + radius); y++) {
    for (let x = Math.max(1, centerX - radius); x <= Math.min(MAP_COLS - 2, centerX + radius); x++) {
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist > radius || isNearArabiaStart(x, y, 7)) continue;
      const falloff = 1 - dist / Math.max(1, radius);
      if (hashNoise(x + centerX * 13, y + centerY * 17) > density * falloff + 0.25) continue;
      if (terrainData[y][x] === TERRAIN.WATER) continue;
      if (obstacleType === OBSTACLE.TREE) terrainData[y][x] = TERRAIN.GRASS;
      obstacleData[y][x] = obstacleType;
      decorationData[y][x] = DECOR.NONE;
    }
  }
}

function applyArabiaObjectLayout() {
  if (!isArabiaLikeMap()) return;

  clearArabiaStartAreas();

  const forestAnchors = [
    [0.16, 0.5, 5],
    [0.84, 0.5, 5],
    [0.5, 0.18, 5],
    [0.5, 0.82, 5],
    [0.34, 0.44, 4],
    [0.66, 0.56, 4]
  ];
  for (const [rx, ry, radius] of forestAnchors) {
    paintArabiaCluster(Math.floor(rx * MAP_COLS), Math.floor(ry * MAP_ROWS), radius, OBSTACLE.TREE, 0.42);
  }

  const stoneAnchors = [
    [0.28, 0.26, 3],
    [0.72, 0.74, 3],
    [0.3, 0.72, 3],
    [0.7, 0.28, 3],
    [0.5, 0.42, 3],
    [0.5, 0.58, 3]
  ];
  for (const [rx, ry, radius] of stoneAnchors) {
    paintArabiaCluster(Math.floor(rx * MAP_COLS), Math.floor(ry * MAP_ROWS), radius, OBSTACLE.ROCK, 0.5);
  }

  clearArabiaStartAreas();
}

function regenerateMapData() {
  configureMapDimensions(mapConfig);
  const seed = mapConfig.seed ?? OpenRTS.random.generateSeed();
  mapConfig.seed = seed;
  MAP_SEED = OpenRTS.random.setSeed(seed);
  worldRuntime.beginGeneration(MAP_SEED);
  clearWorldObjectSelection();
  // Step 1: Compute accurate percentile-based terrain thresholds
  computeTerrainThresholds();

  // Step 2: Generate terrain
  terrainData = replaceWorldCollection('terrain', OpenRTS.world.terrain.generateGrid({
    rows: MAP_ROWS,
    columns: MAP_COLS,
    seed: MAP_SEED,
    thresholds: mapConfig.terrain,
    types: TERRAIN
  }));

  // Step 2: Initialize empty obstacle grid
  obstacleData = replaceWorldCollection('obstacles', Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => OBSTACLE.NONE)
  ));

  decorationData = replaceWorldCollection('decorations', Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => DECOR.NONE)
  ));

  heightData = replaceWorldCollection('heights', Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => HEIGHT.GROUND)
  ));

  applyGeneratedLandscapeLayout();
  applyArabiaTerrainLayout();
  smoothWaterBodies();

  // Step 3: Collect candidate tiles
  const treeCandidates = [];  // trees go on grass only
  const rockCandidates = [];  // rocks go on grass, sand, or water

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const t = terrainData[y][x];
      if (t === TERRAIN.GRASS) {
        treeCandidates.push({ x, y });
        rockCandidates.push({ x, y });
      } else if (t === TERRAIN.SAND || t === TERRAIN.WATER) {
        rockCandidates.push({ x, y });
      }
    }
  }

  // Step 4: Shuffle for random placement, then place exact counts
  shuffleArray(treeCandidates);
  shuffleArray(rockCandidates);

  const treeCount = Math.min(mapConfig.treeCount, treeCandidates.length);
  const rockCount = Math.min(mapConfig.rockCount, rockCandidates.length);

  for (let i = 0; i < treeCount; i++) {
    const { x, y } = treeCandidates[i];
    obstacleData[y][x] = OBSTACLE.TREE;
  }

  // Place rocks, skipping tiles already occupied by a tree
  let placed = 0;
  for (let i = 0; i < rockCandidates.length && placed < rockCount; i++) {
    const { x, y } = rockCandidates[i];
    if (obstacleData[y][x] === OBSTACLE.NONE) {
      obstacleData[y][x] = OBSTACLE.ROCK;
      placed++;
    }
  }

  applyArabiaObjectLayout();

  nextWildlifeId = 1;
  seedDecorations();
  seedSheep();
  OpenRTS.systems.cooking.reset();
  seedDucks();
  seedGoldMines();
  seedHouses();
  horseData = replaceWorldCollection('horses', []);
  window.horseData = horseData;
  itemData = replaceWorldCollection('items', []);
  nextWorldItemId = 1;
  window.itemData = itemData;
  rebuildObstacleEntities();
  buildingData = replaceWorldCollection('buildings', []);
  nextBuildingId = 1;
  applyLoadedMapData(mapConfig.loadedMap);
  buildTerrainRenderCache();
  OpenRTS.events.emit(OpenRTS.events.types.WORLD_REGENERATED, {
    seed: MAP_SEED,
    rows: MAP_ROWS,
    columns: MAP_COLS,
    generation: worldRuntime.generation
  });
}

function applyLoadedMapData(savedMap) {
  if (!savedMap || typeof savedMap !== 'object') return false;
  if (!Array.isArray(savedMap.terrain) || !Array.isArray(savedMap.obstacles) || !Array.isArray(savedMap.decorations)) return false;
  if (savedMap.terrain.length !== MAP_ROWS || savedMap.terrain[0]?.length !== MAP_COLS) return false;

  terrainData = replaceWorldCollection('terrain', savedMap.terrain.map(row => row.map(value => Number(value) || TERRAIN.GRASS)));
  obstacleData = replaceWorldCollection('obstacles', savedMap.obstacles.map(row => row.map(value => Number(value) || OBSTACLE.NONE)));
  decorationData = replaceWorldCollection('decorations', savedMap.decorations.map(row => row.map(value => Number(value) || DECOR.NONE)));
  const loadedHeights = Array.isArray(savedMap.heights) && savedMap.heights.length === MAP_ROWS && savedMap.heights[0]?.length === MAP_COLS
    ? savedMap.heights
    : Array.from({ length: MAP_ROWS }, () => Array.from({ length: MAP_COLS }, () => HEIGHT.GROUND));
  heightData = replaceWorldCollection('heights', loadedHeights.map(row => row.map(value => {
    const parsed = Number(value);
    return Object.values(HEIGHT).includes(parsed) ? parsed : HEIGHT.GROUND;
  })));
  houseData = replaceWorldCollection('houses', []);
  nextHouseId = 1;
  for (const source of Array.isArray(savedMap.houses) ? savedMap.houses : []) {
    const tileX = Math.max(0, Math.min(MAP_COLS - 2, Math.floor(Number(source.tileX) || 0)));
    const tileY = Math.max(0, Math.min(MAP_ROWS - 2, Math.floor(Number(source.tileY) || 0)));
    houseData.push(createNeutralHouse(tileX, tileY));
  }
  window.houseData = houseData;
  houseRevision++;
  rebuildObstacleEntities();
  return true;
}

function touchEditedMap() {
  obstacleRevision++;
  houseRevision++;
  buildTerrainRenderCache();
}

function paintMapBuilderTile(worldX, worldY, tool) {
  const result = OpenRTS.world.mapBuilderRuntime.paintTile(worldX, worldY, {
    tool,
    tileSize,
    terrain: TERRAIN,
    obstacle: OBSTACLE,
    decor: DECOR,
    height: HEIGHT,
    terrainData,
    obstacleData,
    decorationData,
    heightData,
    houses: houseData,
    columns: MAP_COLS,
    rows: MAP_ROWS,
    createHouse: createNeutralHouse,
    isInsideMap,
    replaceHouses(nextHouses) {
      houseData = replaceWorldCollection('houses', nextHouses);
      window.houseData = houseData;
    },
    rebuildObstacles: rebuildObstacleEntities,
    touchEditedMap
  });
  return !!result.changed;
}

function exportCurrentMapData(name = 'Custom Map') {
  return OpenRTS.world.mapBuilderRuntime.exportMap({
    id: `map-${Date.now()}`,
    name,
    rows: MAP_ROWS,
    columns: MAP_COLS,
    tileSize,
    terrainData,
    obstacleData,
    decorationData,
    heightData,
    houses: houseData
  });
}

function createNeutralHouse(tileX, tileY) {
  const center = tileCenter(tileX, tileY);
  return OpenRTS.world.objectFactories.houses.createNeutralHouse({
    id: `house-${nextHouseId++}`,
    tileX,
    tileY,
    x: center.x,
    y: center.y,
    tileSize,
    onDestroyed: burnHouseNow
  });
}

function seedHouses() {
  houseData = replaceWorldCollection('houses', []);
  nextHouseId = 1;
  const desired = Math.max(0, Math.floor(Number(mapConfig.houseCount) || 0));
  const candidates = [];
  for (let y = 2; y < MAP_ROWS - 3; y++) {
    for (let x = 2; x < MAP_COLS - 3; x++) {
      let clear = true;
      for (let yy = y; yy < y + 2 && clear; yy++) {
        for (let xx = x; xx < x + 2; xx++) {
          if (terrainData[yy][xx] === TERRAIN.WATER || obstacleData[yy][xx] !== OBSTACLE.NONE) clear = false;
        }
      }
      if (clear) candidates.push({ x, y });
    }
  }
  shuffleArray(candidates);
  for (const site of candidates) {
    if (houseData.length >= desired) break;
    if (houseData.some(house => Math.hypot(house.tileX - site.x, house.tileY - site.y) < 7)) continue;
    houseData.push(createNeutralHouse(site.x, site.y));
  }
  houseRevision++;
  window.houseData = houseData;
}

function createGoldMine(tileX, tileY) {
  const center = tileCenter(tileX, tileY);
  const amount = 800 + Math.floor(hashNoise(tileX + 19, tileY + 31) * 300);
  return OpenRTS.world.objectFactories.resources.createGoldMine({
    id: `goldmine-${nextGoldMineId++}`,
    tileX,
    tileY,
    x: center.x,
    y: center.y,
    tileSize,
    amount,
    onChanged: markGoldMinesDirty
  });
}

function seedGoldMines() {
  goldMineData = replaceWorldCollection('goldMines', []);
  nextGoldMineId = 1;
  const desired = Math.max(0, Math.floor(Number(mapConfig.goldMineCount) || 5));
  const anchors = isArabiaLikeMap() ? [
    { x: 0.25, y: 0.24 },
    { x: 0.75, y: 0.76 },
    { x: 0.25, y: 0.76 },
    { x: 0.75, y: 0.24 },
    { x: 0.5, y: 0.34 },
    { x: 0.5, y: 0.66 },
    { x: 0.36, y: 0.5 },
    { x: 0.64, y: 0.5 }
  ] : [
    { x: 0.24, y: 0.32 },
    { x: 0.24, y: 0.68 },
    { x: 0.76, y: 0.32 },
    { x: 0.76, y: 0.68 },
    { x: 0.5, y: 0.22 },
    { x: 0.5, y: 0.78 }
  ];

  for (let i = 0; i < desired; i++) {
    const anchor = anchors[i % anchors.length];
    const preferredX = Math.floor(anchor.x * MAP_COLS);
    const preferredY = Math.floor(anchor.y * MAP_ROWS);
    let best = null;
    let bestScore = Infinity;
    for (let y = 2; y < MAP_ROWS - 2; y++) {
      for (let x = 2; x < MAP_COLS - 2; x++) {
        if (terrainData[y][x] === TERRAIN.WATER) continue;
        if (obstacleData[y][x] !== OBSTACLE.NONE) continue;
        const tooClose = goldMineData.some(mine => Math.hypot(mine.tileX - x, mine.tileY - y) < 10);
        if (tooClose) continue;
        const score = Math.hypot(x - preferredX, y - preferredY) + hashNoise(x + i * 47, y + i * 83) * 3;
        if (score < bestScore) {
          best = { x, y };
          bestScore = score;
        }
      }
    }
    if (best) goldMineData.push(createGoldMine(best.x, best.y));
  }

  goldMineRevision++;
  window.goldMineData = goldMineData;
}

function terrainBaseColor(terrainType, shade) {
  const style = currentTerrainVisualStyle();

  if (isVolcanicTerrain()) {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(224 + shade * 20)}, ${Math.round(68 + shade * 18)}, ${Math.round(18 + shade * 8)})`;
    }

    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(74 + shade * 18)}, ${Math.round(69 + shade * 16)}, ${Math.round(63 + shade * 14)})`;
    }

    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(47 + shade * 16)}, ${Math.round(45 + shade * 14)}, ${Math.round(43 + shade * 12)})`;
    }

    return `rgb(${Math.round(58 + shade * 22)}, ${Math.round(60 + shade * 20)}, ${Math.round(58 + shade * 18)})`;
  }

  if (style === 'muddy_badlands') {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(61 + shade * 12)}, ${Math.round(70 + shade * 10)}, ${Math.round(58 + shade * 8)})`;
    }
    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(126 + shade * 18)}, ${Math.round(103 + shade * 13)}, ${Math.round(74 + shade * 10)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(77 + shade * 15)}, ${Math.round(61 + shade * 11)}, ${Math.round(47 + shade * 9)})`;
    }
    return `rgb(${Math.round(96 + shade * 18)}, ${Math.round(84 + shade * 14)}, ${Math.round(65 + shade * 10)})`;
  }

  if (style === 'industrial_desert' || style === 'desert_raid') {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(87 + shade * 10)}, ${Math.round(110 + shade * 12)}, ${Math.round(106 + shade * 10)})`;
    }
    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(199 + shade * 20)}, ${Math.round(164 + shade * 17)}, ${Math.round(96 + shade * 11)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(137 + shade * 18)}, ${Math.round(102 + shade * 13)}, ${Math.round(61 + shade * 9)})`;
    }
    return `rgb(${Math.round(167 + shade * 20)}, ${Math.round(145 + shade * 16)}, ${Math.round(84 + shade * 11)})`;
  }

  if (style === 'metal_wasteland') {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(57 + shade * 12)}, ${Math.round(93 + shade * 16)}, ${Math.round(104 + shade * 18)})`;
    }
    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(99 + shade * 16)}, ${Math.round(104 + shade * 16)}, ${Math.round(105 + shade * 15)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(61 + shade * 12)}, ${Math.round(66 + shade * 12)}, ${Math.round(70 + shade * 12)})`;
    }
    return `rgb(${Math.round(79 + shade * 16)}, ${Math.round(88 + shade * 16)}, ${Math.round(91 + shade * 16)})`;
  }

  if (style === 'fantasy_forest') {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(48 + shade * 12)}, ${Math.round(116 + shade * 22)}, ${Math.round(126 + shade * 20)})`;
    }
    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(166 + shade * 18)}, ${Math.round(154 + shade * 15)}, ${Math.round(91 + shade * 9)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(92 + shade * 16)}, ${Math.round(76 + shade * 12)}, ${Math.round(43 + shade * 8)})`;
    }
    return `rgb(${Math.round(49 + shade * 21)}, ${Math.round(127 + shade * 35)}, ${Math.round(50 + shade * 20)})`;
  }

  if (style === 'temperate_kingdom') {
    if (terrainType === TERRAIN.WATER) {
      return `rgb(${Math.round(60 + shade * 12)}, ${Math.round(128 + shade * 22)}, ${Math.round(151 + shade * 22)})`;
    }
    if (terrainType === TERRAIN.SAND) {
      return `rgb(${Math.round(190 + shade * 19)}, ${Math.round(174 + shade * 16)}, ${Math.round(111 + shade * 11)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(112 + shade * 18)}, ${Math.round(88 + shade * 13)}, ${Math.round(52 + shade * 9)})`;
    }
    return `rgb(${Math.round(65 + shade * 24)}, ${Math.round(139 + shade * 34)}, ${Math.round(61 + shade * 22)})`;
  }

  if (terrainType === TERRAIN.WATER) {
    const blue = Math.round(103 + shade * 22);
    return `rgb(${Math.round(47 + shade * 12)}, ${Math.round(112 + shade * 22)}, ${blue + 35})`;
  }

  if (isArabiaLikeMap()) {
    if (terrainType === TERRAIN.GRASS) {
      return `rgb(${Math.round(105 + shade * 24)}, ${Math.round(139 + shade * 28)}, ${Math.round(63 + shade * 18)})`;
    }
    if (terrainType === TERRAIN.DIRT) {
      return `rgb(${Math.round(176 + shade * 20)}, ${Math.round(143 + shade * 17)}, ${Math.round(82 + shade * 12)})`;
    }
    return `rgb(${Math.round(205 + shade * 24)}, ${Math.round(181 + shade * 20)}, ${Math.round(103 + shade * 13)})`;
  }

  if (terrainType === TERRAIN.SAND) {
    return `rgb(${Math.round(211 + shade * 22)}, ${Math.round(190 + shade * 18)}, ${Math.round(111 + shade * 12)})`;
  }

  if (terrainType === TERRAIN.DIRT) {
    return `rgb(${Math.round(120 + shade * 20)}, ${Math.round(86 + shade * 14)}, ${Math.round(48 + shade * 10)})`;
  }

  return `rgb(${Math.round(45 + shade * 28)}, ${Math.round(111 + shade * 34)}, ${Math.round(48 + shade * 24)})`;
}

function drawCachedTerrainCell(cacheCtx, terrainType, x, y, size) {
  const fine = hashNoise(Math.floor(x * 0.7) + 911, Math.floor(y * 0.7) + 353) - 0.5;
  const broad = smoothValueNoise(x, y, 96) - 0.5;
  const shade = broad * 0.7 + fine * 0.42;

  cacheCtx.fillStyle = terrainBaseColor(terrainType, shade);
  cacheCtx.fillRect(x, y, size, size);

  if (terrainType === TERRAIN.GRASS && fine > 0.22) {
    cacheCtx.fillStyle = isVolcanicTerrain() ? 'rgba(170, 160, 145, 0.08)' : 'rgba(208, 189, 98, 0.1)';
    cacheCtx.fillRect(x, y, size, size);
  }

  if (terrainType === TERRAIN.WATER && fine > 0.18) {
    cacheCtx.fillStyle = isVolcanicTerrain() ? 'rgba(255, 205, 68, 0.22)' : 'rgba(166, 212, 229, 0.11)';
    cacheCtx.fillRect(x, y, size, Math.max(1, size * 0.5));
  }

  if (terrainType === TERRAIN.SAND && fine > 0.1) {
    cacheCtx.fillStyle = isVolcanicTerrain()
      ? (fine > 0.28 ? 'rgba(20, 18, 17, 0.18)' : 'rgba(145, 135, 120, 0.08)')
      : fine > 0.28
      ? 'rgba(115, 83, 42, 0.13)'
      : 'rgba(255, 238, 173, 0.12)';
    cacheCtx.fillRect(x, y, size, size);
  }
}

function buildTerrainRenderCache() {
  const width = getMapWidthPx();
  const height = getMapHeightPx();
  const cellSize = terrainVisualCellSize;
  terrainVisualCols = Math.ceil(width / cellSize);
  terrainVisualTypes = [];

  terrainRenderCanvas = document.createElement('canvas');
  terrainRenderCanvas.width = width;
  terrainRenderCanvas.height = height;

  const cacheCtx = terrainRenderCanvas.getContext('2d', { willReadFrequently: true });
  terrainRenderCtx = cacheCtx;
  cacheCtx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const terrainType = generateVisualTerrainType(x + cellSize * 0.5, y + cellSize * 0.5);
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      terrainVisualTypes[cellY * terrainVisualCols + cellX] = terrainType;
      drawCachedTerrainCell(cacheCtx, terrainType, x, y, cellSize);
    }
  }

  for (let y = 0; y < terrainData.length; y++) {
    for (let x = 0; x < terrainData[y].length; x++) {
      OpenRTS.rendering.canvas.terrainPainter.drawTransitions(cacheCtx, x, y, terrainData[y][x], x * tileSize, y * tileSize, {
        terrain: TERRAIN,
        terrainData,
        tileSize,
        isInsideMap,
        noise: hashNoise,
        volcanic: isVolcanicTerrain()
      });
    }
  }

  cacheCtx.save();
  cacheCtx.globalAlpha = 0.08;
  cacheCtx.fillStyle = '#f5deb0';
  for (let i = 0; i < width * height / 420; i++) {
    const x = Math.floor(hashNoise(i + 17, MAP_SEED + 3) * width);
    const y = Math.floor(hashNoise(i + 53, MAP_SEED + 11) * height);
    cacheCtx.fillRect(x, y, 1, 1);
  }
  cacheCtx.restore();
}

function seedDecorations() {
  const centerY = Math.floor(MAP_ROWS * 0.5);
  const centerX = Math.floor(MAP_COLS * 0.5);

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      if (obstacleData[y][x] !== OBSTACLE.NONE) continue;

      const terrain = terrainData[y][x];
      const roadNoise = Math.abs(y - centerY - Math.sin(x * 0.23) * 2.1);
      const crossNoise = Math.abs(x - centerX - Math.cos(y * 0.19) * 1.8);

      if (terrain !== TERRAIN.WATER && (roadNoise < 0.55 || crossNoise < 0.42)) {
        decorationData[y][x] = DECOR.COBBLE;
        continue;
      }

      if (terrain === TERRAIN.GRASS) {
        const n = hashNoise(x + 193, y + 607);
        if (n > 0.988) decorationData[y][x] = DECOR.HUT;
        else if (n > 0.974) decorationData[y][x] = DECOR.WELL;
        else if (n > 0.955) decorationData[y][x] = DECOR.STANDARD;
        else if (n > 0.9) decorationData[y][x] = DECOR.FLOWERS;
        else if (n > 0.78) decorationData[y][x] = DECOR.TUFT;
      }

      if (terrain === TERRAIN.SAND || terrain === TERRAIN.DIRT) {
        const n = hashNoise(x + 811, y + 67);
        if (n > 0.935) decorationData[y][x] = DECOR.RUIN_WALL;
      }
    }
  }
}

function seedSheep() {
  sheepData = replaceWorldCollection('sheep', []);
  const targetCount = Math.max(0, Math.min(mapConfig.sheepCount || 0, 200));

  for (let attempt = 0; attempt < targetCount * 120 && sheepData.length < targetCount; attempt++) {
    const x = Math.floor(worldRandom() * MAP_COLS);
    const y = Math.floor(worldRandom() * MAP_ROWS);
    if (!isInsideMap(x, y)) continue;
    if (isArabiaLikeMap() ? terrainData[y][x] === TERRAIN.WATER : terrainData[y][x] !== TERRAIN.GRASS) continue;
    if (obstacleData[y][x] !== OBSTACLE.NONE) continue;

    const center = tileCenter(x, y);
    if (!isCommandWalkablePoint(center.x, center.y, 12)) continue;

    sheepData.push(createSheep(
      center.x + (hashNoise(x + 17, y + 71) - 0.5) * tileSize * 0.45,
      center.y + (hashNoise(x + 83, y + 29) - 0.5) * tileSize * 0.45,
      hashNoise(x + 131, y + 199) > 0.5 ? 1 : -1,
      hashNoise(x + 269, y + 331) * Math.PI * 2
    ));
  }

  for (let attempt = 0; sheepData.length < targetCount && attempt < targetCount * 120; attempt++) {
    const spot = randomSpotOnMap();
    const terrain = terrainData[Math.floor(spot.y / tileSize)][Math.floor(spot.x / tileSize)];
    if (isArabiaLikeMap() ? terrain === TERRAIN.WATER : terrain !== TERRAIN.GRASS) continue;
    sheepData.push(createSheep(
      spot.x + (worldRandom() - 0.5) * tileSize * 0.5,
      spot.y + (worldRandom() - 0.5) * tileSize * 0.5,
      worldRandom() > 0.5 ? 1 : -1,
      worldRandom() * Math.PI * 2
    ));
  }

  window.sheepData = sheepData;
}

function seedDucks() {
  duckData = replaceWorldCollection('ducks', []);
  const targetCount = Math.max(0, Math.min(mapConfig.duckCount || 0, 200));

  for (let attempt = 0; attempt < targetCount * 160 && duckData.length < targetCount; attempt++) {
    const x = Math.floor(worldRandom() * MAP_COLS);
    const y = Math.floor(worldRandom() * MAP_ROWS);
    if (!isInsideMap(x, y)) continue;
    if (terrainData[y][x] !== TERRAIN.WATER) continue;
    if (obstacleData[y][x] !== OBSTACLE.NONE) continue;

    const center = tileCenter(x, y);
    duckData.push(createDuck(
      center.x + (hashNoise(x + 401, y + 919) - 0.5) * tileSize * 0.5,
      center.y + (hashNoise(x + 613, y + 157) - 0.5) * tileSize * 0.5,
      hashNoise(x + 331, y + 773) > 0.5 ? 1 : -1,
      hashNoise(x + 887, y + 229) * Math.PI * 2
    ));
  }

  for (let attempt = 0; duckData.length < targetCount && attempt < targetCount * 120; attempt++) {
    const spot = randomSpotOnMap();
    const tileX = Math.floor(spot.x / tileSize);
    const tileY = Math.floor(spot.y / tileSize);
    if (!isInsideMap(tileX, tileY)) continue;
    if (terrainData[tileY][tileX] !== TERRAIN.WATER) continue;
    duckData.push(createDuck(
      spot.x + (worldRandom() - 0.5) * tileSize * 0.45,
      spot.y + (worldRandom() - 0.5) * tileSize * 0.45,
      worldRandom() > 0.5 ? 1 : -1,
      worldRandom() * Math.PI * 2
    ));
  }

  window.duckData = duckData;
}

function createSheep(x, y, facing, phase) {
  const wanderAngle = hashNoise(Math.floor(x) + 991, Math.floor(y) + 557) * Math.PI * 2;
  return {
    id: `wildlife-${nextWildlifeId++}`,
    x,
    y,
    facing,
    heading: wanderAngle,
    phase,
    wanderAngle,
    wanderTimer: 0.5 + hashNoise(Math.floor(x) + 43, Math.floor(y) + 89) * 2.2,
    grazeTimer: hashNoise(Math.floor(x) + 211, Math.floor(y) + 467) * 1.8,
    speed: 9 + hashNoise(Math.floor(x) + 677, Math.floor(y) + 733) * 7,
    team: 'neutral',
    objectType: 'wildlife',
    displayName: 'Sheep',
    description: 'A peaceful grazing animal that can be mounted by units.',
    habitat: 'Grassland',
    hp: 24,
    maxHp: 24,
    size: 34,
    isDead: false,
    isMounted: false,
    selected: false,
    reservedByUnitId: null,
    riderUnitId: null,
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) this.die();
    },
    die() {
      this.isDead = true;
      this.selected = false;
      if (selectedWorldObject === this) selectedWorldObject = null;
    }
  };
}

function createDuck(x, y, facing, phase) {
  const wanderAngle = hashNoise(Math.floor(x) + 1201, Math.floor(y) + 1601) * Math.PI * 2;
  return {
    id: `wildlife-${nextWildlifeId++}`,
    x,
    y,
    facing,
    heading: wanderAngle,
    phase,
    wanderAngle,
    wanderTimer: 0.6 + hashNoise(Math.floor(x) + 547, Math.floor(y) + 929) * 2.1,
    bobPhase: hashNoise(Math.floor(x) + 73, Math.floor(y) + 337) * Math.PI * 2,
    speed: 12 + hashNoise(Math.floor(x) + 277, Math.floor(y) + 577) * 9,
    team: 'neutral',
    objectType: 'wildlife',
    displayName: 'Duck',
    description: 'A water-loving animal that wanders across lakes and shorelines.',
    habitat: 'Water',
    hp: 16,
    maxHp: 16,
    size: 24,
    isDead: false,
    selected: false,
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) this.die();
    },
    die() {
      this.isDead = true;
      this.selected = false;
      if (selectedWorldObject === this) selectedWorldObject = null;
    }
  };
}

function createHorse(x, y, facing = 1, phase = wildlifeRandom() * Math.PI * 2) {
  const wanderAngle = hashNoise(Math.floor(x) + 1709, Math.floor(y) + 2053) * Math.PI * 2;
  return {
    id: `wildlife-${nextWildlifeId++}`,
    x,
    y,
    facing,
    heading: wanderAngle,
    phase,
    wanderAngle,
    wanderTimer: 0.7 + hashNoise(Math.floor(x) + 379, Math.floor(y) + 641) * 2.4,
    grazeTimer: hashNoise(Math.floor(x) + 887, Math.floor(y) + 991) * 1.4,
    speed: 18 + hashNoise(Math.floor(x) + 1249, Math.floor(y) + 1427) * 10,
    team: 'neutral',
    objectType: 'wildlife',
    displayName: 'Horse',
    description: 'A riderless horse wandering the battlefield.',
    habitat: 'Grassland',
    hp: 40,
    maxHp: 40,
    size: 38,
    isDead: false,
    selected: false,
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) this.die();
    },
    die() {
      this.isDead = true;
      this.selected = false;
      if (selectedWorldObject === this) selectedWorldObject = null;
    }
  };
}

function createWanderingHorse(x, y, facing = 1) {
  if (!Array.isArray(horseData)) horseData = replaceWorldCollection('horses', []);
  const spawn = findNearestWalkablePoint(x, y, 28) || { x, y };
  const horse = createHorse(spawn.x, spawn.y, facing, wildlifeRandom() * Math.PI * 2);
  horseData.push(horse);
  window.horseData = horseData;
  return horse;
}

function isDuckPreferredPoint(worldX, worldY) {
  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);
  return isInsideMap(tileX, tileY) &&
    terrainData[tileY][tileX] === TERRAIN.WATER &&
    obstacleData[tileY][tileX] === OBSTACLE.NONE;
}

function getSheepAtPoint(worldX, worldY) {
  if (!Array.isArray(sheepData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const sheep of sheepData) {
    if (sheep.isDead || sheep.isMounted || sheep.reservedByUnitId) continue;
    const dist = Math.hypot(sheep.x - worldX, sheep.y - worldY);
    const radius = sheep.size * 1.15;
    if (dist <= radius && dist < closestDist) {
      closest = sheep;
      closestDist = dist;
    }
  }

  return closest;
}

function getLiveSheepNearPoint(worldX, worldY, radius) {
  if (!Array.isArray(sheepData)) return [];
  return sheepData.filter(sheep =>
    !sheep.isDead &&
    !sheep.isMounted &&
    !sheep.reservedByUnitId &&
    Math.hypot(sheep.x - worldX, sheep.y - worldY) <= radius + sheep.size * 0.5
  );
}

function removeSheepFromMap(sheep) {
  if (!sheep || !Array.isArray(sheepData)) return false;
  const index = sheepData.indexOf(sheep);
  if (index === -1) return false;
  if (selectedWorldObject === sheep) clearWorldObjectSelection();
  sheepData.splice(index, 1);
  window.sheepData = sheepData;
  return true;
}

function getDuckAtPoint(worldX, worldY) {
  if (!Array.isArray(duckData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const duck of duckData) {
    if (duck.isDead) continue;
    const dist = Math.hypot(duck.x - worldX, duck.y - worldY);
    const radius = duck.size * 1.2;
    if (dist <= radius && dist < closestDist) {
      closest = duck;
      closestDist = dist;
    }
  }

  return closest;
}

function getLiveDucksNearPoint(worldX, worldY, radius) {
  if (!Array.isArray(duckData)) return [];
  return duckData.filter(duck =>
    !duck.isDead &&
    Math.hypot(duck.x - worldX, duck.y - worldY) <= radius + duck.size * 0.5
  );
}

function getHorseAtPoint(worldX, worldY) {
  if (!Array.isArray(horseData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const horse of horseData) {
    if (horse.isDead) continue;
    const dist = Math.hypot(horse.x - worldX, horse.y - worldY);
    if (dist <= horse.size * 1.1 && dist < closestDist) {
      closest = horse;
      closestDist = dist;
    }
  }
  return closest;
}

function getLiveHorsesNearPoint(worldX, worldY, radius) {
  if (!Array.isArray(horseData)) return [];
  return horseData.filter(horse =>
    !horse.isDead &&
    Math.hypot(horse.x - worldX, horse.y - worldY) <= radius + horse.size * 0.5
  );
}

function createWorldItem(item, x, y) {
  return OpenRTS.world.objectFactories.items.createWorldItem({
    id: nextWorldItemId++,
    item,
    x,
    y,
    onDestroyed(worldItem) {
      if (selectedWorldObject === worldItem) selectedWorldObject = null;
    }
  });
}

function dropWorldItem(item, worldX, worldY) {
  const point = findNearestWalkablePoint(worldX, worldY, 18);
  if (!point) return null;
  const worldItem = createWorldItem(item, point.x, point.y);
  itemData.push(worldItem);
  window.itemData = itemData;
  return worldItem;
}

function removeWorldItem(item) {
  const index = itemData.indexOf(item);
  if (index < 0) return false;
  if (selectedWorldObject === item) clearWorldObjectSelection();
  itemData.splice(index, 1);
  window.itemData = itemData;
  return true;
}

function getWorldItemAtPoint(worldX, worldY) {
  return OpenRTS.world.hitTests.nearestCircleAtPoint(itemData, worldX, worldY, {
    include: item => !item.isDead && !item.isPickedUp
  });
}

function getNearestPickupItem(worldX, worldY, radius = 80) {
  if (!Array.isArray(itemData)) return null;
  let closest = null;
  let closestDistance = radius;
  for (const item of itemData) {
    if (item.isDead || item.isPickedUp || !item.pickupable) continue;
    const distance = Math.hypot(item.x - worldX, item.y - worldY);
    if (distance <= closestDistance) {
      closest = item;
      closestDistance = distance;
    }
  }
  return closest;
}

function drawWorldItem(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = '#6c4524';
  ctx.strokeStyle = '#2f1c0e';
  ctx.lineWidth = 2;
  ctx.fillRect(-9, -8, 18, 16);
  ctx.strokeRect(-9, -8, 18, 16);
  ctx.fillStyle = '#b98a42';
  ctx.fillRect(-2, -8, 4, 16);
  ctx.restore();
}

function obstacleSpecies(obstacleType, tileX, tileY) {
  if (obstacleType === OBSTACLE.ROCK) return 'Granite Outcrop';
  if (isArabiaLikeMap()) return 'Pine Tree';
  const treeKind = Math.floor(hashNoise(tileX + 83, tileY + 29) * 3);
  return treeKind === 0 ? 'Pine Tree' : treeKind === 1 ? 'Oak Tree' : 'Palm Tree';
}

function rebuildObstacleEntities() {
  obstacleEntityData = replaceWorldCollection('obstacleEntities', []);
  obstacleEntityGrid = replaceWorldCollection(
    'obstacleEntityGrid',
    Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(null))
  );

  if (!Array.isArray(obstacleData) || obstacleData.length === 0) return;
  for (let tileY = 0; tileY < MAP_ROWS; tileY++) {
    for (let tileX = 0; tileX < MAP_COLS; tileX++) {
      const obstacleType = obstacleData[tileY][tileX];
      if (obstacleType !== OBSTACLE.TREE && obstacleType !== OBSTACLE.ROCK) continue;
      const center = tileCenter(tileX, tileY);
      const isTree = obstacleType === OBSTACLE.TREE;
      const obstacle = OpenRTS.world.objectFactories.obstacles.createObstacle({
        id: `obstacle-${tileX}-${tileY}`,
        obstacleType,
        tileX,
        tileY,
        x: center.x,
        y: center.y,
        tileSize,
        isTree,
        displayName: obstacleSpecies(obstacleType, tileX, tileY),
        description: isTree
          ? 'A mature natural obstacle providing cover and blocking movement.'
          : 'A dense formation of weathered stone that blocks movement.',
        onDestroyed(deadObstacle) {
          if (isInsideMap(deadObstacle.tileX, deadObstacle.tileY)) {
            obstacleData[deadObstacle.tileY][deadObstacle.tileX] = OBSTACLE.NONE;
          }
          if (selectedWorldObject === deadObstacle) selectedWorldObject = null;
          obstacleRevision++;
        }
      });
      obstacleEntityData.push(obstacle);
      obstacleEntityGrid[tileY][tileX] = obstacle;
    }
  }

  obstacleRevision++;
  window.obstacleEntityData = obstacleEntityData;
}

function getObstacleAtPoint(worldX, worldY) {
  return OpenRTS.world.hitTests.nearestCircleAtPoint(obstacleEntityData, worldX, worldY, {
    include: obstacle => !obstacle.isDead && !obstacle.isPickedUp
  });
}

function getGoldMineAtPoint(worldX, worldY) {
  return OpenRTS.world.hitTests.nearestCircleAtPoint(goldMineData, worldX, worldY, {
    include: mine => !mine.isDead
  });
}

function getGoldMines() {
  return Array.isArray(goldMineData) ? goldMineData : [];
}

function markGoldMinesDirty() {
  goldMineRevision++;
}

function getGoldMineRevision() {
  return goldMineRevision;
}

function getHouses() {
  return Array.isArray(houseData) ? houseData : [];
}

function getHouseRevision() {
  return houseRevision;
}

function markHousesDirty() {
  houseRevision++;
}

function getHouseAtPoint(worldX, worldY) {
  return OpenRTS.world.hitTests.nearestCircleAtPoint(houseData, worldX, worldY, {
    include: house => !house.isDead || house.isWreck
  });
}

function getHouseById(id) {
  return getHouses().find(house => String(house.id) === String(id)) || null;
}

function isPointInsideHouse(house, worldX, worldY) {
  return OpenRTS.world.houseInteractions.isPointInside(house, worldX, worldY, tileSize);
}

function getHouseDoorPoint(house) {
  return OpenRTS.world.houseInteractions.doorPoint(house, tileSize);
}

function commandUnitIntoHouse(unit, house, append = false) {
  return OpenRTS.world.houseInteractions.commandEnter(unit, house, { append, tileSize });
}

function commandUnitOutOfHouse(unit, worldX = null, worldY = null, append = false) {
  return OpenRTS.world.houseInteractions.commandExit(unit, {
    worldX,
    worldY,
    append,
    tileSize,
    getHouseById,
    findNearestWalkablePoint,
    markDirty: markHousesDirty
  });
}

function burnHouseNow(house) {
  return OpenRTS.world.houseInteractions.burnNow(house, {
    units,
    tileSize,
    getHouseById,
    findNearestWalkablePoint,
    markDirty: markHousesDirty,
    onDeselected(deadHouse) {
      if (selectedWorldObject === deadHouse) selectedWorldObject = null;
      OpenRTS.world.selection.channel('worldObjects').clearIfSelected(deadHouse);
    }
  });
}

function startBurningHouse(house) {
  return OpenRTS.world.houseInteractions.startBurning(house, { markDirty: markHousesDirty });
}

function updateHouses(dt) {
  OpenRTS.world.houseInteractions.updateBurning(dt, {
    houses: getHouses(),
    units,
    tileSize,
    getHouseById,
    findNearestWalkablePoint,
    markDirty: markHousesDirty,
    onDeselected(deadHouse) {
      if (selectedWorldObject === deadHouse) selectedWorldObject = null;
      OpenRTS.world.selection.channel('worldObjects').clearIfSelected(deadHouse);
    }
  });
}

function updateHouseUnitInteractions() {
  OpenRTS.world.houseInteractions.updateUnitInteractions({
    units,
    tileSize,
    markDirty: markHousesDirty
  });
}

function getNearestCarryableObject(worldX, worldY, radius = 90) {
  return OpenRTS.world.carryables.findNearestCarryableObject(worldX, worldY, {
    radius,
    items: itemData,
    obstacles: obstacleEntityData
  });
}

function removeCarryableWorldObject(object) {
  if (!object || object.isDead || object.isPickedUp) return false;
  if (object.objectType === 'item') return removeWorldItem(object);
  if (object.objectType !== 'obstacle' || !isInsideMap(object.tileX, object.tileY)) return false;
  if (obstacleData[object.tileY][object.tileX] !== object.obstacleType) return false;

  object.isPickedUp = true;
  object.selected = false;
  obstacleData[object.tileY][object.tileX] = OBSTACLE.NONE;
  if (selectedWorldObject === object) selectedWorldObject = null;
  rebuildObstacleEntities();
  return true;
}

function canDropObstacleAt(tileX, tileY) {
  return OpenRTS.world.carryables.canDropObstacleAt(tileX, tileY, {
    isInsideMap,
    isWaterTile: (x, y) => terrainData[y]?.[x] === TERRAIN.WATER,
    hasObstacle: (x, y) => obstacleData[y]?.[x] !== OBSTACLE.NONE,
    isBlockedByBuilding: (x, y) => isTileBlockedByBuilding(x, y),
    tileCenter,
    tileSize,
    units
  });
}

function findObstacleDropTile(worldX, worldY) {
  return OpenRTS.world.carryables.findObstacleDropTile(worldX, worldY, {
    tileSize,
    maxRadius: 5,
    canDrop: canDropObstacleAt
  });
}

function dropCarriedObstacle(item, worldX, worldY) {
  const site = findObstacleDropTile(worldX, worldY);
  if (!site) return null;
  obstacleData[site.tileY][site.tileX] = item.obstacleType;
  decorationData[site.tileY][site.tileX] = DECOR.NONE;
  rebuildObstacleEntities();
  return obstacleEntityGrid[site.tileY][site.tileX] || true;
}

function dropCarriedItem(item, worldX, worldY) {
  if (item?.carryType === 'obstacle') return dropCarriedObstacle(item, worldX, worldY);
  return dropWorldItem(item, worldX, worldY);
}

function getObstacleRevision() {
  return obstacleRevision;
}

function clearWorldObjectSelection() {
  OpenRTS.world.selection.channel('worldObjects').clear();
  selectedWorldObject = null;
}

function selectWorldObject(object) {
  selectedWorldObject = OpenRTS.world.selection.channel('worldObjects').select(object);
}

function getSelectedWorldObject() {
  selectedWorldObject = OpenRTS.world.selection.channel('worldObjects').get();
  return selectedWorldObject;
}

const BUILDING_TYPES = {
  HOME: OpenRTS.world.buildingTypes?.HOME || 'home',
  TOWER: OpenRTS.world.buildingTypes?.TOWER || 'tower'
};

const BUILDING_STATS = {
  home: typeof getBuildingDefinition === 'function' ? getBuildingDefinition('home') : { width: 3, height: 3, hp: 420, size: 96 },
  tower: typeof getBuildingDefinition === 'function' ? getBuildingDefinition('tower') : { width: 2, height: 2, hp: 260, size: 70 }
};

function getBuildingStats(type) {
  return (typeof getBuildingDefinition === 'function' ? getBuildingDefinition(type) : null) ||
    BUILDING_STATS[type] ||
    BUILDING_STATS.home;
}

function getFactionHomeDefinition(team, config = window.mapConfig || {}) {
  const faction = typeof getConfiguredFactionForTeam === 'function'
    ? getConfiguredFactionForTeam(team, config)
    : null;
  const startingBuildings = faction?.startingBuildings || {};
  const homeDefinitionType = Object.keys(startingBuildings)[0] || null;
  const stats = homeDefinitionType && typeof getBuildingDefinition === 'function'
    ? getBuildingDefinition(homeDefinitionType)
    : null;
  return stats
    ? { factionId: faction?.id || null, definitionType: homeDefinitionType, stats }
    : { factionId: faction?.id || null, definitionType: BUILDING_TYPES.HOME, stats: null };
}

function getBuildingSpawnDefinition(type, team, config = window.mapConfig || {}) {
  if (type === BUILDING_TYPES.HOME) {
    const factionHome = getFactionHomeDefinition(team, config);
    if (factionHome.stats) return factionHome;
  }
  return {
    factionId: null,
    definitionType: type,
    stats: getBuildingStats(type)
  };
}

function createBuilding(type, team, tileX, tileY, options = {}) {
  const spawnDefinition = options.spawnDefinition || getBuildingSpawnDefinition(type, team);
  const stats = options.stats || spawnDefinition.stats || getBuildingStats(type);
  const building = OpenRTS.world.objectFactories.buildings.createBuilding({
    id: nextBuildingId++,
    type,
    team,
    tileX,
    tileY,
    tileSize,
    stats,
    definitionType: options.definitionType || spawnDefinition.definitionType,
    factionId: options.factionId || spawnDefinition.factionId
  });
  buildingData.push(building);
  window.buildingData = buildingData;
  return building;
}

function isTileBlockedByBuilding(tileX, tileY, ignoredBuilding = null) {
  if (!Array.isArray(buildingData)) return false;

  for (const building of buildingData) {
    if (building === ignoredBuilding || building.isDead) continue;
    if (
      tileX >= building.tileX &&
      tileX < building.tileX + building.width &&
      tileY >= building.tileY &&
      tileY < building.tileY + building.height
    ) {
      return true;
    }
  }

  return false;
}

function canPlaceBuildingAt(type, tileX, tileY, options = {}) {
  const stats = options.stats || getBuildingStats(type);
  return OpenRTS.world.buildingPlacement.canPlaceAt(type, tileX, tileY, {
    stats,
    homeType: BUILDING_TYPES.HOME,
    isInsideMap,
    isWaterTile: (x, y) => terrainData[y]?.[x] === TERRAIN.WATER,
    hasObstacle: (x, y) => obstacleData[y]?.[x] !== OBSTACLE.NONE,
    hasGoldMine: (x, y) => goldMineData.some(mine => !mine.isDead && mine.tileX === x && mine.tileY === y),
    hasHouse: (x, y) => houseData.some(house => !house.isWreck && x >= house.tileX && x < house.tileX + house.width && y >= house.tileY && y < house.tileY + house.height),
    isBlockedByBuilding: (x, y) => isTileBlockedByBuilding(x, y)
  });
}

function findNearestBuildableSite(type, worldX, worldY, radiusTiles = 8, options = {}) {
  const stats = options.stats || getBuildingStats(type);
  return OpenRTS.world.buildingPlacement.findNearestBuildableSite(type, worldX, worldY, {
    stats,
    tileSize,
    radiusTiles,
    canPlace: (candidateType, x, y) => canPlaceBuildingAt(candidateType, x, y, { stats })
  });
}

function buildBuildingAtTile(type, team, tileX, tileY, options = {}) {
  const stats = options.stats || getBuildingStats(type);
  if (!canPlaceBuildingAt(type, tileX, tileY, { stats })) return null;
  prepareBuildingPad(type, tileX, tileY, { stats });
  if (!canPlaceBuildingAt(type, tileX, tileY, { stats })) return null;
  return createBuilding(type, team, tileX, tileY, { stats, definitionType: type });
}

function prepareBuildingPad(type, tileX, tileY, options = {}) {
  const stats = options.stats || getBuildingStats(type);
  const tiles = OpenRTS.world.buildingPlacement.padTiles(type, tileX, tileY, {
    stats,
    homeType: BUILDING_TYPES.HOME
  });
  for (const tile of tiles) {
    if (!isInsideMap(tile.x, tile.y)) return false;
    terrainData[tile.y][tile.x] = TERRAIN.GRASS;
    obstacleData[tile.y][tile.x] = OBSTACLE.NONE;
    decorationData[tile.y][tile.x] = DECOR.NONE;
  }

  buildTerrainRenderCache();
  return true;
}

function findBuildingSite(team, type, preferredXRatio, preferredYRatio, teamIndex = team === 'red' ? 0 : 1, teamCount = 2, options = {}) {
  const stats = options.stats || getBuildingStats(type);
  const site = OpenRTS.world.buildingPlacement.findTeamBuildingSite(team, type, preferredXRatio, preferredYRatio, {
    stats,
    columns: MAP_COLS,
    rows: MAP_ROWS,
    teamIndex,
    teamCount,
    canPlace: (candidateType, x, y) => canPlaceBuildingAt(candidateType, x, y, { stats })
  });

  if (site?.fallbackX !== undefined && type === BUILDING_TYPES.HOME) {
    if (
      prepareBuildingPad(type, site.fallbackX, site.fallbackY, { stats }) &&
      canPlaceBuildingAt(type, site.fallbackX, site.fallbackY, { stats })
    ) {
      return { x: site.fallbackX, y: site.fallbackY };
    }
    return null;
  }

  return site;
}

function placeTeamBuildings(config = window.mapConfig || {}) {
  buildingData = replaceWorldCollection('buildings', []);
  nextBuildingId = 1;

  const homesPerTeam = Math.max(0, Math.floor(Number(config.homesPerTeam) || 0));
  const towersPerTeam = Math.max(0, Math.floor(Number(config.towersPerTeam) || 0));
  const teams = config.modeId === 'tower_defense'
    ? ['red']
    : typeof getConfiguredTeams === 'function'
    ? getConfiguredTeams(config)
    : Array.isArray(config.teams) && config.teams.length ? config.teams : ['red', 'blue'];
  const homeRatios = {
    red: [[0.18, 0.5], [0.22, 0.34]],
    blue: [[0.82, 0.5], [0.78, 0.66]]
  };
  const towerRatios = {
    red: [[0.31, 0.43], [0.28, 0.62], [0.35, 0.28], [0.35, 0.74]],
    blue: [[0.69, 0.57], [0.72, 0.38], [0.65, 0.72], [0.65, 0.26]]
  };

  for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
    const team = teams[teamIndex];
    const sliceCenter = (teamIndex + 0.5) / Math.max(2, teams.length);
    const generatedRatio = getTeamStartRatio(teamIndex, teams.length, config);
    const defaultHomeRatios = generatedRatio
      ? [generatedRatio]
      : [[sliceCenter, teamIndex % 2 === 0 ? 0.42 : 0.58]];
    const defaultTowerRatios = generatedRatio
      ? [
        [Math.max(0.08, Math.min(0.92, generatedRatio[0] + (generatedRatio[0] < 0.5 ? 0.09 : -0.09))), generatedRatio[1]],
        [generatedRatio[0], Math.max(0.08, Math.min(0.92, generatedRatio[1] + (generatedRatio[1] < 0.5 ? 0.09 : -0.09)))]
      ]
      : [[sliceCenter, teamIndex % 2 === 0 ? 0.32 : 0.68]];

    for (let i = 0; i < homesPerTeam; i++) {
      const spawnDefinition = getBuildingSpawnDefinition(BUILDING_TYPES.HOME, team, config);
      const homeRatioSet = generatedRatio ? defaultHomeRatios : (homeRatios[team] || defaultHomeRatios);
      const ratios = homeRatioSet[i] || homeRatioSet.at(-1);
      const site = findBuildingSite(team, BUILDING_TYPES.HOME, ratios[0], ratios[1], teamIndex, teams.length, {
        stats: spawnDefinition.stats
      });
      if (site) createBuilding(BUILDING_TYPES.HOME, team, site.x, site.y, { spawnDefinition });
    }

    for (let i = 0; i < towersPerTeam; i++) {
      const towerRatioSet = generatedRatio ? defaultTowerRatios : (towerRatios[team] || defaultTowerRatios);
      const ratios = towerRatioSet[i] || towerRatioSet.at(-1);
      const site = findBuildingSite(team, BUILDING_TYPES.TOWER, ratios[0], ratios[1], teamIndex, teams.length);
      if (site) createBuilding(BUILDING_TYPES.TOWER, team, site.x, site.y);
    }
  }

  window.buildingData = buildingData;
  rebuildObstacleEntities();
}

function getTeamHome(team) {
  return OpenRTS.world.buildingQueries.teamHome(buildingData, team, BUILDING_TYPES.HOME);
}

function getBuildings() {
  return Array.isArray(buildingData) ? buildingData : [];
}

function clearBuildingSelection() {
  OpenRTS.world.selection.channel('buildings').clear();
  for (const building of getBuildings()) building.selected = false;
}

function selectBuilding(building) {
  clearBuildingSelection();
  if (building) building.selected = true;
  OpenRTS.world.selection.channel('buildings').select(building);
}

function getSelectedBuilding() {
  return OpenRTS.world.selection.channel('buildings').get() ||
    getBuildings().find(building => building.selected && !building.isDead) ||
    null;
}

function getBuildingAtPoint(worldX, worldY) {
  return OpenRTS.world.buildingQueries.atWorldPoint(buildingData, worldX, worldY, { tileSize });
}

function getBuildingAtScreenPoint(screenX, screenY) {
  return OpenRTS.world.buildingQueries.atScreenPoint(buildingData, screenX, screenY, { camera, tileSize });
}

function isPointInsideCastle(building, worldX, worldY) {
  return OpenRTS.world.castleGeometry.isPointInside(building, worldX, worldY, {
    homeType: BUILDING_TYPES.HOME,
    tileSize
  });
}

function issueUnitRoute(unit, points, append = false) {
  return OpenRTS.world.castleCommands.issueRoute(unit, points, append);
}

function getLiveBuildingsNearPoint(worldX, worldY, radius) {
  return OpenRTS.world.buildingQueries.nearPoint(buildingData, worldX, worldY, radius, { tileSize });
}

function isInsideMap(tileX, tileY) {
  return getNavigationService().isInsideMap(tileX, tileY);
}

function normalizeMovementOptions(options = {}) {
  return getNavigationService().normalizeMovementOptions(options);
}

function getTileHeightLevel(tileX, tileY) {
  return getNavigationService().getTileHeightLevel(tileX, tileY);
}

function getTileTraversalHeight(tileX, tileY) {
  return getNavigationService().getTileTraversalHeight(tileX, tileY);
}

function isRampTile(tileX, tileY) {
  return getNavigationService().isRampTile(tileX, tileY);
}

function getWorldElevation(worldX, worldY) {
  return getNavigationService().getWorldElevation(worldX, worldY);
}

function canTraverseHeightStep(fromTile, toTile) {
  return getNavigationService().canTraverseHeightStep(fromTile, toTile);
}

function isAirMovement(options = {}) {
  return getNavigationService().isAirMovement(options);
}

function isWalkableTile(tileX, tileY, options = {}) {
  return getNavigationService().isWalkableTile(tileX, tileY, options);
}

function getMovementCost(tileX, tileY, options = {}) {
  return getNavigationService().getMovementCost(tileX, tileY, options);
}

function getTransitionTarget(x, y, terrainType) {
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];

  // Priority helps produce cleaner shores/edges.
  const priority = [TERRAIN.WATER, TERRAIN.SAND, TERRAIN.DIRT, TERRAIN.GRASS];

  for (const wanted of priority) {
    if (wanted === terrainType) continue;

    for (const n of neighbors) {
      if (!isInsideMap(n.x, n.y)) continue;
      if (terrainData[n.y][n.x] === wanted) return wanted;
    }
  }

  return null;
}

function drawTerrainTile(terrainType, drawX, drawY) {
  OpenRTS.rendering.canvas.terrainPainter.drawTerrainTile(ctx, terrainType, drawX, drawY, {
    terrain: TERRAIN,
    tileSize,
    tileSprites,
    volcanic: isVolcanicTerrain()
  });
}

function drawTerrainAccents(terrainType, x, y, drawX, drawY) {
  OpenRTS.rendering.canvas.terrainPainter.drawTerrainAccents(ctx, terrainType, x, y, drawX, drawY, {
    terrain: TERRAIN,
    tileSize,
    noise: hashNoise,
    volcanic: isVolcanicTerrain()
  });
}

function drawGroundDecor(decorType, terrainType, x, y, drawX, drawY) {
  if (decorType === DECOR.NONE) return;

  if (decorType === DECOR.COBBLE) {
    const centerX = drawX + tileSize * 0.5;
    const centerY = drawY + tileSize * 0.5;
    const connections = [
      { x: x + 1, y, dx: tileSize * 0.5, dy: 0 },
      { x: x - 1, y, dx: -tileSize * 0.5, dy: 0 },
      { x, y: y + 1, dx: 0, dy: tileSize * 0.5 },
      { x, y: y - 1, dx: 0, dy: -tileSize * 0.5 }
    ].filter(n =>
      isInsideMap(n.x, n.y) &&
      decorationData[n.y][n.x] === DECOR.COBBLE
    );

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = terrainType === TERRAIN.SAND
      ? 'rgba(126, 111, 78, 0.32)'
      : 'rgba(88, 84, 66, 0.48)';
    ctx.lineWidth = tileSize * 0.74;

    if (connections.length === 0) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, tileSize * 0.35, tileSize * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      for (const n of connections) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + n.dx, centerY + n.dy);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(190, 179, 137, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const px = drawX + tileSize * (0.22 + hashNoise(x + i * 13, y + 5) * 0.56);
      const py = drawY + tileSize * (0.22 + hashNoise(x + 3, y + i * 19) * 0.56);
      ctx.beginPath();
      ctx.moveTo(px - 3, py);
      ctx.lineTo(px + 3, py + 1);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  if (decorType === DECOR.TUFT) {
    const baseX = drawX + tileSize * (0.25 + hashNoise(x + 11, y + 7) * 0.5);
    const baseY = drawY + tileSize * (0.34 + hashNoise(x + 19, y + 23) * 0.45);
    ctx.strokeStyle = 'rgba(49, 93, 42, 0.72)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 2.3;
      ctx.beginPath();
      ctx.moveTo(baseX + offset, baseY + 5);
      ctx.lineTo(baseX + offset * 0.55, baseY - 5 - (i % 2) * 2);
      ctx.stroke();
    }
    return;
  }

  if (decorType === DECOR.FLOWERS) {
    const colors = ['#d8c75b', '#d98858', '#b94f62', '#f0e8b2'];
    for (let i = 0; i < 5; i++) {
      const px = drawX + tileSize * (0.24 + hashNoise(x + i * 17, y + 31) * 0.52);
      const py = drawY + tileSize * (0.28 + hashNoise(x + 47, y + i * 13) * 0.48);
      ctx.fillStyle = colors[(x + y + i) % colors.length];
      ctx.beginPath();
      ctx.arc(px, py, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (decorType === DECOR.RUIN_WALL) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    const sprite = hashNoise(x + 3, y + 5) > 0.5 ? tileSprites.wall : tileSprites.wallDark;
    if (sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, drawX, drawY + tileSize * 0.18, tileSize, tileSize);
    } else {
      ctx.fillStyle = '#6f6756';
      ctx.fillRect(drawX + 4, drawY + 17, tileSize - 8, 7);
    }
    ctx.restore();
    return;
  }

  if (decorType === DECOR.HILL) {
    ctx.save();
    ctx.fillStyle = 'rgba(58, 92, 39, 0.24)';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 18, 15, 9, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 239, 176, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(drawX + 14, drawY + 15, 9, 4, -0.2, 0.1, Math.PI * 0.95);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (decorType === DECOR.DITCH) {
    ctx.save();
    const centerX = drawX + tileSize * 0.5;
    const centerY = drawY + tileSize * 0.58;
    ctx.fillStyle = 'rgba(25, 15, 9, 0.5)';
    ctx.beginPath();
    ctx.moveTo(drawX + 2, drawY + 18);
    ctx.quadraticCurveTo(drawX + 10, drawY + 9, drawX + 22, drawY + 11);
    ctx.quadraticCurveTo(drawX + 30, drawY + 14, drawX + 29, drawY + 22);
    ctx.quadraticCurveTo(drawX + 18, drawY + 30, drawX + 5, drawY + 25);
    ctx.quadraticCurveTo(drawX + 0, drawY + 22, drawX + 2, drawY + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(95, 63, 34, 0.78)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 13, 6, -0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(37, 24, 15, 0.92)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 1, 10, 3.6, -0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(176, 126, 66, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(drawX + 5, drawY + 14);
    ctx.lineTo(drawX + 27, drawY + 18);
    ctx.moveTo(drawX + 6, drawY + 24);
    ctx.lineTo(drawX + 26, drawY + 12);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224, 192, 125, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sx = drawX + 6 + i * 6;
      ctx.beginPath();
      ctx.moveTo(sx, drawY + 13 + (i % 2) * 2);
      ctx.lineTo(sx + 3, drawY + 24 - (i % 2) * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (decorType === DECOR.CLIFF) {
    ctx.save();
    ctx.fillStyle = '#6c675d';
    ctx.beginPath();
    ctx.moveTo(drawX + 2, drawY + 6);
    ctx.lineTo(drawX + 30, drawY + 5);
    ctx.lineTo(drawX + 30, drawY + 27);
    ctx.lineTo(drawX + 4, drawY + 30);
    ctx.closePath();
    ctx.fill();

    const stones = [
      [5, 8, 9, 8], [15, 7, 11, 7], [4, 17, 12, 8],
      [17, 16, 10, 9], [8, 25, 10, 5], [20, 25, 8, 4]
    ];
    for (const [sx, sy, sw, sh] of stones) {
      ctx.fillStyle = hashNoise(x + sx, y + sy) > 0.5 ? '#827b6f' : '#555047';
      ctx.fillRect(drawX + sx, drawY + sy, sw, sh);
      ctx.strokeStyle = 'rgba(34, 29, 24, 0.5)';
      ctx.strokeRect(drawX + sx, drawY + sy, sw, sh);
    }

    ctx.strokeStyle = 'rgba(34, 27, 22, 0.68)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(drawX + 3, drawY + 8);
    ctx.lineTo(drawX + 29, drawY + 6);
    ctx.moveTo(drawX + 5, drawY + 29);
    ctx.lineTo(drawX + 30, drawY + 26);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (decorType === DECOR.RAMP) {
    ctx.save();
    ctx.fillStyle = 'rgba(142, 118, 72, 0.34)';
    ctx.beginPath();
    ctx.moveTo(drawX + 4, drawY + 26);
    ctx.lineTo(drawX + 28, drawY + 21);
    ctx.lineTo(drawX + 24, drawY + 7);
    ctx.lineTo(drawX + 7, drawY + 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(69, 50, 29, 0.38)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const yOffset = drawY + 12 + i * 4;
      ctx.beginPath();
      ctx.moveTo(drawX + 7 + i, yOffset);
      ctx.lineTo(drawX + 25 - i, yOffset - 3);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (decorType === DECOR.STANDARD) {
    const poleX = drawX + tileSize * 0.54;
    const poleY = drawY + tileSize * 0.2;
    ctx.fillStyle = 'rgba(35, 18, 8, 0.2)';
    ctx.beginPath();
    ctx.ellipse(drawX + tileSize * 0.52, drawY + tileSize * 0.78, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5b3419';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleX, poleY);
    ctx.lineTo(poleX, drawY + tileSize * 0.78);
    ctx.stroke();
    ctx.fillStyle = hashNoise(x + 71, y + 29) > 0.5 ? '#9e312d' : '#285b86';
    ctx.beginPath();
    ctx.moveTo(poleX + 1, poleY + 2);
    ctx.lineTo(poleX + 16, poleY + 6);
    ctx.lineTo(poleX + 1, poleY + 13);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (decorType === DECOR.WELL) {
    ctx.save();
    ctx.fillStyle = 'rgba(28, 14, 5, 0.26)';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 25, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b8475';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 19, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4e473c';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#31241b';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 18, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6b4020';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(drawX + 8, drawY + 18);
    ctx.lineTo(drawX + 8, drawY + 5);
    ctx.moveTo(drawX + 24, drawY + 18);
    ctx.lineTo(drawX + 24, drawY + 5);
    ctx.moveTo(drawX + 7, drawY + 5);
    ctx.lineTo(drawX + 25, drawY + 5);
    ctx.stroke();

    ctx.strokeStyle = '#2e241b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(drawX + 16, drawY + 5);
    ctx.lineTo(drawX + 16, drawY + 16);
    ctx.stroke();

    ctx.fillStyle = '#5b4330';
    ctx.strokeStyle = '#2e241b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX + 13, drawY + 15);
    ctx.lineTo(drawX + 19, drawY + 15);
    ctx.lineTo(drawX + 18, drawY + 21);
    ctx.lineTo(drawX + 14, drawY + 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6b4020';
    ctx.beginPath();
    ctx.arc(drawX + 16, drawY + 5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (decorType === DECOR.HUT) {
    ctx.save();
    ctx.fillStyle = 'rgba(28, 14, 5, 0.24)';
    ctx.beginPath();
    ctx.ellipse(drawX + 17, drawY + 25, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7a5733';
    ctx.fillRect(drawX + 8, drawY + 14, 18, 13);
    ctx.fillStyle = '#c78435';
    ctx.beginPath();
    ctx.moveTo(drawX + 5, drawY + 15);
    ctx.lineTo(drawX + 17, drawY + 4);
    ctx.lineTo(drawX + 29, drawY + 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 35, 12, 0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(drawX + 9 + i * 5, drawY + 12);
      ctx.lineTo(drawX + 15 + i * 2, drawY + 5 + i);
      ctx.stroke();
    }
    ctx.fillStyle = '#2f1c12';
    ctx.fillRect(drawX + 15, drawY + 20, 5, 7);
    ctx.fillStyle = 'rgba(255, 221, 118, 0.6)';
    ctx.fillRect(drawX + 10, drawY + 17, 4, 3);
    ctx.restore();
  }
}

function drawTransitions(x, y, terrainType, drawX, drawY) {
  OpenRTS.rendering.canvas.terrainPainter.drawTransitions(ctx, x, y, terrainType, drawX, drawY, {
    terrain: TERRAIN,
    terrainData,
    tileSize,
    isInsideMap,
    noise: hashNoise,
    volcanic: isVolcanicTerrain()
  });
}

function drawIrregularRock(x, y, drawX, drawY) {
  const outcropRoll = hashNoise(x + 149, y + 251);
  const scale = 1.08 + Math.pow(outcropRoll, 0.7) * 2.25;
  const centerX = drawX + tileSize * (0.47 + (hashNoise(x + 29, y + 61) - 0.5) * 0.18);
  const centerY = drawY + tileSize * (0.58 + (hashNoise(x + 83, y + 19) - 0.5) * 0.16);
  const rockCount = outcropRoll > 0.78
    ? 22 + Math.floor(hashNoise(x + 701, y + 809) * 10)
    : outcropRoll > 0.42
      ? 14 + Math.floor(hashNoise(x + 557, y + 443) * 10)
      : 7 + Math.floor(hashNoise(x + 331, y + 277) * 8);

  ctx.save();

  for (let rock = 0; rock < rockCount; rock++) {
    const n = hashNoise(x + rock * 37, y + rock * 53);
    const goldenAngle = 2.399963229728653;
    const angleOffset = rock * goldenAngle + hashNoise(x + 97, y + 17) * Math.PI * 2;
    const ring = Math.sqrt((rock + 0.5) / rockCount);
    const spreadX = tileSize * (0.04 + ring * 0.24) * scale;
    const spreadY = tileSize * (0.03 + ring * 0.15) * scale;
    const cx = centerX + Math.cos(angleOffset) * spreadX + (n - 0.5) * tileSize * 0.025 * scale;
    const cy = centerY + Math.sin(angleOffset) * spreadY + (hashNoise(x + rock * 17, y + 41) - 0.5) * tileSize * 0.03 * scale;
    const anchor = rock < 3 && outcropRoll > 0.42 ? 1.35 : 1;
    const rx = tileSize * (0.13 + hashNoise(x + 211, y + rock * 31) * 0.09) * scale * anchor;
    const ry = tileSize * (0.1 + hashNoise(x + rock * 43, y + 307) * 0.07) * scale * anchor;
    const points = 8;

    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const wobble = 0.76 + hashNoise(x + rock * 97 + i * 13, y + i * 29) * 0.38;
      const px = cx + Math.cos(angle) * rx * wobble;
      const py = cy + Math.sin(angle) * ry * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const shade = hashNoise(x + 401 + rock, y + 883);
    const base = Math.round(103 + shade * 30);
    ctx.fillStyle = `rgb(${base}, ${base - 5}, ${base - 16})`;
    ctx.fill();

    ctx.strokeStyle = 'rgba(47, 39, 31, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(214, 204, 181, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.28, cy - ry * 0.28, rx * 0.28, ry * 0.16, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(48, 40, 33, 0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.18, cy);
    ctx.lineTo(cx + rx * 0.12, cy + ry * 0.28);
    ctx.lineTo(cx + rx * 0.36, cy + ry * 0.08);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLargeTree(x, y, drawX, drawY) {
  if (isArabiaLikeMap()) {
    drawPineTree(x, y, drawX, drawY);
    return;
  }
  const treeType = Math.abs((x * 11 + y * 7 + Math.floor(hashNoise(x + 1201, y + 771) * 3))) % 3;
  if (treeType === 0) {
    drawPineTree(x, y, drawX, drawY);
    return;
  }
  if (treeType === 1) {
    drawPalmTree(x, y, drawX, drawY);
    return;
  }
  drawOakTree(x, y, drawX, drawY);
}

function drawOakTree(x, y, drawX, drawY) {
  const baseX = drawX + tileSize * (0.5 + (hashNoise(x + 43, y + 97) - 0.5) * 0.18);
  const baseY = drawY + tileSize * 0.9;
  const height = tileSize * (2.25 + hashNoise(x + 17, y + 211) * 0.45);
  const canopyRadius = tileSize * (0.92 + hashNoise(x + 89, y + 13) * 0.25);

  ctx.save();
  ctx.fillStyle = 'rgba(18, 9, 3, 0.26)';
  ctx.beginPath();
  ctx.ellipse(baseX + 5, baseY + 2, canopyRadius * 0.52, tileSize * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6a3d1e';
  ctx.beginPath();
  ctx.moveTo(baseX - 5, baseY);
  ctx.lineTo(baseX - 8, baseY - height * 0.55);
  ctx.quadraticCurveTo(baseX, baseY - height * 0.68, baseX + 8, baseY - height * 0.55);
  ctx.lineTo(baseX + 5, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(49, 27, 12, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX - 1, baseY - 3);
  ctx.lineTo(baseX - 3, baseY - height * 0.48);
  ctx.moveTo(baseX + 3, baseY - height * 0.18);
  ctx.lineTo(baseX + 14, baseY - height * 0.48);
  ctx.moveTo(baseX - 4, baseY - height * 0.25);
  ctx.lineTo(baseX - 17, baseY - height * 0.5);
  ctx.stroke();

  const canopyY = baseY - height * 0.75;
  const clusters = [
    { dx: -0.35, dy: 0.06, r: 0.58, c: '#1f512b' },
    { dx: 0.26, dy: 0.1, r: 0.64, c: '#286333' },
    { dx: 0.02, dy: -0.28, r: 0.72, c: '#214d2b' },
    { dx: -0.06, dy: 0.28, r: 0.55, c: '#2f7338' },
    { dx: 0.44, dy: -0.18, r: 0.46, c: '#356f38' }
  ];

  for (const cluster of clusters) {
    ctx.fillStyle = cluster.c;
    ctx.beginPath();
    ctx.arc(
      baseX + canopyRadius * cluster.dx,
      canopyY + canopyRadius * cluster.dy,
      canopyRadius * cluster.r,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(166, 199, 103, 0.28)';
  ctx.beginPath();
  ctx.arc(baseX - canopyRadius * 0.32, canopyY - canopyRadius * 0.28, canopyRadius * 0.18, 0, Math.PI * 2);
  ctx.arc(baseX + canopyRadius * 0.18, canopyY - canopyRadius * 0.36, canopyRadius * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPineTree(x, y, drawX, drawY) {
  const baseX = drawX + tileSize * (0.5 + (hashNoise(x + 421, y + 97) - 0.5) * 0.12);
  const baseY = drawY + tileSize * 0.92;
  const height = tileSize * (2.7 + hashNoise(x + 617, y + 211) * 0.6);
  const width = tileSize * (0.95 + hashNoise(x + 89, y + 613) * 0.22);
  const lean = (hashNoise(x + 337, y + 991) - 0.5) * tileSize * 0.16;

  ctx.save();
  ctx.fillStyle = 'rgba(14, 8, 3, 0.25)';
  ctx.beginPath();
  ctx.ellipse(baseX + 5, baseY + 2, width * 0.5, tileSize * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const trunkTopX = baseX + lean;
  const trunkTopY = baseY - height * 0.86;
  ctx.strokeStyle = '#6a3b1d';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + lean * 0.35, baseY - height * 0.45, trunkTopX, trunkTopY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(37, 20, 10, 0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const px = baseX + lean * t * t;
    const py = baseY - height * t * 0.82;
    ctx.beginPath();
    ctx.moveTo(px - 3, py);
    ctx.lineTo(px + 4, py - 3);
    ctx.stroke();
  }

  const layers = 8;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const layerY = baseY - height * (0.19 + t * 0.68);
    const layerX = baseX + lean * (0.18 + t * 0.75) + (hashNoise(x + i * 19, y + 31) - 0.5) * tileSize * 0.16;
    const layerWidth = width * (1.25 - t * 0.78) * (0.92 + hashNoise(x + i * 7, y + 17) * 0.18);
    const layerDepth = tileSize * (0.28 - t * 0.09);
    ctx.fillStyle = i % 3 === 0 ? '#173d25' : i % 3 === 1 ? '#215630' : '#12331f';
    ctx.beginPath();
    ctx.moveTo(layerX, layerY - layerDepth * 0.75);
    ctx.bezierCurveTo(layerX - layerWidth * 0.32, layerY - layerDepth * 0.2, layerX - layerWidth * 0.56, layerY + layerDepth * 0.2, layerX - layerWidth * 0.48, layerY + layerDepth);
    ctx.quadraticCurveTo(layerX, layerY + layerDepth * 0.62, layerX + layerWidth * 0.5, layerY + layerDepth);
    ctx.bezierCurveTo(layerX + layerWidth * 0.58, layerY + layerDepth * 0.18, layerX + layerWidth * 0.3, layerY - layerDepth * 0.22, layerX, layerY - layerDepth * 0.75);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(171, 207, 129, 0.16)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(layerX - layerWidth * 0.34, layerY + layerDepth * 0.08);
    ctx.lineTo(layerX + layerWidth * 0.28, layerY - layerDepth * 0.22);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(120, 166, 86, 0.2)';
  ctx.beginPath();
  ctx.moveTo(trunkTopX - width * 0.16, trunkTopY + height * 0.05);
  ctx.lineTo(trunkTopX, trunkTopY - height * 0.05);
  ctx.lineTo(trunkTopX + width * 0.12, trunkTopY + height * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPalmTree(x, y, drawX, drawY) {
  const baseX = drawX + tileSize * (0.5 + (hashNoise(x + 1821, y + 97) - 0.5) * 0.16);
  const baseY = drawY + tileSize * 0.92;
  const height = tileSize * (2.55 + hashNoise(x + 17, y + 1439) * 0.6);
  const lean = (hashNoise(x + 311, y + 1709) - 0.5) * tileSize * 0.58;
  const topX = baseX + lean;
  const topY = baseY - height;

  ctx.save();
  ctx.fillStyle = 'rgba(14, 8, 3, 0.24)';
  ctx.beginPath();
  ctx.ellipse(baseX + 5, baseY + 2, tileSize * 0.42, tileSize * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  const trunkGradient = ctx.createLinearGradient(baseX - 8, baseY, topX + 8, topY);
  trunkGradient.addColorStop(0, '#6f411f');
  trunkGradient.addColorStop(0.48, '#9c6835');
  trunkGradient.addColorStop(1, '#5a351b');
  ctx.strokeStyle = trunkGradient;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + lean * 0.32, baseY - height * 0.52, topX, topY);
  ctx.stroke();

  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const yPos = baseY - height * t;
    const xPos = baseX + lean * (t * 0.82 - t * (1 - t) * 0.16);
    const width = 8 - t * 3.4;
    ctx.strokeStyle = i % 2 ? 'rgba(68, 37, 15, 0.42)' : 'rgba(219, 151, 79, 0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(xPos - width, yPos + 1);
    ctx.lineTo(xPos + width, yPos - 4);
    ctx.stroke();
  }

  const fronds = 12;
  for (let i = 0; i < fronds; i++) {
    const angle = -Math.PI * 1.08 + (i / (fronds - 1)) * Math.PI * 1.86;
    const length = tileSize * (0.9 + hashNoise(x + i * 41, y + 907) * 0.48);
    const droop = 0.45 + hashNoise(x + i * 13, y + 233) * 0.42;
    const endX = topX + Math.cos(angle) * length;
    const endY = topY + Math.sin(angle) * length * droop + tileSize * 0.12;
    ctx.strokeStyle = i % 3 === 0 ? '#276d35' : i % 3 === 1 ? '#3f9046' : '#2f7c3b';
    ctx.lineWidth = 7.5 - Math.abs(i - fronds * 0.5) * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * length * 0.45,
      topY + Math.sin(angle) * length * 0.25 - 8,
      endX,
      endY
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(199, 225, 132, 0.28)';
    ctx.lineWidth = 1;
    for (let rib = 1; rib <= 3; rib++) {
      const t = rib / 4;
      const midX = topX + (endX - topX) * t;
      const midY = topY + (endY - topY) * t;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(angle + 0.8) * 5, midY + Math.sin(angle + 0.8) * 3);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#5f3a1a';
  for (let i = 0; i < 4; i++) {
    const angle = i / 4 * Math.PI * 2 + hashNoise(x + 77, y + 31);
    ctx.beginPath();
    ctx.arc(topX + Math.cos(angle) * 4, topY + 5 + Math.sin(angle) * 3, 3.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSheep(sheep) {
  if (sheep.isDead) {
    drawSheepSkeleton(sheep);
    return;
  }

  const bob = Math.sin(performance.now() * 0.0017 + sheep.phase) * 0.8;
  const sheepScale = 2.05;

  ctx.save();
  ctx.translate(sheep.x, sheep.y + bob);
  ctx.scale(sheep.facing * sheepScale, sheepScale);

  ctx.fillStyle = 'rgba(19, 10, 4, 0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff7e8';
  for (let i = 0; i < 5; i++) {
    const dx = -6 + i * 3.5;
    ctx.beginPath();
    ctx.arc(dx, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(54, 42, 30, 0.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3a3028';
  const walk = sheep.grazeTimer > 0
    ? 0
    : Math.sin(performance.now() * 0.006 + sheep.phase) * 1.2;
  const legPairs = [
    [-6, 5, -walk],
    [-2, 6, walk],
    [4, 6, -walk],
    [8, 5, walk]
  ];
  for (const [legX, legY, stride] of legPairs) {
    ctx.save();
    ctx.translate(legX, legY);
    ctx.rotate(stride * 0.08);
    ctx.fillRect(-0.8, 0, 1.8, 7);
    ctx.fillRect(-1.3, 6.2, 3, 1.5);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.ellipse(12, -1, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff8e8';
  ctx.fillRect(13, -3, 1, 1);
  ctx.restore();
}

function drawRoast(roast) {
  const flame = 1 + Math.sin(roast.age * 11) * 0.12;
  ctx.save();
  ctx.translate(roast.x, roast.y);

  ctx.fillStyle = 'rgba(32, 18, 8, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#5a3218';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-18, 8);
  ctx.lineTo(18, -4);
  ctx.moveTo(-18, -4);
  ctx.lineTo(18, 8);
  ctx.stroke();

  ctx.fillStyle = '#e8521b';
  ctx.beginPath();
  ctx.moveTo(-10, 5);
  ctx.quadraticCurveTo(-2, -17 * flame, 0, -2);
  ctx.quadraticCurveTo(8, -20 * flame, 11, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd35a';
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.quadraticCurveTo(0, -10 * flame, 5, 5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#3f2918';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-28, -18);
  ctx.lineTo(28, -18);
  ctx.stroke();

  ctx.translate(0, -18);
  ctx.rotate(roast.rotation);
  ctx.fillStyle = '#8a3f20';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d09255';
  ctx.lineWidth = 2;
  for (const x of [-9, -3, 4, 10]) {
    ctx.beginPath();
    ctx.moveTo(x, -5);
    ctx.lineTo(x + 3, 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSheepSkeleton(sheep) {
  ctx.save();
  ctx.translate(sheep.x, sheep.y + 6);
  ctx.rotate((hashNoise(Math.floor(sheep.x), Math.floor(sheep.y)) - 0.5) * 0.18);
  ctx.scale(sheep.facing * 1.48, 1.48);

  ctx.fillStyle = 'rgba(19, 10, 4, 0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 16, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#eadfc7';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-3, -2, 10, 0);
  for (let i = -8; i <= 6; i += 3.5) {
    ctx.moveTo(i, -2.2);
    ctx.quadraticCurveTo(i + 1.4, 1, i + 1, 5);
    ctx.moveTo(i, 2.1);
    ctx.lineTo(i + 3, -1.3);
  }
  ctx.moveTo(-10, 2);
  ctx.lineTo(-16, 8);
  ctx.moveTo(-4, 3);
  ctx.lineTo(-8, 10);
  ctx.moveTo(5, 2);
  ctx.lineTo(10, 10);
  ctx.moveTo(10, 1);
  ctx.lineTo(16, 8);
  ctx.stroke();

  ctx.fillStyle = '#f1e6ce';
  ctx.strokeStyle = '#cfc2a8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(14, -2, 5, 4.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4a3523';
  ctx.beginPath();
  ctx.arc(12.4, -2.8, 0.9, 0, Math.PI * 2);
  ctx.arc(15.4, -2.7, 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#eadfc7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(17.8, -1.3);
  ctx.lineTo(21, -3.2);
  ctx.moveTo(18, 0.2);
  ctx.lineTo(21, 1.1);
  ctx.stroke();

  ctx.restore();
}

function drawDuck(duck) {
  if (duck.isDead) {
    ctx.save();
    ctx.translate(duck.x, duck.y + 3);
    ctx.scale(duck.facing * 1.1, 1.1);
    ctx.strokeStyle = '#efe2bd';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(-3, 1);
    ctx.lineTo(-7, 6);
    ctx.moveTo(3, 1);
    ctx.lineTo(8, 5);
    ctx.stroke();
    ctx.fillStyle = '#efe2bd';
    ctx.beginPath();
    ctx.arc(9, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const bob = Math.sin(performance.now() * 0.003 + duck.bobPhase) * 0.8;

  ctx.save();
  ctx.translate(duck.x, duck.y + bob);
  ctx.scale(duck.facing, 1);

  ctx.fillStyle = 'rgba(11, 42, 55, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f1e9c8';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d6c28e';
  ctx.beginPath();
  ctx.ellipse(-3, 0, 6, 4, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#23452c';
  ctx.beginPath();
  ctx.arc(8, -5, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d88b2d';
  ctx.beginPath();
  ctx.moveTo(11, -5);
  ctx.lineTo(17, -7);
  ctx.lineTo(17, -3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff8e8';
  ctx.beginPath();
  ctx.arc(9.5, -6.2, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 244, 210, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-7, 3, 7 + Math.sin(performance.now() * 0.004 + duck.phase), 0.15, Math.PI * 0.95);
  ctx.stroke();

  ctx.restore();
}

function drawHorse(horse) {
  const bob = Math.sin(performance.now() * 0.003 + horse.phase) * 0.7;
  const stride = horse.grazeTimer > 0
    ? 0
    : Math.sin(performance.now() * 0.006 + horse.phase) * 1.35;

  ctx.save();
  ctx.translate(horse.x, horse.y + bob);
  ctx.scale(horse.facing, 1);

  ctx.fillStyle = 'rgba(25, 12, 5, 0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8a552e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6b3d1f';
  ctx.beginPath();
  ctx.moveTo(-17, -1);
  ctx.lineTo(-31, -8);
  ctx.lineTo(-25, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2d1a10';
  ctx.fillRect(-13, -9, 8, 10);
  ctx.beginPath();
  ctx.ellipse(20, -6, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(17, -13, 3, 8);
  ctx.fillRect(23, -13, 3, 8);

  ctx.fillStyle = '#3a2113';
  const legs = [-12, -4, 8, 16];
  legs.forEach((legX, index) => {
    const swing = index % 2 === 0 ? -stride : stride;
    ctx.save();
    ctx.translate(legX, 6);
    ctx.rotate(swing * 0.05);
    ctx.fillRect(-1.4, 0, 2.8, 11);
    ctx.fillRect(-2.4, 10, 4.8, 2);
    ctx.restore();
  });

  ctx.restore();
}

function drawGoldMine(mine) {
  const depletion = mine.maxAmount > 0 ? 1 - (mine.amount / mine.maxAmount) : 1;
  const pulse = Math.sin(performance.now() * 0.002 + mine.tileX) * 0.08;
  ctx.save();
  ctx.translate(mine.x, mine.y);

  ctx.fillStyle = 'rgba(23, 12, 4, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, tileSize * 0.54, tileSize * 1.48, tileSize * 0.48, -0.08, 0, Math.PI * 2);
  ctx.fill();

  const rocks = 18;
  for (let i = 0; i < rocks; i++) {
    const angle = (i / rocks) * Math.PI * 2 + hashNoise(mine.tileX + i, mine.tileY) * 0.4;
    const radius = tileSize * (0.18 + hashNoise(mine.tileX + i * 9, mine.tileY + 3) * 0.82);
    const size = tileSize * (0.24 + hashNoise(mine.tileX + i * 5, mine.tileY + 11) * 0.28) * (1 - depletion * 0.35);
    ctx.save();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72);
    ctx.rotate(angle * 0.35);
    ctx.fillStyle = i % 2 ? '#625b51' : '#777066';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.25, size * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31, 25, 19, 0.38)';
    ctx.stroke();
    if (i % 3 !== 0 && depletion < 0.9) {
      ctx.fillStyle = `rgba(222, 171, 45, ${0.78 + pulse})`;
      ctx.beginPath();
      ctx.ellipse(size * 0.18, -size * 0.06, size * 0.35, size * 0.16, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

function createBuildingGradient(x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

function drawRoundedRectPath(x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(w) * 0.5, Math.abs(h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBuildingShadow(w, h, alpha = 0.22) {
  ctx.fillStyle = `rgba(22, 12, 5, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.36, w * 0.56, h * 0.18, -0.03, 0, Math.PI * 2);
  ctx.fill();
}

function drawStoneSurface(x, y, w, h, seedX, seedY, palette = {}) {
  const light = palette.light || '#b6b3a3';
  const mid = palette.mid || '#87897f';
  const dark = palette.dark || '#5f625b';
  const stroke = palette.stroke || 'rgba(38, 40, 36, 0.46)';

  ctx.fillStyle = createBuildingGradient(x, y, x + w * 0.25, y + h, [
    [0, light],
    [0.42, mid],
    [1, dark]
  ]);
  drawRoundedRectPath(x, y, w, h, Math.min(tileSize * 0.16, w * 0.12, h * 0.12));
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, tileSize * 0.045);
  ctx.stroke();

  const course = Math.max(8, tileSize * 0.2);
  ctx.lineWidth = 1;
  for (let row = 0; row < Math.max(1, Math.floor(h / course)); row++) {
    const yy = y + row * course + course * 0.78;
    ctx.strokeStyle = row % 2 ? 'rgba(50, 48, 42, 0.24)' : 'rgba(240, 235, 215, 0.14)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, yy);
    ctx.lineTo(x + w * 0.94, yy + (row % 2 ? 1 : -1));
    ctx.stroke();

    const stones = Math.max(2, Math.floor(w / (tileSize * 0.52)));
    for (let col = 0; col < stones; col++) {
      const n = hashNoise(seedX + row * 17 + col * 5, seedY + row * 7);
      const sx = x + (col + 0.18 + n * 0.16) * (w / stones);
      const sy = y + row * course + course * 0.15;
      const sw = Math.max(tileSize * 0.18, (w / stones) * (0.42 + n * 0.16));
      const sh = course * (0.38 + hashNoise(seedX + col, seedY + row * 13) * 0.16);
      ctx.fillStyle = n > 0.66 ? 'rgba(255,255,240,0.08)' : 'rgba(30,28,24,0.08)';
      drawRoundedRectPath(sx, sy, sw, sh, 2);
      ctx.fill();
    }
  }
}

function drawWoodPlanks(x, y, w, h, seedX, seedY) {
  ctx.fillStyle = createBuildingGradient(x, y, x + w * 0.35, y + h, [
    [0, '#a07449'],
    [0.58, '#7f5632'],
    [1, '#54321d']
  ]);
  drawRoundedRectPath(x, y, w, h, tileSize * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 30, 16, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const planks = Math.max(4, Math.floor(w / (tileSize * 0.34)));
  for (let i = 1; i < planks; i++) {
    const px = x + (w * i) / planks + (hashNoise(seedX + i, seedY) - 0.5) * 3;
    ctx.strokeStyle = i % 2 ? 'rgba(64, 37, 20, 0.38)' : 'rgba(228, 176, 110, 0.16)';
    ctx.beginPath();
    ctx.moveTo(px, y + h * 0.08);
    ctx.lineTo(px + Math.sin(i) * 2, y + h * 0.92);
    ctx.stroke();
  }
}

function drawThatchRoof(w, h, raised = false) {
  const roofTop = raised ? -h * 0.64 : -h * 0.56;
  const roofBase = -h * 0.14;
  ctx.fillStyle = createBuildingGradient(0, roofTop, 0, roofBase, [
    [0, '#d5b66c'],
    [0.5, '#9b7137'],
    [1, '#624326']
  ]);
  ctx.beginPath();
  ctx.moveTo(-w * 0.54, roofBase);
  ctx.quadraticCurveTo(-w * 0.24, roofTop + h * 0.03, 0, roofTop);
  ctx.quadraticCurveTo(w * 0.25, roofTop + h * 0.03, w * 0.54, roofBase);
  ctx.quadraticCurveTo(0, roofBase + h * 0.08, -w * 0.54, roofBase);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(55, 34, 18, 0.62)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 232, 160, 0.22)';
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    const sx = i * w * 0.085;
    ctx.beginPath();
    ctx.moveTo(sx * 0.32, roofTop + h * 0.03);
    ctx.quadraticCurveTo(sx * 0.75, roofTop + h * 0.2, sx, roofBase + h * 0.02);
    ctx.stroke();
  }
}

function drawNeutralHouse(house) {
  const w = house.width * tileSize;
  const h = house.height * tileSize;
  const occupied = (house.occupants?.length || 0) > 0;
  ctx.save();
  ctx.translate(house.x, house.y);

  drawBuildingShadow(w, h, house.burning ? 0.34 : 0.24);

  if (house.isWreck) {
    drawWoodPlanks(-w * 0.42, -h * 0.14, w * 0.84, h * 0.4, house.tileX, house.tileY);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#26201b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, -h * 0.22);
    ctx.lineTo(-w * 0.08, -h * 0.42);
    ctx.lineTo(w * 0.12, -h * 0.2);
    ctx.lineTo(w * 0.44, -h * 0.34);
    ctx.lineTo(w * 0.32, -h * 0.08);
    ctx.lineTo(-w * 0.36, h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#18110c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -h * 0.2);
    ctx.lineTo(w * 0.34, h * 0.2);
    ctx.moveTo(w * 0.36, -h * 0.28);
    ctx.lineTo(-w * 0.34, h * 0.2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  drawWoodPlanks(-w * 0.38, -h * 0.16, w * 0.76, h * 0.48, house.tileX, house.tileY);

  ctx.fillStyle = '#2d1a10';
  drawRoundedRectPath(-w * 0.085, h * 0.04, w * 0.17, h * 0.28, tileSize * 0.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217, 159, 83, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!occupied) {
    drawThatchRoof(w, h);
  } else {
    ctx.fillStyle = 'rgba(28, 17, 10, 0.58)';
    drawRoundedRectPath(-w * 0.31, -h * 0.1, w * 0.62, h * 0.26, tileSize * 0.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(184, 143, 88, 0.32)';
    ctx.fillRect(-w * 0.22, -h * 0.02, w * 0.44, h * 0.035);
  }

  ctx.fillStyle = '#1b120b';
  for (const wx of [-w * 0.24, w * 0.24]) {
    drawRoundedRectPath(wx - w * 0.045, -h * 0.03, w * 0.09, h * 0.1, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 198, 109, 0.42)';
    ctx.stroke();
  }

  if (house.burning) {
    const t = performance.now() * 0.006;
    for (let i = 0; i < 5; i++) {
      const fx = (i - 2) * w * 0.13;
      const fy = -h * 0.2 + Math.sin(t + i) * 3;
      ctx.fillStyle = i % 2 ? '#f4b03a' : '#c94322';
      ctx.beginPath();
      ctx.moveTo(fx, fy - h * 0.24);
      ctx.quadraticCurveTo(fx + 8, fy - h * 0.06, fx, fy + h * 0.08);
      ctx.quadraticCurveTo(fx - 8, fy - h * 0.06, fx, fy - h * 0.24);
      ctx.fill();
    }
  }

  if (house.selected) {
    ctx.strokeStyle = 'rgba(255, 225, 140, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.34, w * 0.52, h * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacle(obstacleType, x, y, drawX, drawY) {
  if (obstacleType === OBSTACLE.NONE) return;

  if (obstacleType === OBSTACLE.ROCK) {
    drawIrregularRock(x, y, drawX, drawY);
    return;
  }

  // Soft grounding shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(drawX + tileSize * 0.5, drawY + tileSize * 0.8, tileSize * 0.28, tileSize * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obstacleType === OBSTACLE.TREE) {
    drawLargeTree(x, y, drawX, drawY);
    return;
  }

  if (obstacleType === OBSTACLE.SHRUB) {
    ctx.fillStyle = '#3f7d3f';
    ctx.beginPath();
    ctx.arc(drawX + tileSize * 0.42, drawY + tileSize * 0.62, tileSize * 0.12, 0, Math.PI * 2);
    ctx.arc(drawX + tileSize * 0.56, drawY + tileSize * 0.6, tileSize * 0.13, 0, Math.PI * 2);
    ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.54, tileSize * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  drawIrregularRock(x, y, drawX, drawY);
}

function renderMap() {
  const camX = camera ? camera.x : 0;
  const camY = camera ? camera.y : 0;
  const zoom = camera ? camera.zoom : 1;
  const viewWidth = camera ? camera.viewportWidth / zoom : canvas.width;
  const viewHeight = camera ? camera.viewportHeight / zoom : canvas.height;
  const mapWidth = getMapWidthPx();
  const mapHeight = getMapHeightPx();

  if (terrainRenderCanvas) {
    const sx = Math.max(0, Math.floor(camX));
    const sy = Math.max(0, Math.floor(camY));
    const sw = Math.min(mapWidth - sx, Math.ceil(viewWidth) + 2);
    const sh = Math.min(mapHeight - sy, Math.ceil(viewHeight) + 2);
    ctx.drawImage(terrainRenderCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  renderWaterRipples(camX, camY, viewWidth, viewHeight);

  const startX = Math.max(0, Math.floor(camX / tileSize));
  const endX = Math.min(terrainData[0].length - 1, Math.floor((camX + viewWidth) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(camY / tileSize));
  const endY = Math.min(terrainData.length - 1, Math.floor((camY + viewHeight) / tileSize) + 1);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const terrainType = terrainData[y][x];
      const drawX = x * tileSize;
      const drawY = y * tileSize;

      drawGroundDecor(decorationData[y][x], terrainType, x, y, drawX, drawY);
    }
  }
}

function renderWaterRipples(camX, camY, viewWidth, viewHeight) {
  OpenRTS.rendering.canvas.terrainPainter.renderWaterRipples(ctx, {
    camX,
    camY,
    viewWidth,
    viewHeight,
    terrainData,
    rows: MAP_ROWS,
    columns: MAP_COLS,
    terrain: TERRAIN,
    tileSize,
    timeSeconds: performance.now() * 0.001,
    noise: hashNoise,
    volcanic: isVolcanicTerrain()
  });
}

function drawBuilding(building, layer = 'full') {
  if (!building || building.isDead) return;

  if (building.type === BUILDING_TYPES.HOME && layer === 'base') {
    drawHomeBuilding(building, 'base');
    return;
  }

  if (building.selected && layer !== 'base') {
    drawBuildingSelection(building);
  }

  const isTowerModel = building.type === BUILDING_TYPES.TOWER || building.model === 'arrow_tower' || /tower/i.test(String(building.type || ''));
  if (isStarSiegeBuilding(building)) {
    drawStarSiegeBuilding(building, layer);
  } else if (isTowerModel) {
    drawTowerBuilding(building);
  } else {
    drawHomeBuilding(building, layer);
  }

  if (building.selected && layer !== 'base') {
    drawBuildingHealth(building);
  }
}

function getTeamAccent(team) {
  return typeof getTeamColor === 'function' ? getTeamColor(team) : (team === 'red' ? '#b63b32' : '#2f66b7');
}

function isStarSiegeBuilding(building) {
  return /^ss_/.test(String(building?.definitionType || building?.model || ''));
}

function getStarSiegeStyle(building) {
  const id = String(building?.definitionType || building?.model || '');
  if (id.includes('alien')) {
    return {
      family: 'alien',
      base: '#315a2d',
      mid: '#5f9f48',
      dark: '#1f321d',
      glow: '#a9ff72'
    };
  }
  if (id.includes('cyber')) {
    return {
      family: 'cyber',
      base: '#4e3a8b',
      mid: '#8b65de',
      dark: '#271f47',
      glow: '#c8a5ff'
    };
  }
  return {
    family: 'human',
    base: '#536b7f',
    mid: '#8da9ba',
    dark: '#263540',
    glow: '#83dcff'
  };
}

function getStarSiegeHqStyle(building) {
  const id = String(building?.definitionType || building?.model || building?.hqStyle || '');
  const tags = Array.isArray(building?.tags) ? building.tags.join(' ') : '';
  const marker = `${id} ${tags} ${building?.hqStyle || ''}`;
  if (/command_center|command_hub|human_command/i.test(marker)) return 'command_center';
  if (/nexus|cyber_nexus/i.test(marker)) return 'nexus';
  if (/hatchery|alien_hive|alien_hatchery/i.test(marker)) return 'hatchery';
  return '';
}

function drawStarSiegeCommandCenterBase(building, style) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;

  drawBuildingShadow(w, h, 0.2);

  ctx.fillStyle = 'rgba(12, 20, 25, 0.78)';
  ctx.beginPath();
  ctx.ellipse(0, top + h * 0.69, w * 0.48, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = createBuildingGradient(left + w * 0.14, top + h * 0.54, left + w * 0.86, top + h * 0.84, [
    [0, '#6f8792'],
    [0.48, '#3f5561'],
    [1, '#17252d']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.12, top + h * 0.67);
  ctx.lineTo(left + w * 0.26, top + h * 0.54);
  ctx.lineTo(left + w * 0.74, top + h * 0.54);
  ctx.lineTo(left + w * 0.88, top + h * 0.67);
  ctx.lineTo(left + w * 0.78, top + h * 0.82);
  ctx.lineTo(left + w * 0.22, top + h * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(7, 13, 17, 0.78)';
  ctx.lineWidth = Math.max(2, tileSize * 0.04);
  ctx.stroke();

  ctx.fillStyle = createBuildingGradient(left + w * 0.17, top + h * 0.14, left + w * 0.82, top + h * 0.72, [
    [0, '#edf9fb'],
    [0.22, '#bad2da'],
    [0.62, style.mid],
    [1, '#2a3e49']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.16, top + h * 0.62);
  ctx.bezierCurveTo(left + w * 0.18, top + h * 0.26, left + w * 0.35, top + h * 0.1, left + w * 0.5, top + h * 0.1);
  ctx.bezierCurveTo(left + w * 0.65, top + h * 0.1, left + w * 0.82, top + h * 0.26, left + w * 0.84, top + h * 0.62);
  ctx.bezierCurveTo(left + w * 0.74, top + h * 0.72, left + w * 0.26, top + h * 0.72, left + w * 0.16, top + h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(17, 29, 38, 0.75)';
  ctx.lineWidth = Math.max(2, tileSize * 0.04);
  ctx.stroke();

  ctx.fillStyle = 'rgba(196, 225, 232, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, top + h * 0.38, w * 0.24, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(238, 252, 255, 0.42)';
  ctx.lineWidth = Math.max(1, tileSize * 0.025);
  for (const panelX of [0.3, 0.4, 0.6, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(left + w * 0.5, top + h * 0.12);
    ctx.quadraticCurveTo(left + w * panelX, top + h * 0.33, left + w * panelX, top + h * 0.66);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(12, 23, 30, 0.42)';
  ctx.lineWidth = Math.max(2, tileSize * 0.032);
  for (const bandY of [0.44, 0.58]) {
    ctx.beginPath();
    ctx.ellipse(0, top + h * bandY, w * (0.18 + bandY * 0.34), h * 0.045, 0, 0.08, Math.PI - 0.08);
    ctx.stroke();
  }

  ctx.fillStyle = '#21333d';
  for (const pod of [[0.15, 0.62], [0.85, 0.62]]) {
    drawRoundedRectPath(left + w * pod[0] - w * 0.075, top + h * pod[1] - h * 0.045, w * 0.15, h * 0.09, Math.max(4, tileSize * 0.04));
    ctx.fill();
    ctx.strokeStyle = 'rgba(8, 15, 19, 0.75)';
    ctx.lineWidth = Math.max(1.5, tileSize * 0.025);
    ctx.stroke();
  }

  ctx.fillStyle = style.glow;
  ctx.globalAlpha = 0.55;
  for (const light of [[0.25, 0.68], [0.75, 0.68], [0.38, 0.76], [0.62, 0.76]]) {
    ctx.beginPath();
    ctx.arc(left + w * light[0], top + h * light[1], Math.max(2.5, tileSize * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStarSiegeNexusBase(building, style) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;

  drawBuildingShadow(w, h, 0.15);
  ctx.fillStyle = createBuildingGradient(left + w * 0.22, top + h * 0.1, left + w * 0.78, top + h * 0.9, [
    [0, '#d9bd6f'],
    [0.46, '#7662bb'],
    [1, '#261b45']
  ]);
  ctx.beginPath();
  ctx.moveTo(0, top + h * 0.1);
  ctx.lineTo(left + w * 0.82, top + h * 0.42);
  ctx.lineTo(left + w * 0.64, top + h * 0.84);
  ctx.lineTo(0, top + h * 0.95);
  ctx.lineTo(left + w * 0.36, top + h * 0.84);
  ctx.lineTo(left + w * 0.18, top + h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 24, 68, 0.75)';
  ctx.lineWidth = Math.max(2, tileSize * 0.04);
  ctx.stroke();

  ctx.fillStyle = 'rgba(242, 214, 124, 0.8)';
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * w * 0.18, top + h * 0.54 + Math.sin(angle) * h * 0.08);
    ctx.lineTo(Math.cos(angle) * w * 0.34, top + h * 0.54 + Math.sin(angle) * h * 0.18);
    ctx.lineTo(Math.cos(angle + 0.18) * w * 0.25, top + h * 0.54 + Math.sin(angle + 0.18) * h * 0.12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStarSiegeHatcheryBase(building, style) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;

  drawBuildingShadow(w, h, 0.22);
  ctx.fillStyle = createBuildingGradient(left + w * 0.18, top + h * 0.12, left + w * 0.78, top + h * 0.9, [
    [0, '#8dc665'],
    [0.52, '#456d36'],
    [1, '#1e2b19']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.12, top + h * 0.58);
  ctx.bezierCurveTo(left + w * 0.18, top + h * 0.22, left + w * 0.52, top + h * 0.12, left + w * 0.75, top + h * 0.31);
  ctx.bezierCurveTo(left + w * 0.98, top + h * 0.5, left + w * 0.86, top + h * 0.86, left + w * 0.52, top + h * 0.9);
  ctx.bezierCurveTo(left + w * 0.25, top + h * 0.94, left + w * 0.03, top + h * 0.78, left + w * 0.12, top + h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 48, 22, 0.7)';
  ctx.lineWidth = Math.max(2, tileSize * 0.04);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(28, 70, 28, 0.52)';
  ctx.lineWidth = Math.max(3, tileSize * 0.06);
  for (let i = 0; i < 9; i++) {
    const angle = (Math.PI * 2 * i) / 9;
    const sx = Math.cos(angle) * w * 0.2;
    const sy = top + h * 0.58 + Math.sin(angle) * h * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx * 0.35, top + h * 0.54);
    ctx.quadraticCurveTo(sx * 0.95, sy, sx * 1.35, sy + Math.sin(angle) * h * 0.08);
    ctx.stroke();
  }
}

function drawStarSiegeBuildingBase(building) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const style = getStarSiegeStyle(building);
  const hqStyle = getStarSiegeHqStyle(building);

  ctx.save();
  ctx.translate(building.x, building.y);

  if (hqStyle === 'command_center') {
    drawStarSiegeCommandCenterBase(building, style);
    ctx.restore();
    return;
  }
  if (hqStyle === 'nexus') {
    drawStarSiegeNexusBase(building, style);
    ctx.restore();
    return;
  }
  if (hqStyle === 'hatchery') {
    drawStarSiegeHatcheryBase(building, style);
    ctx.restore();
    return;
  }

  drawBuildingShadow(w, h, style.family === 'alien' ? 0.2 : 0.16);

  if (style.family === 'alien') {
    ctx.fillStyle = createBuildingGradient(left + w * 0.2, top, left + w * 0.78, top + h, [
      [0, '#76bd58'],
      [0.55, style.base],
      [1, style.dark]
    ]);
    ctx.beginPath();
    ctx.ellipse(0, top + h * 0.54, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 38, 18, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const sx = Math.cos(angle) * w * 0.26;
      const sy = top + h * 0.55 + Math.sin(angle) * h * 0.2;
      ctx.strokeStyle = 'rgba(28, 68, 26, 0.46)';
      ctx.lineWidth = Math.max(2, tileSize * 0.04);
      ctx.beginPath();
      ctx.moveTo(sx * 0.35, top + h * 0.54);
      ctx.quadraticCurveTo(sx * 0.75, sy, sx, sy);
      ctx.stroke();
    }
  } else if (style.family === 'cyber') {
    ctx.fillStyle = createBuildingGradient(left + w * 0.18, top + h * 0.1, left + w * 0.82, top + h * 0.86, [
      [0, style.mid],
      [0.52, style.base],
      [1, style.dark]
    ]);
    ctx.beginPath();
    ctx.moveTo(0, top + h * 0.1);
    ctx.lineTo(left + w * 0.78, top + h * 0.48);
    ctx.lineTo(left + w * 0.62, top + h * 0.84);
    ctx.lineTo(0, top + h * 0.92);
    ctx.lineTo(left + w * 0.38, top + h * 0.84);
    ctx.lineTo(left + w * 0.22, top + h * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(25, 16, 54, 0.68)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = createBuildingGradient(left + w * 0.14, top + h * 0.28, left + w * 0.86, top + h * 0.82, [
      [0, style.mid],
      [0.54, style.base],
      [1, style.dark]
    ]);
    ctx.beginPath();
    ctx.moveTo(left + w * 0.18, top + h * 0.42);
    ctx.lineTo(left + w * 0.82, top + h * 0.32);
    ctx.lineTo(left + w * 0.9, top + h * 0.7);
    ctx.lineTo(left + w * 0.72, top + h * 0.88);
    ctx.lineTo(left + w * 0.24, top + h * 0.84);
    ctx.lineTo(left + w * 0.1, top + h * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(19, 30, 38, 0.68)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawStarSiegeBuildingFront(building) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const style = getStarSiegeStyle(building);
  const hqStyle = getStarSiegeHqStyle(building);
  const accent = getTeamAccent(building.team);
  const isDefense = /turret|spire|colony/i.test(String(building.definitionType || building.model || ''));
  const isSupply = /depot|pylon|node/i.test(String(building.definitionType || building.model || ''));

  ctx.save();
  ctx.translate(building.x, building.y);

  if (hqStyle === 'command_center') {
    ctx.fillStyle = '#111f27';
    drawRoundedRectPath(left + w * 0.38, top + h * 0.59, w * 0.24, h * 0.19, Math.max(6, tileSize * 0.09));
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 20, 25, 0.88)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = style.glow;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.43, top + h * 0.65);
    ctx.lineTo(left + w * 0.57, top + h * 0.65);
    ctx.moveTo(left + w * 0.5, top + h * 0.6);
    ctx.lineTo(left + w * 0.5, top + h * 0.77);
    ctx.stroke();

    ctx.fillStyle = '#10232c';
    ctx.beginPath();
    ctx.ellipse(left + w * 0.5, top + h * 0.31, w * 0.09, h * 0.052, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = Math.max(1.5, tileSize * 0.03);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(left + w * 0.5, top + h * 0.31, Math.max(4, tileSize * 0.075), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#dff8ff';
    for (const wx of [0.28, 0.36, 0.64, 0.72]) {
      ctx.beginPath();
      ctx.ellipse(left + w * wx, top + h * 0.5, w * 0.035, h * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.68, top + h * 0.28);
    ctx.lineTo(left + w * 0.83, top + h * 0.1);
    ctx.moveTo(left + w * 0.83, top + h * 0.1);
    ctx.lineTo(left + w * 0.91, top + h * 0.1);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(223, 248, 255, 0.32)';
    ctx.lineWidth = Math.max(1, tileSize * 0.02);
    for (const arc of [0.27, 0.35, 0.43]) {
      ctx.beginPath();
      ctx.ellipse(0, top + h * arc, w * (0.12 + arc * 0.5), h * 0.03, 0, 0.12, Math.PI - 0.12);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(131, 220, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, top + h * 0.42, w * 0.25, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (hqStyle === 'nexus') {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = style.glow;
    ctx.beginPath();
    ctx.ellipse(0, top + h * 0.55, w * 0.3, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#d9f3ff';
    ctx.beginPath();
    ctx.moveTo(0, top + h * 0.26);
    ctx.lineTo(w * 0.08, top + h * 0.49);
    ctx.lineTo(0, top + h * 0.64);
    ctx.lineTo(-w * 0.08, top + h * 0.49);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8fdfff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = style.glow;
    ctx.lineWidth = Math.max(1.5, tileSize * 0.035);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * w * 0.08, top + h * 0.53 + Math.sin(angle) * h * 0.04);
      ctx.lineTo(Math.cos(angle) * w * 0.33, top + h * 0.53 + Math.sin(angle) * h * 0.18);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (hqStyle === 'hatchery') {
    ctx.fillStyle = '#23341f';
    for (const sac of [[0.33, 0.39, 0.1], [0.53, 0.31, 0.12], [0.69, 0.45, 0.08]]) {
      ctx.beginPath();
      ctx.ellipse(left + w * sac[0], top + h * sac[1], w * sac[2], h * sac[2] * 1.15, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.glow;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(173, 255, 122, 0.75)';
    ctx.lineWidth = Math.max(1.5, tileSize * 0.035);
    ctx.beginPath();
    ctx.arc(0, top + h * 0.56, Math.min(w, h) * 0.14, 0.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = style.glow;
  ctx.beginPath();
  ctx.ellipse(0, top + h * 0.55, w * (isSupply ? 0.16 : 0.22), h * (isSupply ? 0.12 : 0.08), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (style.family === 'alien') {
    ctx.fillStyle = '#1c2a19';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * w * 0.14, top + h * 0.38, w * 0.08, h * 0.14, i * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = Math.max(1.4, tileSize * 0.035);
    ctx.beginPath();
    ctx.arc(0, top + h * 0.5, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (style.family === 'cyber') {
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = Math.max(1.4, tileSize * 0.035);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * 0.5 * i + 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * w * 0.08, top + h * 0.54 + Math.sin(angle) * h * 0.04);
      ctx.lineTo(Math.cos(angle) * w * 0.28, top + h * 0.54 + Math.sin(angle) * h * 0.16);
      ctx.stroke();
    }
    ctx.fillStyle = style.glow;
    ctx.beginPath();
    ctx.arc(0, top + h * 0.48, Math.max(4, tileSize * 0.1), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1d2a32';
    for (const wx of [left + w * 0.32, left + w * 0.48, left + w * 0.64]) {
      drawRoundedRectPath(wx, top + h * 0.48, w * 0.07, h * 0.055, 2);
      ctx.fill();
      ctx.strokeStyle = style.glow;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.22, top + h * 0.38);
    ctx.lineTo(left + w * 0.44, top + h * 0.34);
    ctx.stroke();
  }

  if (isDefense) {
    ctx.fillStyle = style.dark;
    ctx.beginPath();
    ctx.arc(0, top + h * 0.28, Math.max(5, tileSize * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, top + h * 0.28);
    ctx.lineTo(w * 0.26, top + h * 0.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStarSiegeBuilding(building, layer = 'full') {
  if (layer === 'base') {
    drawStarSiegeBuildingBase(building);
    return;
  }
  if (layer === 'front') {
    drawStarSiegeBuildingFront(building);
    return;
  }
  drawStarSiegeBuildingBase(building);
  drawStarSiegeBuildingFront(building);
}

function drawBuildingSelection(building) {
  const w = building.width * tileSize;
  const h = building.height * tileSize;

  ctx.save();
  ctx.strokeStyle = building.team === 'red' ? 'rgba(255, 196, 118, 0.95)' : 'rgba(173, 220, 255, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(building.x, building.y + h * 0.34, w * 0.5, h * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBuildingHealth(building) {
  const w = Math.max(62, building.width * tileSize * 0.85);
  const barHeight = 7;
  const x = building.x - w * 0.5;
  const y = building.y - building.height * tileSize * 0.64;
  const ratio = Math.max(0, Math.min(1, building.hp / building.maxHp));

  ctx.save();
  ctx.font = 'bold 12px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(42, 25, 12, 0.86)';
  ctx.strokeText(`${Math.ceil(building.hp)} / ${building.maxHp}`, building.x, y - 4);
  ctx.fillStyle = '#fff0c9';
  ctx.fillText(`${Math.ceil(building.hp)} / ${building.maxHp}`, building.x, y - 4);

  ctx.fillStyle = 'rgba(41, 24, 12, 0.92)';
  ctx.fillRect(x, y, w, barHeight);
  ctx.fillStyle = ratio > 0.5 ? '#5bbf55' : ratio > 0.25 ? '#d8a733' : '#a8362e';
  ctx.fillRect(x, y, w * ratio, barHeight);
  ctx.strokeStyle = 'rgba(255, 225, 151, 0.82)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, barHeight);
  ctx.restore();
}

function getBuildPlacementPreview() {
  const buildingType = OpenRTS.ui?.commandTargeting?.getBuildPlacementType?.();
  if (!buildingType || !inputState?.mouseInside || typeof screenToWorld !== 'function') return null;

  const stats = getBuildingStats(buildingType);
  const width = Math.max(1, Math.floor(Number(stats.width) || 1));
  const height = Math.max(1, Math.floor(Number(stats.height) || 1));
  const world = screenToWorld(inputState.mouseX, inputState.mouseY);
  const site = findNearestBuildableSite(buildingType, world.x, world.y, 8, { stats });
  const tileX = site?.x ?? Math.floor(world.x / tileSize - width * 0.5);
  const tileY = site?.y ?? Math.floor(world.y / tileSize - height * 0.5);
  const team = OpenRTS.ui.commandTargeting?.selectedUnits?.()[0]?.team || 'neutral';

  return {
    valid: !!site,
    building: {
      id: 'build-preview',
      type: buildingType,
      team,
      tileX,
      tileY,
      width,
      height,
      x: (tileX + width * 0.5) * tileSize,
      y: (tileY + height * 0.5) * tileSize,
      hp: stats.hp || 100,
      maxHp: stats.hp || 100,
      size: stats.size || Math.max(width, height) * tileSize,
      displayName: stats.name || buildingType,
      model: stats.model || buildingType,
      definitionType: buildingType,
      selected: false,
      isDead: false
    }
  };
}

function renderBuildPlacementPreview(ctx) {
  const preview = getBuildPlacementPreview();
  if (!preview) return;

  const building = preview.building;
  const x = building.tileX * tileSize;
  const y = building.tileY * tileSize;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const zoom = Math.max(0.25, camera.zoom || 1);
  const accent = preview.valid ? 'rgba(74, 255, 130, 0.88)' : 'rgba(255, 84, 84, 0.92)';
  const fill = preview.valid ? 'rgba(66, 220, 112, 0.16)' : 'rgba(255, 84, 84, 0.18)';

  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([8, 5]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  ctx.globalAlpha = preview.valid ? 0.46 : 0.28;
  drawBuilding(building, 'full');
  ctx.globalAlpha = 1;

  ctx.font = `${Math.max(11, 12 / Math.max(0.5, camera.zoom || 1))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = preview.valid ? 'rgba(233, 255, 223, 0.94)' : 'rgba(255, 224, 224, 0.94)';
  ctx.strokeStyle = 'rgba(20, 18, 12, 0.78)';
  ctx.lineWidth = 3 / zoom;
  const label = preview.valid ? building.displayName : 'Blocked';
  ctx.strokeText(label, building.x, y - 6);
  ctx.fillText(label, building.x, y - 6);
  ctx.restore();
}

function drawCastleStoneBlock(x, y, w, h, shade = 0) {
  drawStoneSurface(x, y, w, h, Math.round(x + shade * 31), Math.round(y - shade * 17), {
    light: shade > 0 ? '#c0bca9' : '#a8a696',
    mid: shade < 0 ? '#676a62' : '#898b80',
    dark: shade < 0 ? '#4f524c' : '#64675f',
    stroke: 'rgba(35, 37, 33, 0.5)'
  });
}

function drawHomeBuildingBase(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const accent = getTeamAccent(building.team);
  const wall = tileSize * 1.08;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const right = w * 0.5;
  const bottom = h * 0.5;

  ctx.save();
  ctx.translate(x, y);

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#1c1209';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.32, w * 0.54, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const courtyard = {
    x: left + wall * 1.05,
    y: top + wall * 1.05,
    w: w - wall * 2.1,
    h: h - wall * 2.05
  };

  ctx.fillStyle = '#80735a';
  ctx.fillRect(courtyard.x, courtyard.y, courtyard.w, courtyard.h);
  ctx.strokeStyle = 'rgba(46, 35, 22, 0.32)';
  ctx.lineWidth = 1;
  for (let row = 0; row < 7; row++) {
    const yy = courtyard.y + courtyard.h * (row + 0.5) / 7;
    ctx.beginPath();
    ctx.moveTo(courtyard.x + tileSize * 0.25, yy);
    ctx.lineTo(courtyard.x + courtyard.w - tileSize * 0.25, yy + (row % 2 ? 2 : -1));
    ctx.stroke();
  }
  for (let col = 0; col < 8; col++) {
    const xx = courtyard.x + courtyard.w * (col + 0.5) / 8;
    ctx.beginPath();
    ctx.moveTo(xx, courtyard.y + tileSize * 0.2);
    ctx.lineTo(xx + (col % 2 ? 1 : -2), courtyard.y + courtyard.h - tileSize * 0.2);
    ctx.stroke();
  }

  ctx.fillStyle = '#9a8a62';
  ctx.beginPath();
  ctx.moveTo(-tileSize * 0.55, bottom - wall * 0.18);
  ctx.lineTo(tileSize * 0.55, bottom - wall * 0.18);
  ctx.lineTo(tileSize * 0.18, top + wall * 1.35);
  ctx.lineTo(-tileSize * 0.18, top + wall * 1.35);
  ctx.closePath();
  ctx.fill();

  drawStoneSurface(left + wall * 0.08, top + wall * 0.08, w - wall * 0.16, wall * 0.94, building.tileX, building.tileY - 2);
  drawStoneSurface(left + wall * 0.08, top + wall * 0.08, wall * 0.94, h - wall * 0.28, building.tileX - 3, building.tileY);
  drawStoneSurface(right - wall * 1.02, top + wall * 0.08, wall * 0.94, h - wall * 0.28, building.tileX + 5, building.tileY);

  const towerSize = wall * 1.12;
  const towers = [
    [left + wall * 0.42, top + wall * 0.42],
    [right - wall * 1.47, top + wall * 0.42],
    [left + wall * 0.42, bottom - wall * 1.45],
    [right - wall * 1.47, bottom - wall * 1.45]
  ];
  for (const [tx, ty] of towers) {
    drawCastleStoneBlock(tx, ty, towerSize, towerSize, 1);
    ctx.fillStyle = '#6d7067';
    ctx.fillRect(tx + towerSize * 0.18, ty - towerSize * 0.13, towerSize * 0.18, towerSize * 0.2);
    ctx.fillRect(tx + towerSize * 0.62, ty - towerSize * 0.13, towerSize * 0.18, towerSize * 0.2);
  }

  ctx.fillStyle = '#787b70';
  for (let i = 0; i < 9; i++) {
    const bx = left + wall * 1.05 + i * ((w - wall * 2.1) / 8);
    drawRoundedRectPath(bx - tileSize * 0.12, top - wall * 0.01, tileSize * 0.24, tileSize * 0.33, 2);
    ctx.fill();
  }
  for (let i = 1; i < 6; i++) {
    const by = top + wall * 1.1 + i * ((h - wall * 2.2) / 6);
    drawRoundedRectPath(left - wall * 0.01, by - tileSize * 0.1, tileSize * 0.33, tileSize * 0.2, 2);
    ctx.fill();
    drawRoundedRectPath(right - wall * 0.32, by - tileSize * 0.1, tileSize * 0.33, tileSize * 0.2, 2);
    ctx.fill();
  }

  const keepW = w * 0.28;
  const keepH = h * 0.2;
  const keepX = -keepW * 0.5;
  const keepY = top + wall * 1.08;
  ctx.fillStyle = '#6b6e65';
  ctx.fillRect(keepX, keepY, keepW, keepH);
  ctx.fillStyle = '#8f9187';
  ctx.fillRect(keepX + tileSize * 0.12, keepY + tileSize * 0.1, keepW - tileSize * 0.24, keepH - tileSize * 0.16);
  ctx.strokeStyle = '#353832';
  ctx.lineWidth = 2;
  ctx.strokeRect(keepX, keepY, keepW, keepH);

  ctx.strokeStyle = '#2c1809';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, top + wall * 0.35);
  ctx.lineTo(w * 0.25, top - wall * 0.18);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, top - wall * 0.18);
  ctx.lineTo(w * 0.38, top - wall * 0.06);
  ctx.lineTo(w * 0.25, top + wall * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawHomeBuildingFront(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const accent = getTeamAccent(building.team);
  const wall = tileSize * 1.08;
  const left = -w * 0.5;
  const bottom = h * 0.5;
  const right = w * 0.5;

  ctx.save();
  ctx.translate(x, y);

  drawStoneSurface(left + wall * 0.08, bottom - wall * 1.04, w - wall * 0.16, wall * 0.96, building.tileX, building.tileY + 8, {
    light: '#bbb7a4',
    mid: '#85877d',
    dark: '#575b53'
  });

  const gateW = tileSize * 3.2;
  const gateX = -gateW * 0.5;
  const gateY = bottom - wall * 1.02;
  ctx.fillStyle = '#201711';
  ctx.beginPath();
  ctx.moveTo(gateX, bottom - wall * 0.24);
  ctx.lineTo(gateX, gateY + wall * 0.38);
  ctx.quadraticCurveTo(0, gateY - wall * 0.12, -gateX, gateY + wall * 0.38);
  ctx.lineTo(-gateX, bottom - wall * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c4ae76';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#76796e';
  for (let i = 0; i < 10; i++) {
    const bx = left + wall * 0.75 + i * ((w - wall * 1.5) / 9);
    if (Math.abs(bx) < gateW * 0.48) continue;
    drawRoundedRectPath(bx - tileSize * 0.12, bottom - wall * 1.18, tileSize * 0.24, tileSize * 0.34, 2);
    ctx.fill();
  }

  const towerSize = wall * 1.12;
  const frontTowers = [
    [left + wall * 0.42, bottom - wall * 1.45],
    [right - wall * 1.47, bottom - wall * 1.45]
  ];
  for (const [tx, ty] of frontTowers) {
    drawCastleStoneBlock(tx, ty, towerSize, towerSize, 1);
    ctx.fillStyle = '#6d7067';
    ctx.fillRect(tx + towerSize * 0.18, ty - towerSize * 0.13, towerSize * 0.18, towerSize * 0.2);
    ctx.fillRect(tx + towerSize * 0.62, ty - towerSize * 0.13, towerSize * 0.18, towerSize * 0.2);
  }

  ctx.fillStyle = '#b8a06d';
  ctx.strokeStyle = 'rgba(54, 38, 22, 0.62)';
  ctx.lineWidth = 1;
  for (let step = 0; step < 9; step++) {
    const sx = -w * 0.16 + step * w * 0.037;
    const sy = bottom - wall * 0.25 - step * h * 0.045;
    ctx.fillRect(sx, sy, w * 0.18, h * 0.025);
    ctx.strokeRect(sx, sy, w * 0.18, h * 0.025);
  }

  ctx.restore();
}

function drawHomeBuilding(building, layer = 'full') {
  if (isEraKingdomsTownCenter(building)) {
    drawEraKingdomsTownCenter(building, layer);
    return;
  }

  if (isBattleForgeTownHall(building)) {
    drawBattleForgeTownHall(building, layer);
    return;
  }

  if (isModernWarlordCommandCenter(building)) {
    drawModernWarlordCommandCenter(building, layer);
    return;
  }

  if (layer === 'base') {
    drawHomeBuildingBase(building);
    return;
  }

  if (layer === 'front') {
    drawHomeBuildingFront(building);
    return;
  }

  drawHomeBuildingBase(building);
  drawHomeBuildingFront(building);
}

function isEraKingdomsTownCenter(building) {
  return !!building && (
    building.definitionType === 'eok_town_center' ||
    building.model === 'eok_town_center' ||
    (building.type === BUILDING_TYPES.HOME && (window.mapConfig?.mapStyle === 'eok_arabia' || window.mapConfig?.visualStyle === 'arabia_dryland'))
  );
}

function drawEraTileRoof(x, y, w, h, ridge = 0) {
  ctx.fillStyle = createBuildingGradient(x, y - h * 0.3, x + w, y + h * 0.75, [
    [0, '#d28a46'],
    [0.5, '#9c4f2b'],
    [1, '#5f2b21']
  ]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.5, y - h * 0.62 - ridge);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w * 0.87, y + h * 0.28);
  ctx.lineTo(x + w * 0.13, y + h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(62, 30, 20, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(248, 190, 104, 0.24)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const px = x + (w * i) / 8;
    ctx.beginPath();
    ctx.moveTo(px, y - h * 0.03);
    ctx.lineTo(x + w * 0.5, y - h * 0.55 - ridge);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const yy = y + h * (0.02 + i * 0.08);
    ctx.strokeStyle = i % 2 ? 'rgba(67, 31, 19, 0.3)' : 'rgba(255, 212, 137, 0.22)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.13, yy);
    ctx.quadraticCurveTo(x + w * 0.5, yy + h * 0.05, x + w * 0.87, yy);
    ctx.stroke();
  }
}

function drawEraBanners(accent, x, y, scale = 1) {
  ctx.strokeStyle = '#3e2717';
  ctx.lineWidth = Math.max(1.2, tileSize * 0.045 * scale);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - tileSize * 0.78 * scale);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x, y - tileSize * 0.78 * scale);
  ctx.lineTo(x + tileSize * 0.34 * scale, y - tileSize * 0.66 * scale);
  ctx.lineTo(x, y - tileSize * 0.52 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(38, 20, 11, 0.55)';
  ctx.stroke();
}

function drawEraKingdomsTownCenterBase(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const accent = getTeamAccent(building.team);

  ctx.save();
  ctx.translate(x, y);
  drawBuildingShadow(w, h, 0.24);

  ctx.fillStyle = createBuildingGradient(left + w * 0.12, top + h * 0.35, left + w * 0.88, top + h * 0.82, [
    [0, '#d2c59c'],
    [0.55, '#aa9265'],
    [1, '#6f5d43']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.18, top + h * 0.55);
  ctx.lineTo(0, top + h * 0.38);
  ctx.lineTo(left + w * 0.82, top + h * 0.55);
  ctx.lineTo(left + w * 0.78, top + h * 0.82);
  ctx.lineTo(left + w * 0.22, top + h * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 55, 35, 0.46)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawStoneSurface(left + w * 0.2, top + h * 0.48, w * 0.6, h * 0.24, building.tileX + 20, building.tileY + 7, {
    light: '#c9c2a6',
    mid: '#9f967a',
    dark: '#6e6754',
    stroke: 'rgba(58, 49, 36, 0.5)'
  });

  ctx.fillStyle = 'rgba(80, 61, 36, 0.18)';
  for (let i = 0; i < 8; i++) {
    const px = left + w * (0.25 + i * 0.07);
    ctx.beginPath();
    ctx.ellipse(px, top + h * 0.77 + (i % 2) * 2, tileSize * 0.16, tileSize * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEraTileRoof(left + w * 0.17, top + h * 0.47, w * 0.66, h * 0.25, tileSize * 0.16);

  const towerW = w * 0.17;
  const towerH = h * 0.32;
  const towerY = top + h * 0.25;
  for (const tx of [left + w * 0.13, left + w * 0.7]) {
    drawStoneSurface(tx, towerY, towerW, towerH, building.tileX + Math.round(tx), building.tileY, {
      light: '#bfb79b',
      mid: '#918a72',
      dark: '#635d4d',
      stroke: 'rgba(48, 43, 34, 0.55)'
    });
    ctx.fillStyle = '#34251a';
    for (let i = 0; i < 2; i++) {
      drawRoundedRectPath(tx + towerW * (0.28 + i * 0.28), towerY + towerH * 0.28, towerW * 0.12, towerH * 0.26, 2);
      ctx.fill();
    }
    drawEraTileRoof(tx - towerW * 0.12, towerY + towerH * 0.04, towerW * 1.24, towerH * 0.32, tileSize * 0.1);
  }

  drawEraBanners(accent, left + w * 0.64, top + h * 0.26, 0.9);
  ctx.restore();
}

function drawEraKingdomsTownCenterFront(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const accent = getTeamAccent(building.team);

  ctx.save();
  ctx.translate(x, y);

  drawWoodPlanks(left + w * 0.28, top + h * 0.56, w * 0.44, h * 0.22, building.tileX + 4, building.tileY + 11);
  ctx.fillStyle = 'rgba(60, 32, 17, 0.42)';
  ctx.fillRect(left + w * 0.31, top + h * 0.61, w * 0.38, h * 0.035);
  ctx.fillRect(left + w * 0.31, top + h * 0.69, w * 0.38, h * 0.035);

  ctx.fillStyle = '#261710';
  const doorW = w * 0.13;
  const doorH = h * 0.18;
  ctx.beginPath();
  ctx.moveTo(-doorW * 0.5, top + h * 0.79);
  ctx.lineTo(-doorW * 0.5, top + h * 0.67);
  ctx.quadraticCurveTo(0, top + h * 0.61, doorW * 0.5, top + h * 0.67);
  ctx.lineTo(doorW * 0.5, top + h * 0.79);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c9a86d';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#241812';
  for (const wx of [left + w * 0.38, left + w * 0.59]) {
    drawRoundedRectPath(wx, top + h * 0.61, w * 0.055, h * 0.075, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236, 183, 91, 0.48)';
    ctx.stroke();
  }

  const porchY = top + h * 0.79;
  ctx.fillStyle = createBuildingGradient(left + w * 0.27, porchY, left + w * 0.73, porchY + h * 0.07, [
    [0, '#90794f'],
    [1, '#59452b']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.26, porchY);
  ctx.lineTo(left + w * 0.74, porchY);
  ctx.lineTo(left + w * 0.67, porchY + h * 0.07);
  ctx.lineTo(left + w * 0.33, porchY + h * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(59, 40, 23, 0.55)';
  ctx.stroke();

  ctx.strokeStyle = '#3b2717';
  ctx.lineWidth = 3;
  for (const px of [left + w * 0.3, left + w * 0.7]) {
    ctx.beginPath();
    ctx.moveTo(px, top + h * 0.58);
    ctx.lineTo(px, top + h * 0.82);
    ctx.stroke();
  }

  drawEraTileRoof(left + w * 0.25, top + h * 0.57, w * 0.5, h * 0.2, tileSize * 0.08);
  drawEraBanners(accent, left + w * 0.51, top + h * 0.47, 1.05);

  ctx.restore();
}

function drawEraKingdomsTownCenter(building, layer = 'full') {
  if (layer === 'base') {
    drawEraKingdomsTownCenterBase(building);
    return;
  }
  if (layer === 'front') {
    drawEraKingdomsTownCenterFront(building);
    return;
  }
  drawEraKingdomsTownCenterBase(building);
  drawEraKingdomsTownCenterFront(building);
}

function isBattleForgeTownHall(building) {
  return !!building && (
    building.definitionType === 'bf_town_hall' ||
    (building.type === BUILDING_TYPES.HOME && (window.mapConfig?.mapStyle === 'enchanted_forest' || window.mapConfig?.visualStyle === 'fantasy_forest'))
  );
}

function drawFantasyRoof(x, y, w, h, hue = 'green') {
  const palette = hue === 'purple'
    ? ['#78619b', '#4b3a6a', '#2c223f']
    : ['#496f4a', '#2e5537', '#1b3425'];
  ctx.fillStyle = createBuildingGradient(x, y - h * 0.45, x + w, y + h * 0.4, [
    [0, palette[0]],
    [0.52, palette[1]],
    [1, palette[2]]
  ]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.25, y - h * 0.18, x + w * 0.5, y - h * 0.72);
  ctx.quadraticCurveTo(x + w * 0.72, y - h * 0.16, x + w, y);
  ctx.lineTo(x + w * 0.88, y + h * 0.26);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.38, x + w * 0.12, y + h * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(18, 25, 15, 0.72)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(190, 226, 154, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const px = x + (w * i) / 8;
    ctx.beginPath();
    ctx.moveTo(px, y + h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.38, x + w * 0.5, y - h * 0.66);
    ctx.stroke();
  }
}

function drawBattleForgeBanners(accent, x, y, scale = 1) {
  ctx.strokeStyle = '#271a12';
  ctx.lineWidth = Math.max(1.4, tileSize * 0.05 * scale);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - tileSize * 0.9 * scale);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x, y - tileSize * 0.88 * scale);
  ctx.lineTo(x + tileSize * 0.4 * scale, y - tileSize * 0.76 * scale);
  ctx.lineTo(x + tileSize * 0.24 * scale, y - tileSize * 0.62 * scale);
  ctx.lineTo(x + tileSize * 0.38 * scale, y - tileSize * 0.48 * scale);
  ctx.lineTo(x, y - tileSize * 0.56 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(29, 18, 11, 0.58)';
  ctx.stroke();
}

function drawBattleForgeTownHallBase(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const accent = getTeamAccent(building.team);
  const isDark = /grave|horde|red|black/i.test(String(building.factionId || building.team || ''));

  ctx.save();
  ctx.translate(x, y);
  drawBuildingShadow(w, h, 0.28);

  ctx.fillStyle = 'rgba(75, 118, 68, 0.12)';
  ctx.beginPath();
  ctx.ellipse(0, top + h * 0.72, w * 0.42, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  drawStoneSurface(left + w * 0.2, top + h * 0.5, w * 0.6, h * 0.23, building.tileX + 50, building.tileY + 19, {
    light: '#b5b096',
    mid: '#827b66',
    dark: '#514a3c',
    stroke: 'rgba(38, 33, 25, 0.56)'
  });

  drawWoodPlanks(left + w * 0.26, top + h * 0.34, w * 0.48, h * 0.27, building.tileX + 22, building.tileY + 5);
  ctx.fillStyle = 'rgba(44, 27, 15, 0.35)';
  ctx.fillRect(left + w * 0.29, top + h * 0.43, w * 0.42, h * 0.035);
  ctx.fillRect(left + w * 0.29, top + h * 0.53, w * 0.42, h * 0.035);

  drawFantasyRoof(left + w * 0.22, top + h * 0.34, w * 0.56, h * 0.27, isDark ? 'purple' : 'green');

  const towerW = w * 0.16;
  const towerH = h * 0.35;
  for (const [tx, scale] of [[left + w * 0.12, 0.95], [left + w * 0.72, 1.05]]) {
    drawStoneSurface(tx, top + h * 0.32, towerW, towerH, building.tileX + Math.round(tx), building.tileY + 31, {
      light: '#aaa58d',
      mid: '#746f5d',
      dark: '#474237',
      stroke: 'rgba(33, 29, 23, 0.58)'
    });
    ctx.fillStyle = '#1f1711';
    drawRoundedRectPath(tx + towerW * 0.42, top + h * 0.44, towerW * 0.16, towerH * 0.28, 2);
    ctx.fill();
    drawFantasyRoof(tx - towerW * 0.18, top + h * 0.32, towerW * 1.36, towerH * 0.34 * scale, isDark ? 'purple' : 'green');
  }

  ctx.fillStyle = isDark ? 'rgba(151, 98, 220, 0.28)' : 'rgba(117, 205, 128, 0.26)';
  ctx.beginPath();
  ctx.arc(left + w * 0.5, top + h * 0.31, tileSize * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(203, 162, 255, 0.7)' : 'rgba(180, 255, 174, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  drawBattleForgeBanners(accent, left + w * 0.62, top + h * 0.31, 0.9);
  ctx.restore();
}

function drawBattleForgeTownHallFront(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const accent = getTeamAccent(building.team);
  const isDark = /grave|horde|red|black/i.test(String(building.factionId || building.team || ''));

  ctx.save();
  ctx.translate(x, y);

  drawStoneSurface(left + w * 0.31, top + h * 0.58, w * 0.38, h * 0.18, building.tileX + 77, building.tileY + 13, {
    light: '#b6ad92',
    mid: '#81755f',
    dark: '#514534',
    stroke: 'rgba(45, 33, 22, 0.58)'
  });

  ctx.fillStyle = '#23150f';
  const doorW = w * 0.14;
  ctx.beginPath();
  ctx.moveTo(-doorW * 0.5, top + h * 0.77);
  ctx.lineTo(-doorW * 0.5, top + h * 0.65);
  ctx.quadraticCurveTo(0, top + h * 0.56, doorW * 0.5, top + h * 0.65);
  ctx.lineTo(doorW * 0.5, top + h * 0.77);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = isDark ? '#9b77ca' : '#9ec77c';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = '#1e1510';
  for (const wx of [left + w * 0.38, left + w * 0.58]) {
    drawRoundedRectPath(wx, top + h * 0.62, w * 0.055, h * 0.07, 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(190, 142, 255, 0.5)' : 'rgba(187, 236, 148, 0.48)';
    ctx.stroke();
  }

  ctx.strokeStyle = '#382413';
  ctx.lineWidth = 3;
  for (const px of [left + w * 0.3, left + w * 0.7]) {
    ctx.beginPath();
    ctx.moveTo(px, top + h * 0.48);
    ctx.lineTo(px, top + h * 0.78);
    ctx.stroke();
  }

  drawFantasyRoof(left + w * 0.27, top + h * 0.56, w * 0.46, h * 0.18, isDark ? 'purple' : 'green');

  ctx.fillStyle = createBuildingGradient(left + w * 0.28, top + h * 0.77, left + w * 0.72, top + h * 0.84, [
    [0, '#7b613c'],
    [1, '#3f2b1a']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.27, top + h * 0.77);
  ctx.lineTo(left + w * 0.73, top + h * 0.77);
  ctx.lineTo(left + w * 0.65, top + h * 0.84);
  ctx.lineTo(left + w * 0.35, top + h * 0.84);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(38, 24, 14, 0.62)';
  ctx.stroke();

  drawBattleForgeBanners(accent, left + w * 0.48, top + h * 0.42, 1);

  ctx.restore();
}

function drawBattleForgeTownHall(building, layer = 'full') {
  if (layer === 'base') {
    drawBattleForgeTownHallBase(building);
    return;
  }
  if (layer === 'front') {
    drawBattleForgeTownHallFront(building);
    return;
  }
  drawBattleForgeTownHallBase(building);
  drawBattleForgeTownHallFront(building);
}

function isModernWarlordCommandCenter(building) {
  return !!building && (
    building.definitionType === 'mw_command_center' ||
    building.model === 'modern_command_center' ||
    (building.type === BUILDING_TYPES.HOME && (window.mapConfig?.mapStyle === 'dry_oil_basin' || window.mapConfig?.visualStyle === 'industrial_desert'))
  );
}

function drawHescoWall(x, y, w, h, seedX, seedY) {
  ctx.fillStyle = createBuildingGradient(x, y, x + w, y + h, [
    [0, '#c9b37e'],
    [0.54, '#9e875b'],
    [1, '#6b5739']
  ]);
  drawRoundedRectPath(x, y, w, h, Math.min(4, h * 0.24));
  ctx.fill();
  ctx.strokeStyle = 'rgba(57, 44, 26, 0.52)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const cells = Math.max(2, Math.floor(w / Math.max(10, tileSize * 0.38)));
  ctx.strokeStyle = 'rgba(67, 51, 28, 0.42)';
  ctx.lineWidth = 1;
  for (let i = 1; i < cells; i++) {
    const px = x + (w * i) / cells + (hashNoise(seedX + i, seedY) - 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(px, y + h * 0.08);
    ctx.lineTo(px, y + h * 0.92);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(235, 214, 160, 0.2)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.04, y + h * 0.28);
  ctx.lineTo(x + w * 0.96, y + h * 0.22);
  ctx.stroke();
}

function drawSandbagStack(x, y, bags, scale = 1) {
  for (let i = 0; i < bags; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const bx = x + col * tileSize * 0.2 * scale + (row % 2) * tileSize * 0.09 * scale;
    const by = y - row * tileSize * 0.09 * scale;
    ctx.fillStyle = i % 2 ? '#b49a68' : '#c4ad78';
    ctx.beginPath();
    ctx.ellipse(bx, by, tileSize * 0.13 * scale, tileSize * 0.07 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 53, 30, 0.36)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawModernBarracksBlock(x, y, w, h, seedX, seedY) {
  ctx.fillStyle = createBuildingGradient(x, y, x + w * 0.35, y + h, [
    [0, '#d6c294'],
    [0.48, '#aa9366'],
    [1, '#746044']
  ]);
  drawRoundedRectPath(x, y, w, h, tileSize * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(62, 48, 32, 0.58)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#8a7b60';
  drawRoundedRectPath(x + w * 0.04, y - h * 0.08, w * 0.92, h * 0.12, tileSize * 0.05);
  ctx.fill();
  ctx.strokeStyle = 'rgba(48, 41, 30, 0.45)';
  ctx.stroke();

  ctx.fillStyle = '#2f342f';
  const windows = Math.max(2, Math.floor(w / (tileSize * 0.75)));
  for (let i = 0; i < windows; i++) {
    const wx = x + w * (0.16 + i * (0.68 / Math.max(1, windows - 1))) - tileSize * 0.09;
    drawRoundedRectPath(wx, y + h * 0.28 + (hashNoise(seedX + i, seedY) - 0.5) * 2, tileSize * 0.18, tileSize * 0.18, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(206, 218, 190, 0.22)';
    ctx.stroke();
  }

  ctx.fillStyle = '#4b3b28';
  drawRoundedRectPath(x + w * 0.44, y + h * 0.54, w * 0.12, h * 0.38, tileSize * 0.035);
  ctx.fill();
}

function drawModernWarlordCommandCenterBase(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;
  const accent = getTeamAccent(building.team);

  ctx.save();
  ctx.translate(x, y);
  drawBuildingShadow(w, h, 0.22);

  ctx.fillStyle = createBuildingGradient(left + w * 0.12, top + h * 0.34, left + w * 0.88, top + h * 0.88, [
    [0, '#b89e69'],
    [0.52, '#91774d'],
    [1, '#594631']
  ]);
  ctx.beginPath();
  ctx.moveTo(left + w * 0.16, top + h * 0.45);
  ctx.lineTo(left + w * 0.84, top + h * 0.38);
  ctx.lineTo(left + w * 0.9, top + h * 0.74);
  ctx.lineTo(left + w * 0.76, top + h * 0.88);
  ctx.lineTo(left + w * 0.24, top + h * 0.86);
  ctx.lineTo(left + w * 0.1, top + h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(54, 39, 24, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawHescoWall(left + w * 0.1, top + h * 0.38, w * 0.8, h * 0.085, building.tileX, building.tileY);
  drawHescoWall(left + w * 0.1, top + h * 0.73, w * 0.28, h * 0.085, building.tileX + 3, building.tileY + 2);
  drawHescoWall(left + w * 0.62, top + h * 0.73, w * 0.28, h * 0.085, building.tileX + 9, building.tileY + 2);
  drawHescoWall(left + w * 0.1, top + h * 0.45, w * 0.085, h * 0.28, building.tileX + 1, building.tileY + 6);
  drawHescoWall(left + w * 0.815, top + h * 0.45, w * 0.085, h * 0.28, building.tileX + 11, building.tileY + 6);

  drawModernBarracksBlock(left + w * 0.24, top + h * 0.46, w * 0.34, h * 0.22, building.tileX + 4, building.tileY + 4);
  drawModernBarracksBlock(left + w * 0.54, top + h * 0.5, w * 0.22, h * 0.18, building.tileX + 8, building.tileY + 5);

  const towerX = left + w * 0.67;
  const towerY = top + h * 0.26;
  ctx.fillStyle = '#7a6a4b';
  drawRoundedRectPath(towerX, towerY, w * 0.11, h * 0.21, tileSize * 0.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42, 31, 20, 0.52)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#4d4735';
  drawRoundedRectPath(towerX - w * 0.02, towerY - h * 0.04, w * 0.15, h * 0.06, tileSize * 0.03);
  ctx.fill();
  ctx.fillStyle = '#242a26';
  ctx.fillRect(towerX + w * 0.04, towerY + h * 0.06, w * 0.035, h * 0.07);

  ctx.strokeStyle = '#2b241b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.48, top + h * 0.45);
  ctx.lineTo(left + w * 0.48, top + h * 0.22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(38, 31, 22, 0.72)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(left + w * 0.48, top + h * 0.26, tileSize * 0.18, -0.8, 0.8);
  ctx.stroke();

  ctx.strokeStyle = '#2c2116';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.6, top + h * 0.43);
  ctx.lineTo(left + w * 0.6, top + h * 0.25);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.6, top + h * 0.25);
  ctx.lineTo(left + w * 0.73, top + h * 0.3);
  ctx.lineTo(left + w * 0.6, top + h * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawModernWarlordCommandCenterFront(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const left = -w * 0.5;
  const top = -h * 0.5;

  ctx.save();
  ctx.translate(x, y);

  const gateY = top + h * 0.72;
  ctx.fillStyle = '#2d2b24';
  drawRoundedRectPath(left + w * 0.39, gateY, w * 0.22, h * 0.12, tileSize * 0.035);
  ctx.fill();
  ctx.strokeStyle = '#b8a16d';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(193, 172, 119, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const px = left + w * 0.39 + (w * 0.22 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(px, gateY + h * 0.02);
    ctx.lineTo(px, gateY + h * 0.1);
    ctx.stroke();
  }

  ctx.fillStyle = '#756140';
  ctx.beginPath();
  ctx.moveTo(left + w * 0.34, top + h * 0.84);
  ctx.lineTo(left + w * 0.66, top + h * 0.84);
  ctx.lineTo(left + w * 0.58, top + h * 0.9);
  ctx.lineTo(left + w * 0.42, top + h * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(54, 39, 24, 0.45)';
  ctx.stroke();

  drawSandbagStack(left + w * 0.22, top + h * 0.8, 8, 1.05);
  drawSandbagStack(left + w * 0.68, top + h * 0.8, 8, 1.05);

  ctx.fillStyle = '#343632';
  ctx.fillRect(left + w * 0.27, top + h * 0.61, w * 0.11, h * 0.035);
  ctx.fillRect(left + w * 0.62, top + h * 0.61, w * 0.08, h * 0.035);

  ctx.restore();
}

function drawModernWarlordCommandCenter(building, layer = 'full') {
  if (layer === 'base') {
    drawModernWarlordCommandCenterBase(building);
    return;
  }
  if (layer === 'front') {
    drawModernWarlordCommandCenterFront(building);
    return;
  }
  drawModernWarlordCommandCenterBase(building);
  drawModernWarlordCommandCenterFront(building);
}

function drawTowerBuilding(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const accent = getTeamAccent(building.team);

  ctx.save();
  ctx.translate(x, y);

  drawBuildingShadow(w, h, 0.24);

  ctx.fillStyle = createBuildingGradient(-w * 0.33, -h * 0.62, w * 0.28, h * 0.42, [
    [0, '#b9b5a4'],
    [0.5, '#85877d'],
    [1, '#575b53']
  ]);
  ctx.beginPath();
  ctx.moveTo(-w * 0.26, h * 0.38);
  ctx.lineTo(-w * 0.31, -h * 0.48);
  ctx.quadraticCurveTo(0, -h * 0.6, w * 0.31, -h * 0.48);
  ctx.lineTo(w * 0.26, h * 0.38);
  ctx.quadraticCurveTo(0, h * 0.48, -w * 0.26, h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#383b35';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  for (let row = 0; row < 6; row++) {
    const yy = -h * 0.42 + row * h * 0.14;
    ctx.strokeStyle = row % 2 ? 'rgba(42, 40, 34, 0.28)' : 'rgba(241, 233, 205, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.23, yy);
    ctx.lineTo(w * 0.23, yy + (row % 2 ? 1 : -1));
    ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const n = hashNoise(building.tileX + i, building.tileY + 17);
    const sx = -w * 0.22 + n * w * 0.44;
    const sy = -h * 0.46 + hashNoise(building.tileX + i * 3, building.tileY) * h * 0.72;
    ctx.fillStyle = n > 0.55 ? 'rgba(255,255,235,0.08)' : 'rgba(25,24,20,0.08)';
    drawRoundedRectPath(sx, sy, w * 0.08, h * 0.045, 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#5f625a';
  drawRoundedRectPath(-w * 0.38, -h * 0.62, w * 0.76, h * 0.1, tileSize * 0.03);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 38, 32, 0.52)';
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    drawRoundedRectPath(i * w * 0.14 - w * 0.045, -h * 0.76, w * 0.09, h * 0.2, 2);
    ctx.fill();
  }

  ctx.fillStyle = '#211914';
  ctx.beginPath();
  ctx.moveTo(-w * 0.1, h * 0.4);
  ctx.lineTo(-w * 0.1, h * 0.14);
  ctx.quadraticCurveTo(0, h * 0.04, w * 0.1, h * 0.14);
  ctx.lineTo(w * 0.1, h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#161713';
  ctx.fillRect(-w * 0.06, -h * 0.2, w * 0.12, h * 0.32);
  ctx.fillRect(-w * 0.17, -h * 0.4, w * 0.08, h * 0.22);
  ctx.fillRect(w * 0.09, -h * 0.4, w * 0.08, h * 0.22);

  ctx.fillStyle = '#6b3a18';
  ctx.fillRect(-w * 0.38, -h * 0.02, w * 0.2, h * 0.05);
  ctx.fillRect(w * 0.18, -h * 0.02, w * 0.2, h * 0.05);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, -h * 0.76);
  ctx.lineTo(w * 0.05, -h * 1.02);
  ctx.lineTo(w * 0.36, -h * 0.92);
  ctx.lineTo(w * 0.05, -h * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c1809';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, -h * 0.53);
  ctx.lineTo(w * 0.05, -h * 1.04);
  ctx.stroke();

  ctx.restore();
}

function renderWorldObjects(units, ctx, debug = {}) {
  const drawList = OpenRTS.rendering.canvas.renderLists.createWorldObjectDrawList({
    camera,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    tileSize,
    rows: MAP_ROWS,
    columns: MAP_COLS,
    obstacleData,
    obstacleNone: OBSTACLE.NONE,
    obstacleTree: OBSTACLE.TREE,
    homeType: BUILDING_TYPES.HOME,
    sheep: sheepData,
    roasts: OpenRTS.systems.cooking.getRoasts(),
    ducks: duckData,
    horses: horseData,
    items: itemData,
    goldMines: goldMineData,
    houses: houseData,
    buildings: buildingData,
    units
  });

  for (const item of drawList) {
    if (item.type === 'obstacle') {
      drawObstacle(item.obstacleType, item.x, item.y, item.x * tileSize, item.y * tileSize);
    } else if (item.type === 'building') {
      drawBuilding(item.building, item.layer || 'full');
    } else if (item.type === 'sheep') {
      drawSheep(item.sheep);
    } else if (item.type === 'roast') {
      drawRoast(item.roast);
    } else if (item.type === 'duck') {
      drawDuck(item.duck);
    } else if (item.type === 'horse') {
      drawHorse(item.horse);
    } else if (item.type === 'world-item') {
      drawWorldItem(item.worldItem);
    } else if (item.type === 'gold-mine') {
      drawGoldMine(item.mine);
    } else if (item.type === 'house') {
      drawNeutralHouse(item.house);
    } else if (item.type === 'unit') {
      if (window.UnitComponents && window.UnitComponents.render) {
        const renderComp = window.UnitComponents.render.get(item.unit.id);
        if (renderComp) {
          renderComp.selected = item.unit.selected;
          renderComp.spriteFrame = item.unit.spriteFrame;
          renderComp.facing = item.unit.spriteDirectionRow;
        }
      }
      processUnitRender(item.unit, ctx);
      if (debug.showPaths) item.unit.renderPath(ctx);
      if (debug.showRawPaths) item.unit.renderRawPath(ctx);
      if (debug.showIllegalMoves) item.unit.renderIllegalMoves(ctx);
    }
  }
}

function getMapWidthPx() {
  return terrainData[0].length * tileSize;
}

function getMapHeightPx() {
  return terrainData.length * tileSize;
}

function canSpawnAt(x, y, unitSize = 20, options = {}) {
  return getNavigationService().canSpawnAt(x, y, unitSize, options);
}

function tileCenter(tileX, tileY) {
  return {
    x: tileX * tileSize + tileSize / 2,
    y: tileY * tileSize + tileSize / 2
  };
}

function isVisualLandPoint(worldX, worldY) {
  if (terrainRenderCanvas) {
    const px = Math.max(0, Math.min(Math.floor(worldX), terrainRenderCanvas.width - 1));
    const py = Math.max(0, Math.min(Math.floor(worldY), terrainRenderCanvas.height - 1));
    const sample = terrainRenderCtx.getImageData(px, py, 1, 1).data;
    const looksLikeWater = sample[2] > sample[1] + 10 && sample[1] > sample[0] + 20;
    return !looksLikeWater;
  }

  if (terrainVisualTypes.length > 0) {
    const cellX = Math.max(0, Math.min(Math.floor(worldX / terrainVisualCellSize), terrainVisualCols - 1));
    const cellY = Math.max(0, Math.min(Math.floor(worldY / terrainVisualCellSize), Math.ceil(getMapHeightPx() / terrainVisualCellSize) - 1));
    return terrainVisualTypes[cellY * terrainVisualCols + cellX] !== TERRAIN.WATER;
  }

  return generateVisualTerrainType(worldX, worldY) !== TERRAIN.WATER;
}

function isCommandWalkablePoint(worldX, worldY, unitSize = 20, options = {}) {
  return getNavigationService().isCommandWalkablePoint(worldX, worldY, unitSize, options);
}

function findNearestWalkablePoint(worldX, worldY, unitSize = 20, maxRadius = 16, options = {}) {
  return getNavigationService().findNearestWalkablePoint(worldX, worldY, unitSize, maxRadius, options);
}

function randomSpotOnMap() {
  for (let attempt = 0; attempt < 400; attempt++) {
    const tileX = Math.floor(worldRandom() * terrainData[0].length);
    const tileY = Math.floor(worldRandom() * terrainData.length);

    if (isWalkableTile(tileX, tileY)) {
      return {
        x: tileX * tileSize + tileSize / 2,
        y: tileY * tileSize + tileSize / 2
      };
    }
  }

  return { x: tileSize / 2, y: tileSize / 2 };
}

function hasLineOfSight(startTile, endTile, options = {}) {
  return getNavigationService().hasLineOfSight(startTile, endTile, options);
}

function smoothPath(path, options = {}) {
  return getNavigationService().smoothPath(path, options);
}

window.getBuildPlacementPreview = getBuildPlacementPreview;
window.renderBuildPlacementPreview = renderBuildPlacementPreview;
