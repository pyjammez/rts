const tileSize = 32;
const MAP_ROWS = 34;
const MAP_COLS = 60;
const MAP_SEED = Math.floor(Math.random() * 4294967295);

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
  WELL: 7
};

// Legacy alias kept for compatibility with older references.
const TILE = {
  WATER: TERRAIN.WATER,
  SAND: TERRAIN.SAND,
  GRASS: TERRAIN.GRASS,
  DIRT: TERRAIN.DIRT,
  TREE: OBSTACLE.TREE,
  ROCK: OBSTACLE.ROCK,
  SHRUB: OBSTACLE.SHRUB
};

const tileSprites = {
  grass: new Image(),
  dirt: new Image(),
  sand: new Image(),
  stone: new Image(),
  transitions: {
    'grass-dirt': new Image(),
    'grass-sand': new Image(),
    'dirt-grass': new Image(),
    'dirt-sand': new Image(),
    'sand-grass': new Image(),
    'sand-dirt': new Image(),
    'stone-grass': new Image(),
    'stone-dirt': new Image(),
    'stone-sand': new Image()
  },
  cobblestone: new Image(),
  wall: new Image(),
  wallDark: new Image(),
  unit: new Image()
};

tileSprites.grass.src = 'assets/grass.png';
tileSprites.sand.src = 'assets/sand.png';
tileSprites.dirt.src = 'assets/dirt.png';
tileSprites.stone.src = 'assets/stone.png';
tileSprites.transitions['grass-dirt'].src = 'assets/grass-dirt.png';
tileSprites.transitions['grass-sand'].src = 'assets/grass-sand.png';
tileSprites.transitions['dirt-grass'].src = 'assets/dirt-grass.png';
tileSprites.transitions['dirt-sand'].src = 'assets/dirt-sand.png';
tileSprites.transitions['sand-grass'].src = 'assets/sand-grass.png';
tileSprites.transitions['sand-dirt'].src = 'assets/sand-dirt.png';
tileSprites.transitions['stone-grass'].src = 'assets/stone-grass.png';
tileSprites.transitions['stone-dirt'].src = 'assets/stone-dirt.png';
tileSprites.transitions['stone-sand'].src = 'assets/stone-sand.png';
tileSprites.cobblestone.src = 'assets/cobblestone.png';
tileSprites.wall.src = 'assets/wall.png';
tileSprites.wallDark.src = 'assets/wall_dark.png';
tileSprites.unit.src = 'assets/unit_sprites.svg';

function hashNoise(x, y, seed = MAP_SEED) {
  let h = (x * 374761393 + y * 668265263 + seed * 1597334677) >>> 0;
  h ^= h >>> 13;
  h = (h * 1274126177) >>> 0;
  h ^= h >>> 16;
  return h / 4294967295;
}

function smoothValueNoise(x, y, scale) {
  const nx = x / scale;
  const ny = y / scale;
  const x0 = Math.floor(nx);
  const y0 = Math.floor(ny);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = nx - x0;
  const fy = ny - y0;

  const n00 = hashNoise(x0, y0);
  const n10 = hashNoise(x1, y0);
  const n01 = hashNoise(x0, y1);
  const n11 = hashNoise(x1, y1);

  const ix0 = n00 + (n10 - n00) * fx;
  const ix1 = n01 + (n11 - n01) * fx;
  return ix0 + (ix1 - ix0) * fy;
}

function fbmNoise(x, y) {
  const n1 = smoothValueNoise(x, y, 7);
  const n2 = smoothValueNoise(x + 31, y + 17, 13);
  const n3 = smoothValueNoise(x + 59, y + 41, 23);
  return n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
}

function terrainName(terrainType) {
  if (terrainType === TERRAIN.GRASS) return 'grass';
  if (terrainType === TERRAIN.SAND) return 'sand';
  if (terrainType === TERRAIN.DIRT) return 'dirt';
  return 'water';
}

function generateTerrainTile(x, y) {
  const height = fbmNoise(x + 0.5, y + 0.5);
  const thresholds = mapConfig.terrain;

  if (height < thresholds.water) return TERRAIN.WATER;
  if (height < thresholds.sand) return TERRAIN.SAND;
  if (height < thresholds.grass) return TERRAIN.GRASS;
  return TERRAIN.DIRT;
}

function generateVisualTerrainType(worldX, worldY) {
  const height = fbmNoise(worldX / tileSize, worldY / tileSize);
  const thresholds = mapConfig.terrain;

  if (height < thresholds.water) return TERRAIN.WATER;
  if (height < thresholds.sand) return TERRAIN.SAND;
  if (height < thresholds.grass) return TERRAIN.GRASS;
  return TERRAIN.DIRT;
}

// Shuffles an array in place using Math.random
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Placeholder arrays - will be regenerated when game starts
let terrainData = [];
let obstacleData = [];
let decorationData = [];
let sheepData = [];
let duckData = [];
let horseData = [];
let obstacleEntityData = [];
let obstacleEntityGrid = [];
let obstacleRevision = 0;
let selectedWorldObject = null;
var buildingData = [];
var nextBuildingId = 1;
let terrainRenderCanvas = null;
let terrainRenderCtx = null;
let terrainVisualCellSize = 2;
let terrainVisualCols = 0;
let terrainVisualTypes = [];

function computeTerrainThresholds() {
  // Collect all noise values and sort them to get accurate percentile-based thresholds
  const values = [];
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      values.push(fbmNoise(x, y));
    }
  }
  values.sort((a, b) => a - b);
  const n = values.length;

  const waterPct = mapConfig.waterLevel / 100;
  // Sand is a fixed 7% band above water, unless there's no water at all
  const sandPct = waterPct > 0 ? Math.min(waterPct + 0.07, 1) : 0;
  // All remaining land is grass — no dirt tier

  // Percentile lookup: find noise value at the Nth percentile
  const pct = (p) => p <= 0 ? -Infinity : p >= 1 ? Infinity : values[Math.min(Math.floor(p * n), n - 1)];

  mapConfig.terrain = {
    water: pct(waterPct),
    sand:  pct(sandPct),
    grass: Infinity  // everything above sand threshold is grass
  };
}

function regenerateMapData() {
  clearWorldObjectSelection();
  // Step 1: Compute accurate percentile-based terrain thresholds
  computeTerrainThresholds();

  // Step 2: Generate terrain
  terrainData = Array.from({ length: MAP_ROWS }, (_, y) =>
    Array.from({ length: MAP_COLS }, (_, x) => generateTerrainTile(x, y))
  );

  // Step 2: Initialize empty obstacle grid
  obstacleData = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => OBSTACLE.NONE)
  );

  decorationData = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => DECOR.NONE)
  );

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

  seedDecorations();
  seedSheep();
  seedDucks();
  horseData = [];
  window.horseData = horseData;
  rebuildObstacleEntities();
  buildingData = [];
  nextBuildingId = 1;
  buildTerrainRenderCache();
}

function terrainBaseColor(terrainType, shade) {
  if (terrainType === TERRAIN.WATER) {
    const blue = Math.round(103 + shade * 22);
    return `rgb(${Math.round(47 + shade * 12)}, ${Math.round(112 + shade * 22)}, ${blue + 35})`;
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
    cacheCtx.fillStyle = 'rgba(208, 189, 98, 0.1)';
    cacheCtx.fillRect(x, y, size, size);
  }

  if (terrainType === TERRAIN.WATER && fine > 0.18) {
    cacheCtx.fillStyle = 'rgba(166, 212, 229, 0.11)';
    cacheCtx.fillRect(x, y, size, Math.max(1, size * 0.5));
  }

  if (terrainType === TERRAIN.SAND && fine > 0.1) {
    cacheCtx.fillStyle = fine > 0.28
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
  sheepData = [];
  const targetCount = Math.max(0, Math.min(mapConfig.sheepCount || 0, 200));

  for (let attempt = 0; attempt < targetCount * 120 && sheepData.length < targetCount; attempt++) {
    const x = Math.floor(Math.random() * MAP_COLS);
    const y = Math.floor(Math.random() * MAP_ROWS);
    if (!isInsideMap(x, y)) continue;
    if (terrainData[y][x] !== TERRAIN.GRASS) continue;
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
    if (terrainData[Math.floor(spot.y / tileSize)][Math.floor(spot.x / tileSize)] !== TERRAIN.GRASS) continue;
    sheepData.push(createSheep(
      spot.x + (Math.random() - 0.5) * tileSize * 0.5,
      spot.y + (Math.random() - 0.5) * tileSize * 0.5,
      Math.random() > 0.5 ? 1 : -1,
      Math.random() * Math.PI * 2
    ));
  }

  window.sheepData = sheepData;
}

function seedDucks() {
  duckData = [];
  const targetCount = Math.max(0, Math.min(mapConfig.duckCount || 0, 200));

  for (let attempt = 0; attempt < targetCount * 160 && duckData.length < targetCount; attempt++) {
    const x = Math.floor(Math.random() * MAP_COLS);
    const y = Math.floor(Math.random() * MAP_ROWS);
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
      spot.x + (Math.random() - 0.5) * tileSize * 0.45,
      spot.y + (Math.random() - 0.5) * tileSize * 0.45,
      Math.random() > 0.5 ? 1 : -1,
      Math.random() * Math.PI * 2
    ));
  }

  window.duckData = duckData;
}

function createSheep(x, y, facing, phase) {
  const wanderAngle = hashNoise(Math.floor(x) + 991, Math.floor(y) + 557) * Math.PI * 2;
  return {
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

function createHorse(x, y, facing = 1, phase = Math.random() * Math.PI * 2) {
  const wanderAngle = hashNoise(Math.floor(x) + 1709, Math.floor(y) + 2053) * Math.PI * 2;
  return {
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
  if (!Array.isArray(horseData)) horseData = [];
  const spawn = findNearestWalkablePoint(x, y, 28) || { x, y };
  const horse = createHorse(spawn.x, spawn.y, facing, Math.random() * Math.PI * 2);
  horseData.push(horse);
  window.horseData = horseData;
  return horse;
}

function setAnimalHeadingFromMovement(animal, dx, dy) {
  if (!animal || Math.hypot(dx, dy) < 0.001) return;
  animal.heading = Math.atan2(dy, dx);
  animal.facing = dx >= 0 ? 1 : -1;
}

function updateSheep(dt) {
  if (!Array.isArray(sheepData) || sheepData.length === 0) return;

  for (const sheep of sheepData) {
    if (sheep.isDead || sheep.isMounted || sheep.reservedByUnitId) continue;

    sheep.wanderTimer -= dt;
    sheep.grazeTimer -= dt;

    if (sheep.wanderTimer <= 0) {
      const turn = (Math.random() - 0.5) * Math.PI * 0.95;
      sheep.wanderAngle = (sheep.wanderAngle || 0) + turn;
      sheep.wanderTimer = 0.9 + Math.random() * 2.4;
      sheep.grazeTimer = Math.random() < 0.38 ? 0.8 + Math.random() * 1.8 : 0;
    }

    if (sheep.grazeTimer > 0) continue;

    const moveDistance = (sheep.speed || 10) * dt;
    const nextX = sheep.x + Math.cos(sheep.wanderAngle || 0) * moveDistance;
    const nextY = sheep.y + Math.sin(sheep.wanderAngle || 0) * moveDistance;

    if (isCommandWalkablePoint(nextX, nextY, sheep.size * 0.55)) {
      const oldX = sheep.x;
      const oldY = sheep.y;
      sheep.x = nextX;
      sheep.y = nextY;
      setAnimalHeadingFromMovement(sheep, sheep.x - oldX, sheep.y - oldY);
    } else {
      sheep.wanderAngle = (sheep.wanderAngle || 0) + Math.PI * (0.65 + Math.random() * 0.7);
      sheep.wanderTimer = 0.25 + Math.random() * 0.8;
      sheep.grazeTimer = 0.2 + Math.random() * 0.8;
    }
  }
}

function isDuckPreferredPoint(worldX, worldY) {
  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);
  return isInsideMap(tileX, tileY) &&
    terrainData[tileY][tileX] === TERRAIN.WATER &&
    obstacleData[tileY][tileX] === OBSTACLE.NONE;
}

function updateDucks(dt) {
  if (!Array.isArray(duckData) || duckData.length === 0) return;

  for (const duck of duckData) {
    if (duck.isDead) continue;

    duck.wanderTimer -= dt;
    if (duck.wanderTimer <= 0) {
      duck.wanderAngle = (duck.wanderAngle || 0) + (Math.random() - 0.5) * Math.PI * 0.85;
      duck.wanderTimer = 0.7 + Math.random() * 2.0;
    }

    const moveDistance = (duck.speed || 14) * dt;
    const nextX = duck.x + Math.cos(duck.wanderAngle || 0) * moveDistance;
    const nextY = duck.y + Math.sin(duck.wanderAngle || 0) * moveDistance;

    if (isDuckPreferredPoint(nextX, nextY)) {
      const oldX = duck.x;
      const oldY = duck.y;
      duck.x = nextX;
      duck.y = nextY;
      setAnimalHeadingFromMovement(duck, duck.x - oldX, duck.y - oldY);
    } else {
      duck.wanderAngle = (duck.wanderAngle || 0) + Math.PI * (0.7 + Math.random() * 0.6);
      duck.wanderTimer = 0.2 + Math.random() * 0.7;
    }
  }
}

function updateHorses(dt) {
  if (!Array.isArray(horseData) || horseData.length === 0) return;

  for (const horse of horseData) {
    if (horse.isDead) continue;

    horse.wanderTimer -= dt;
    horse.grazeTimer -= dt;

    if (horse.wanderTimer <= 0) {
      horse.wanderAngle = (horse.wanderAngle || 0) + (Math.random() - 0.5) * Math.PI * 0.8;
      horse.wanderTimer = 0.8 + Math.random() * 2.5;
      horse.grazeTimer = Math.random() < 0.3 ? 0.7 + Math.random() * 1.6 : 0;
    }

    if (horse.grazeTimer > 0) continue;

    const moveDistance = (horse.speed || 20) * dt;
    const nextX = horse.x + Math.cos(horse.wanderAngle || 0) * moveDistance;
    const nextY = horse.y + Math.sin(horse.wanderAngle || 0) * moveDistance;

    if (isCommandWalkablePoint(nextX, nextY, horse.size * 0.45)) {
      const oldX = horse.x;
      const oldY = horse.y;
      horse.x = nextX;
      horse.y = nextY;
      setAnimalHeadingFromMovement(horse, horse.x - oldX, horse.y - oldY);
    } else {
      horse.wanderAngle = (horse.wanderAngle || 0) + Math.PI * (0.6 + Math.random() * 0.8);
      horse.wanderTimer = 0.3 + Math.random() * 0.8;
      horse.grazeTimer = 0.2 + Math.random() * 0.8;
    }
  }
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

function obstacleSpecies(obstacleType, tileX, tileY) {
  if (obstacleType === OBSTACLE.ROCK) return 'Granite Outcrop';
  const treeKind = Math.floor(hashNoise(tileX + 83, tileY + 29) * 3);
  return treeKind === 0 ? 'Pine Tree' : treeKind === 1 ? 'Oak Tree' : 'Palm Tree';
}

function rebuildObstacleEntities() {
  obstacleEntityData = [];
  obstacleEntityGrid = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(null));

  if (!Array.isArray(obstacleData) || obstacleData.length === 0) return;
  for (let tileY = 0; tileY < MAP_ROWS; tileY++) {
    for (let tileX = 0; tileX < MAP_COLS; tileX++) {
      const obstacleType = obstacleData[tileY][tileX];
      if (obstacleType !== OBSTACLE.TREE && obstacleType !== OBSTACLE.ROCK) continue;
      const center = tileCenter(tileX, tileY);
      const isTree = obstacleType === OBSTACLE.TREE;
      const maxHp = isTree ? 120 : 220;
      const obstacle = {
        id: `obstacle-${tileX}-${tileY}`,
        objectType: 'obstacle',
        obstacleType,
        tileX,
        tileY,
        x: center.x,
        y: center.y,
        size: tileSize * (isTree ? 1.35 : 1.05),
        displayName: obstacleSpecies(obstacleType, tileX, tileY),
        description: isTree
          ? 'A mature natural obstacle providing cover and blocking movement.'
          : 'A dense formation of weathered stone that blocks movement.',
        material: isTree ? 'Wood' : 'Stone',
        hardness: isTree ? 'Medium' : 'Very high',
        team: 'neutral',
        hp: maxHp,
        maxHp,
        selected: false,
        isDead: false,
        takeDamage(amount) {
          this.hp = Math.max(0, this.hp - amount);
          if (this.hp <= 0) this.die();
        },
        die() {
          this.isDead = true;
          this.selected = false;
          if (isInsideMap(this.tileX, this.tileY)) obstacleData[this.tileY][this.tileX] = OBSTACLE.NONE;
          if (selectedWorldObject === this) selectedWorldObject = null;
          obstacleRevision++;
        }
      };
      obstacleEntityData.push(obstacle);
      obstacleEntityGrid[tileY][tileX] = obstacle;
    }
  }

  obstacleRevision++;
  window.obstacleEntityData = obstacleEntityData;
}

function getObstacleAtPoint(worldX, worldY) {
  if (!Array.isArray(obstacleEntityData)) return null;
  let closest = null;
  let closestDist = Infinity;
  for (const obstacle of obstacleEntityData) {
    if (obstacle.isDead) continue;
    const dist = Math.hypot(obstacle.x - worldX, obstacle.y - worldY);
    if (dist <= obstacle.size && dist < closestDist) {
      closest = obstacle;
      closestDist = dist;
    }
  }
  return closest;
}

function getObstacleRevision() {
  return obstacleRevision;
}

function clearWorldObjectSelection() {
  if (selectedWorldObject) selectedWorldObject.selected = false;
  selectedWorldObject = null;
}

function selectWorldObject(object) {
  clearWorldObjectSelection();
  if (!object || object.isDead) return;
  object.selected = true;
  selectedWorldObject = object;
}

function getSelectedWorldObject() {
  return selectedWorldObject && !selectedWorldObject.isDead ? selectedWorldObject : null;
}

const BUILDING_TYPES = {
  HOME: 'home',
  TOWER: 'tower'
};

const BUILDING_STATS = {
  home: typeof getBuildingDefinition === 'function' ? getBuildingDefinition('home') : { width: 3, height: 3, hp: 420, size: 96 },
  tower: typeof getBuildingDefinition === 'function' ? getBuildingDefinition('tower') : { width: 2, height: 2, hp: 260, size: 70 }
};

function createBuilding(type, team, tileX, tileY) {
  const stats = BUILDING_STATS[type] || BUILDING_STATS.home;
  const building = {
    id: nextBuildingId++,
    type,
    team,
    tileX,
    tileY,
    width: stats.width,
    height: stats.height,
    x: (tileX + stats.width * 0.5) * tileSize,
    y: (tileY + stats.height * 0.5) * tileSize,
    hp: stats.hp,
    maxHp: stats.hp,
    size: stats.size,
    displayName: stats.name || type,
    range: stats.range || 0,
    damage: stats.damage || 0,
    attackCooldown: stats.attackCooldown || 1,
    projectileSpeed: stats.projectileSpeed || 260,
    projectileColor: stats.projectileColor || null,
    selected: false,
    isDead: false,
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) {
        this.isDead = true;
        this.selected = false;
      }
    }
  };
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
      if (isCastlePassageTile(building, tileX, tileY)) continue;
      return true;
    }
  }

  return false;
}

function isCastlePassageTile(building, tileX, tileY) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return false;
  const localX = tileX - building.tileX;
  const localY = tileY - building.tileY;
  return localX >= 0 && localX < building.width && localY >= 0 && localY < building.height;
}

function canPlaceBuildingAt(type, tileX, tileY) {
  const stats = BUILDING_STATS[type] || BUILDING_STATS.home;

  for (let y = tileY; y < tileY + stats.height; y++) {
    for (let x = tileX; x < tileX + stats.width; x++) {
      if (!isInsideMap(x, y)) return false;
      if (terrainData[y][x] === TERRAIN.WATER) return false;
      if (obstacleData[y][x] !== OBSTACLE.NONE) return false;
      if (isTileBlockedByBuilding(x, y)) return false;
    }
  }

  return true;
}

function prepareBuildingPad(type, tileX, tileY) {
  const stats = BUILDING_STATS[type] || BUILDING_STATS.home;

  for (let y = tileY; y < tileY + stats.height; y++) {
    for (let x = tileX; x < tileX + stats.width; x++) {
      if (!isInsideMap(x, y)) return false;
      terrainData[y][x] = TERRAIN.GRASS;
      obstacleData[y][x] = OBSTACLE.NONE;
      decorationData[y][x] = DECOR.NONE;
    }
  }

  buildTerrainRenderCache();
  return true;
}

function findBuildingSite(team, type, preferredXRatio, preferredYRatio) {
  const stats = BUILDING_STATS[type] || BUILDING_STATS.home;
  const homeSideMin = team === 'red' ? 2 : Math.floor(MAP_COLS * 0.52);
  const homeSideMax = team === 'red' ? Math.floor(MAP_COLS * 0.48) : MAP_COLS - stats.width - 2;
  const preferredX = Math.floor(MAP_COLS * preferredXRatio - stats.width * 0.5);
  const preferredY = Math.floor(MAP_ROWS * preferredYRatio - stats.height * 0.5);
  const clampedX = Math.max(homeSideMin, Math.min(preferredX, homeSideMax));
  const clampedY = Math.max(2, Math.min(preferredY, MAP_ROWS - stats.height - 2));
  let best = null;
  let bestScore = Infinity;

  for (let y = 1; y <= MAP_ROWS - stats.height - 1; y++) {
    for (let x = homeSideMin; x <= homeSideMax; x++) {
      if (!canPlaceBuildingAt(type, x, y)) continue;
      const distance = Math.hypot(x - clampedX, y - clampedY);
      if (distance < bestScore) {
        best = { x, y };
        bestScore = distance;
      }
    }
  }

  if (!best && type === BUILDING_TYPES.HOME) {
    const fallbackX = Math.max(homeSideMin, Math.min(clampedX, homeSideMax));
    const fallbackY = Math.max(2, Math.min(clampedY, MAP_ROWS - stats.height - 2));
    if (prepareBuildingPad(type, fallbackX, fallbackY) && canPlaceBuildingAt(type, fallbackX, fallbackY)) {
      return { x: fallbackX, y: fallbackY };
    }
  }

  return best;
}

function placeTeamBuildings(config = window.mapConfig || {}) {
  buildingData = [];
  nextBuildingId = 1;

  const homesPerTeam = Math.max(0, Math.floor(Number(config.homesPerTeam) || 0));
  const towersPerTeam = Math.max(0, Math.floor(Number(config.towersPerTeam) || 0));
  const teams = Array.isArray(config.teams) && config.teams.length ? config.teams : ['red', 'blue'];
  const homeRatios = {
    red: [[0.18, 0.5], [0.22, 0.34]],
    blue: [[0.82, 0.5], [0.78, 0.66]]
  };
  const towerRatios = {
    red: [[0.31, 0.43], [0.28, 0.62], [0.35, 0.28], [0.35, 0.74]],
    blue: [[0.69, 0.57], [0.72, 0.38], [0.65, 0.72], [0.65, 0.26]]
  };

  for (const team of teams) {
    if (team !== 'red' && team !== 'blue') continue;

    for (let i = 0; i < homesPerTeam; i++) {
      const ratios = homeRatios[team][i] || homeRatios[team][homeRatios[team].length - 1];
      const site = findBuildingSite(team, BUILDING_TYPES.HOME, ratios[0], ratios[1]);
      if (site) createBuilding(BUILDING_TYPES.HOME, team, site.x, site.y);
    }

    for (let i = 0; i < towersPerTeam; i++) {
      const ratios = towerRatios[team][i] || towerRatios[team][towerRatios[team].length - 1];
      const site = findBuildingSite(team, BUILDING_TYPES.TOWER, ratios[0], ratios[1]);
      if (site) createBuilding(BUILDING_TYPES.TOWER, team, site.x, site.y);
    }
  }

  window.buildingData = buildingData;
  rebuildObstacleEntities();
}

function getTeamHome(team) {
  if (!Array.isArray(buildingData)) return null;
  return buildingData.find(building => !building.isDead && building.team === team && building.type === BUILDING_TYPES.HOME) || null;
}

function getBuildings() {
  return Array.isArray(buildingData) ? buildingData : [];
}

function clearBuildingSelection() {
  for (const building of getBuildings()) {
    building.selected = false;
  }
}

function selectBuilding(building) {
  clearBuildingSelection();
  if (building && !building.isDead) {
    building.selected = true;
  }
}

function getSelectedBuilding() {
  return getBuildings().find(building => building.selected && !building.isDead) || null;
}

function getBuildingAtPoint(worldX, worldY) {
  if (!Array.isArray(buildingData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const building of buildingData) {
    if (building.isDead) continue;
    const halfW = building.width * tileSize * 0.72;
    const halfH = building.height * tileSize * 0.78;
    if (
      worldX >= building.x - halfW &&
      worldX <= building.x + halfW &&
      worldY >= building.y - halfH &&
      worldY <= building.y + halfH
    ) {
      const dist = Math.hypot(building.x - worldX, building.y - worldY);
      if (dist < closestDist) {
        closest = building;
        closestDist = dist;
      }
    }
  }

  return closest;
}

function getBuildingAtScreenPoint(screenX, screenY) {
  if (!camera || !Array.isArray(buildingData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const building of buildingData) {
    if (building.isDead) continue;
    const screenBuildingX = (building.x - camera.x) * camera.zoom;
    const screenBuildingY = (building.y - camera.y) * camera.zoom;
    const halfW = building.width * tileSize * 0.72 * camera.zoom;
    const halfH = building.height * tileSize * 0.78 * camera.zoom;

    if (
      screenX >= screenBuildingX - halfW &&
      screenX <= screenBuildingX + halfW &&
      screenY >= screenBuildingY - halfH &&
      screenY <= screenBuildingY + halfH
    ) {
      const dist = Math.hypot(screenBuildingX - screenX, screenBuildingY - screenY);
      if (dist < closestDist) {
        closest = building;
        closestDist = dist;
      }
    }
  }

  return closest;
}

function isCastleCourtyardPoint(building, worldX, worldY) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return false;
  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);
  const localX = tileX - building.tileX;
  const localY = tileY - building.tileY;
  return localX >= 2 &&
    localX <= building.width - 3 &&
    localY >= 2 &&
    localY <= building.height - 3;
}

function isPointInsideCastle(building, worldX, worldY) {
  if (!building || building.type !== BUILDING_TYPES.HOME || building.isDead) return false;
  const left = building.tileX * tileSize;
  const top = building.tileY * tileSize;
  return worldX >= left &&
    worldX < left + building.width * tileSize &&
    worldY >= top &&
    worldY < top + building.height * tileSize;
}

function getCastleContainingPoint(worldX, worldY) {
  return getBuildings().find(building => isPointInsideCastle(building, worldX, worldY)) || null;
}

function getCastleDoorPoints(building) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return null;
  const gateTileX = building.tileX + Math.floor(building.width * 0.5);
  return {
    inside: tileCenter(gateTileX, building.tileY + building.height - 2),
    threshold: tileCenter(gateTileX, building.tileY + building.height - 1),
    outside: tileCenter(gateTileX, building.tileY + building.height),
    backY: (building.tileY - 0.5) * tileSize,
    frontY: (building.tileY + building.height + 0.5) * tileSize,
    leftX: (building.tileX - 0.5) * tileSize,
    rightX: (building.tileX + building.width + 0.5) * tileSize
  };
}

function issueUnitRoute(unit, points, append = false) {
  const validPoints = points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y));
  validPoints.forEach((point, index) => {
    unit.issueMoveCommand(point.x, point.y, { append: index === 0 ? append : true });
  });
  return validPoints.length > 0;
}

function getCastleDoorApproach(unit, building, door) {
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

function commandUnitIntoCastle(unit, building, destination, append = false) {
  if (!unit || !building || !destination || unit.isDead || building.isDead) return false;
  if (isPointInsideCastle(building, unit.x, unit.y)) {
    unit.issueMoveCommand(destination.x, destination.y, { append });
    return true;
  }

  const door = getCastleDoorPoints(building);
  if (!door) return false;
  const route = [
    ...getCastleDoorApproach(unit, building, door),
    door.outside,
    door.threshold,
    door.inside,
    destination
  ];
  clearCastleTopCommand(unit);
  return issueUnitRoute(unit, route, append);
}

function commandUnitOutOfCastle(unit, building, destination, append = false) {
  if (!unit || !building || !destination || unit.isDead || building.isDead) return false;
  const door = getCastleDoorPoints(building);
  if (!door) return false;
  clearCastleTopCommand(unit);
  return issueUnitRoute(unit, [door.inside, door.threshold, door.outside, destination], append);
}

function getLiveBuildingsNearPoint(worldX, worldY, radius) {
  if (!Array.isArray(buildingData)) return [];
  return buildingData.filter(building => {
    if (building.isDead) return false;
    const hitRadius = Math.max(building.width, building.height) * tileSize * 0.5;
    return Math.hypot(building.x - worldX, building.y - worldY) <= radius + hitRadius;
  });
}

function getCastleWallSlots(building) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return [];

  const slots = [];
  const minX = building.tileX;
  const maxX = building.tileX + building.width - 1;
  const minY = building.tileY;
  const maxY = building.tileY + building.height - 1;

  for (let x = minX; x <= maxX; x++) slots.push({ tileX: x, tileY: minY });
  for (let y = minY + 1; y <= maxY; y++) slots.push({ tileX: maxX, tileY: y });
  for (let x = maxX - 1; x >= minX; x--) slots.push({ tileX: x, tileY: maxY });
  for (let y = maxY - 1; y > minY; y--) slots.push({ tileX: minX, tileY: y });

  return slots.map(slot => ({ ...slot, ...tileCenter(slot.tileX, slot.tileY) }));
}

function getNearestCastleWallSlotIndex(slots, worldX, worldY) {
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

function getCastleRampPoints(building) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return null;
  const stairY = building.tileY + Math.min(building.height - 2, Math.floor(building.height * 0.5) + 1);
  const base = tileCenter(building.tileX + building.width - 3, stairY);
  const top = tileCenter(building.tileX + building.width - 1, stairY);
  const slots = getCastleWallSlots(building);
  return {
    base,
    top,
    topSlotIndex: getNearestCastleWallSlotIndex(slots, top.x, top.y)
  };
}

function getCastleWallRoute(slots, startIndex, endIndex) {
  if (!slots.length || startIndex === endIndex) return [];
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

function getCastleStairPoint(building, index = 0, total = 1, targetWorldX = null, targetWorldY = null) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return null;

  const wallSlots = getCastleWallSlots(building);
  const hasTarget = Number.isFinite(targetWorldX) && Number.isFinite(targetWorldY);
  const targetIndex = hasTarget
    ? getNearestCastleWallSlotIndex(wallSlots, targetWorldX, targetWorldY)
    : 0;
  const spreadOffset = index === 0 ? 0 : Math.ceil(index * 0.5) * (index % 2 ? 1 : -1);
  const slot = wallSlots[(targetIndex + spreadOffset + wallSlots.length) % Math.max(1, wallSlots.length)] || {
    x: building.x,
    y: building.y - building.height * tileSize * 0.5 + tileSize * 0.5
  };
  const preferred = { x: slot.x, y: slot.y };
  const clampedX = clamp(preferred.x, tileSize * 0.5, getMapWidthPx() - tileSize * 0.5);
  const clampedY = clamp(preferred.y, tileSize * 0.5, getMapHeightPx() - tileSize * 0.5);

  return isCommandWalkablePoint(clampedX, clampedY, tileSize * 0.45)
    ? { x: clampedX, y: clampedY, adjusted: false }
    : findNearestWalkablePoint(clampedX, clampedY, tileSize * 0.45) || {
    x: clampedX,
    y: clampedY
  };
}

function commandUnitToCastleTop(unit, building, index = 0, total = 1, append = false, targetWorldX = null, targetWorldY = null) {
  if (!unit || !building || building.isDead || building.type !== BUILDING_TYPES.HOME) return false;
  if (unit.isDead || unit.team !== building.team) return false;

  const wallSlots = getCastleWallSlots(building);
  const ramp = getCastleRampPoints(building);
  const stairPoint = getCastleStairPoint(building, index, total, targetWorldX, targetWorldY);
  if (!stairPoint || !ramp || wallSlots.length === 0) return false;

  const destinationIndex = getNearestCastleWallSlotIndex(wallSlots, stairPoint.x, stairPoint.y);
  const alreadyOnRamparts = unit.castleTopBuildingId === building.id && unit.castleRampClimbed;
  const startIndex = alreadyOnRamparts
    ? getNearestCastleWallSlotIndex(wallSlots, unit.x, unit.y)
    : ramp.topSlotIndex;
  const wallRoute = getCastleWallRoute(wallSlots, startIndex, destinationIndex);

  if (alreadyOnRamparts) {
    const route = wallRoute.length > 0 ? wallRoute : [wallSlots[destinationIndex]];
    route.forEach((point, routeIndex) => {
      unit.issueMoveCommand(point.x, point.y, { append: routeIndex === 0 ? append : true });
    });
  } else {
    unit.issueMoveCommand(ramp.base.x, ramp.base.y, { append });
    unit.issueMoveCommand(ramp.top.x, ramp.top.y, { append: true });
    wallRoute.forEach(point => unit.issueMoveCommand(point.x, point.y, { append: true }));
  }

  unit.castleTopBuildingId = building.id;
  unit.castleTopStairPoint = stairPoint;
  unit.castleTopReached = false;
  unit.castleRampBase = ramp.base;
  unit.castleRampTop = ramp.top;
  unit.castleRampClimbed = alreadyOnRamparts;
  return true;
}

function clearCastleTopCommand(unit) {
  if (!unit) return;
  unit.castleTopBuildingId = null;
  unit.castleTopStairPoint = null;
  unit.castleTopReached = false;
  unit.castleRampBase = null;
  unit.castleRampTop = null;
  unit.castleRampClimbed = false;
}

function getCastleTopDefender(building, units) {
  if (!building || building.type !== BUILDING_TYPES.HOME) return null;

  let defender = null;
  let closestDist = Infinity;
  for (const unit of units) {
    if (unit.isDead || unit.team !== building.team || unit.castleTopBuildingId !== building.id) continue;
    const stairPoint = unit.castleTopStairPoint || getCastleStairPoint(building, 0, 1);
    const dist = stairPoint ? Math.hypot(unit.x - stairPoint.x, unit.y - stairPoint.y) : Infinity;

    if (!unit.castleRampClimbed && unit.castleRampTop) {
      const rampTopDistance = Math.hypot(unit.x - unit.castleRampTop.x, unit.y - unit.castleRampTop.y);
      if (rampTopDistance < tileSize * 0.7) unit.castleRampClimbed = true;
    }

    if (dist < tileSize * 0.85) {
      unit.castleTopReached = true;
    }
    if (unit.castleTopReached && dist < closestDist) {
      defender = unit;
      closestDist = dist;
    }
  }

  return defender;
}

function updateBuildings(dt, units) {
  if (!Array.isArray(buildingData) || !Array.isArray(units)) return;

  for (const building of buildingData) {
    building.rampartUnitId = null;
    if (building.isDead) continue;

    const rampartDefender = building.type === BUILDING_TYPES.HOME
      ? getCastleTopDefender(building, units)
      : null;
    if (rampartDefender) {
      building.rampartUnitId = rampartDefender.id;
    }
    const canFire = building.type === BUILDING_TYPES.TOWER || !!rampartDefender;
    if (!canFire) continue;

    building.fireCooldown = Math.max(0, (building.fireCooldown || 0) - dt);
    if (building.fireCooldown > 0) continue;

    let target = null;
    let closestDist = Infinity;
    const range = building.type === BUILDING_TYPES.HOME
      ? Math.max(building.range || 360, (rampartDefender?.shootRange || 120) + 175)
      : building.range || 245;

    for (const unit of units) {
      if (unit.isDead || unit.team === building.team) continue;
      const dist = Math.hypot(unit.x - building.x, unit.y - building.y);
      if (dist < range && dist < closestDist) {
        target = unit;
        closestDist = dist;
      }
    }

    if (target && window.bullets && typeof Bullet !== 'undefined') {
      building.rampartUnitId = rampartDefender ? rampartDefender.id : null;
      window.bullets.push(Bullet.obtain(
        building.x,
        building.y - tileSize * (building.type === BUILDING_TYPES.HOME ? 1.35 : 0.75),
        target,
        building.team,
        building.type === BUILDING_TYPES.HOME
          ? Math.max(building.damage || 0, rampartDefender?.damage || 8)
          : building.damage || 12,
        building,
        rampartDefender?.projectileSpeed || building.projectileSpeed,
        rampartDefender?.projectileColor || building.projectileColor
      ));
      building.fireCooldown = building.attackCooldown || 1.15;
    }
  }
}

function isInsideMap(tileX, tileY) {
  return tileY >= 0 && tileY < terrainData.length && tileX >= 0 && tileX < terrainData[0].length;
}

function isWalkableTile(tileX, tileY) {
  if (!isInsideMap(tileX, tileY)) return false;

  const terrainType = terrainData[tileY][tileX];
  const obstacleType = obstacleData[tileY][tileX];

  if (terrainType === TERRAIN.WATER) return false;
  if (obstacleType === OBSTACLE.TREE || obstacleType === OBSTACLE.ROCK) return false;
  if (isTileBlockedByBuilding(tileX, tileY)) return false;

  return true;
}

function getMovementCost(tileX, tileY) {
  if (!isWalkableTile(tileX, tileY)) return Infinity;

  const terrainType = terrainData[tileY][tileX];
  const obstacleType = obstacleData[tileY][tileX];

  let cost = 1;
  if (terrainType === TERRAIN.SAND) cost = 1.35;
  else if (terrainType === TERRAIN.DIRT) cost = 1.15;

  if (obstacleType === OBSTACLE.SHRUB) {
    cost += 0.2;
  }

  return cost;
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
  if (terrainType === TERRAIN.WATER) {
    ctx.fillStyle = '#2f78b7';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
    return;
  }

  if (terrainType === TERRAIN.GRASS) {
    if (tileSprites.grass.complete && tileSprites.grass.naturalWidth > 0) {
      ctx.drawImage(tileSprites.grass, drawX, drawY, tileSize, tileSize);
    } else {
      ctx.fillStyle = '#4a7c3f';
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
    }
    return;
  }

  if (terrainType === TERRAIN.SAND) {
    if (tileSprites.sand.complete && tileSprites.sand.naturalWidth > 0) {
      ctx.drawImage(tileSprites.sand, drawX, drawY, tileSize, tileSize);
    } else {
      ctx.fillStyle = '#c8b560';
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
    }
    return;
  }

  // DIRT
  if (tileSprites.dirt.complete && tileSprites.dirt.naturalWidth > 0) {
    ctx.drawImage(tileSprites.dirt, drawX, drawY, tileSize, tileSize);
  } else {
    ctx.fillStyle = '#8b6a3a';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
  }
}

function drawTerrainAccents(terrainType, x, y, drawX, drawY) {
  const n = hashNoise(x + 17, y + 29);

  if (terrainType === TERRAIN.WATER) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = n > 0.5 ? '#9fd1e8' : '#1f5c91';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX + 4, drawY + tileSize * (0.35 + n * 0.2));
    ctx.quadraticCurveTo(drawX + 14, drawY + 10, drawX + 28, drawY + tileSize * (0.38 + n * 0.15));
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (terrainType === TERRAIN.GRASS && n > 0.72) {
    ctx.fillStyle = n > 0.86 ? 'rgba(197, 178, 91, 0.1)' : 'rgba(15, 46, 18, 0.09)';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
  }

  if (terrainType === TERRAIN.SAND && n > 0.65) {
    ctx.fillStyle = 'rgba(132, 94, 43, 0.07)';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
  }
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
    ctx.fillStyle = 'rgba(28, 14, 5, 0.23)';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 23, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#736857';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 18, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#31241b';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 17, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6b4020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(drawX + 9, drawY + 15);
    ctx.lineTo(drawX + 9, drawY + 5);
    ctx.moveTo(drawX + 23, drawY + 15);
    ctx.lineTo(drawX + 23, drawY + 5);
    ctx.moveTo(drawX + 8, drawY + 5);
    ctx.lineTo(drawX + 24, drawY + 5);
    ctx.stroke();
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
  // Only draw a subtle shoreline tint where water meets land
  if (terrainType !== TERRAIN.WATER) return;

  const neighbors = [
    { x: x + 1, y }, { x: x - 1, y },
    { x, y: y + 1 }, { x, y: y - 1 }
  ];

  const hasLandNeighbor = neighbors.some(n =>
    isInsideMap(n.x, n.y) && terrainData[n.y][n.x] !== TERRAIN.WATER
  );

  if (hasLandNeighbor) {
    ctx.fillStyle = 'rgba(255, 240, 180, 0.15)';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
  }
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
  const height = tileSize * (2.55 + hashNoise(x + 617, y + 211) * 0.55);
  const width = tileSize * (0.88 + hashNoise(x + 89, y + 613) * 0.18);

  ctx.save();
  ctx.fillStyle = 'rgba(14, 8, 3, 0.25)';
  ctx.beginPath();
  ctx.ellipse(baseX + 4, baseY + 2, width * 0.42, tileSize * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6a3b1d';
  ctx.fillRect(baseX - 4, baseY - height * 0.52, 8, height * 0.55);

  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const layerY = baseY - height * (0.22 + t * 0.65);
    const layerWidth = width * (1.1 - t * 0.45);
    ctx.fillStyle = i % 2 === 0 ? '#173d25' : '#215630';
    ctx.beginPath();
    ctx.moveTo(baseX, layerY - height * 0.18);
    ctx.lineTo(baseX - layerWidth * 0.55, layerY + tileSize * 0.18);
    ctx.lineTo(baseX + layerWidth * 0.55, layerY + tileSize * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(120, 166, 86, 0.2)';
  ctx.beginPath();
  ctx.moveTo(baseX - width * 0.2, baseY - height * 0.78);
  ctx.lineTo(baseX, baseY - height * 0.92);
  ctx.lineTo(baseX + width * 0.08, baseY - height * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPalmTree(x, y, drawX, drawY) {
  const baseX = drawX + tileSize * (0.5 + (hashNoise(x + 1821, y + 97) - 0.5) * 0.16);
  const baseY = drawY + tileSize * 0.92;
  const height = tileSize * (2.35 + hashNoise(x + 17, y + 1439) * 0.5);
  const lean = (hashNoise(x + 311, y + 1709) - 0.5) * tileSize * 0.42;
  const topX = baseX + lean;
  const topY = baseY - height;

  ctx.save();
  ctx.fillStyle = 'rgba(14, 8, 3, 0.22)';
  ctx.beginPath();
  ctx.ellipse(baseX + 5, baseY + 2, tileSize * 0.36, tileSize * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8a5529';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + lean * 0.32, baseY - height * 0.52, topX, topY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(68, 37, 15, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const yPos = baseY - height * t;
    const xPos = baseX + lean * t * 0.75;
    ctx.beginPath();
    ctx.moveTo(xPos - 4, yPos);
    ctx.lineTo(xPos + 6, yPos - 5);
    ctx.stroke();
  }

  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const angle = -Math.PI * 0.92 + (i / (fronds - 1)) * Math.PI * 1.55;
    const length = tileSize * (0.85 + hashNoise(x + i * 41, y + 907) * 0.35);
    const endX = topX + Math.cos(angle) * length;
    const endY = topY + Math.sin(angle) * length * 0.55;
    ctx.strokeStyle = i % 2 === 0 ? '#2f7a3d' : '#3f8c45';
    ctx.lineWidth = 7;
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
  }

  ctx.fillStyle = '#5f3a1a';
  ctx.beginPath();
  ctx.arc(topX, topY + 2, 5, 0, Math.PI * 2);
  ctx.fill();
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
  const startX = Math.max(0, Math.floor(camX / tileSize));
  const endX = Math.min(MAP_COLS - 1, Math.floor((camX + viewWidth) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(camY / tileSize));
  const endY = Math.min(MAP_ROWS - 1, Math.floor((camY + viewHeight) / tileSize) + 1);
  const now = performance.now() * 0.001;

  ctx.save();
  ctx.strokeStyle = 'rgba(184, 222, 231, 0.22)';
  ctx.lineWidth = 1;
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (terrainData[y][x] !== TERRAIN.WATER) continue;
      const n = hashNoise(x + 5009, y + 911);
      if (n < 0.82) continue;
      const phase = now * 1.4 + n * Math.PI * 2;
      const ripple = 4 + (Math.sin(phase) + 1) * 3;
      const cx = x * tileSize + tileSize * (0.25 + hashNoise(x + 31, y + 47) * 0.5);
      const cy = y * tileSize + tileSize * (0.25 + hashNoise(x + 79, y + 11) * 0.5);
      ctx.globalAlpha = 0.35 + Math.sin(phase) * 0.15;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ripple * 1.7, ripple * 0.55, 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
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

  if (building.type === BUILDING_TYPES.TOWER) {
    drawTowerBuilding(building);
  } else {
    drawHomeBuilding(building, layer);
  }

  if (building.selected && layer !== 'base') {
    drawBuildingHealth(building);
  }
}

function getTeamAccent(team) {
  return team === 'red' ? '#b63b32' : '#2f66b7';
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

function drawCastleStoneBlock(x, y, w, h, shade = 0) {
  ctx.fillStyle = shade > 0 ? '#aaa99b' : shade < 0 ? '#666961' : '#85877d';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(38, 40, 36, 0.48)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  const courseHeight = Math.max(7, tileSize * 0.18);
  ctx.strokeStyle = 'rgba(238, 232, 211, 0.14)';
  for (let yy = y + courseHeight; yy < y + h; yy += courseHeight) {
    ctx.beginPath();
    ctx.moveTo(x + 1, yy);
    ctx.lineTo(x + w - 1, yy);
    ctx.stroke();
  }
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

  ctx.fillStyle = '#5d6059';
  ctx.fillRect(left + wall * 0.08, top + wall * 0.08, w - wall * 0.16, wall * 0.94);
  ctx.fillRect(left + wall * 0.08, top + wall * 0.08, wall * 0.94, h - wall * 0.28);
  ctx.fillRect(right - wall * 1.02, top + wall * 0.08, wall * 0.94, h - wall * 0.28);

  ctx.fillStyle = '#a3a294';
  ctx.fillRect(left + wall * 0.18, top + wall * 0.18, w - wall * 0.36, wall * 0.7);
  ctx.fillRect(left + wall * 0.18, top + wall * 0.18, wall * 0.7, h - wall * 0.5);
  ctx.fillRect(right - wall * 0.88, top + wall * 0.18, wall * 0.7, h - wall * 0.5);

  ctx.strokeStyle = 'rgba(42, 44, 40, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left + wall * 0.18, top + wall * 0.18, w - wall * 0.36, wall * 0.7);
  ctx.strokeRect(left + wall * 0.18, top + wall * 0.18, wall * 0.7, h - wall * 0.5);
  ctx.strokeRect(right - wall * 0.88, top + wall * 0.18, wall * 0.7, h - wall * 0.5);

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

  ctx.fillStyle = '#777a70';
  for (let i = 0; i < 9; i++) {
    const bx = left + wall * 1.05 + i * ((w - wall * 2.1) / 8);
    ctx.fillRect(bx - tileSize * 0.12, top + wall * 0.08, tileSize * 0.24, tileSize * 0.24);
  }
  for (let i = 1; i < 6; i++) {
    const by = top + wall * 1.1 + i * ((h - wall * 2.2) / 6);
    ctx.fillRect(left + wall * 0.08, by - tileSize * 0.1, tileSize * 0.24, tileSize * 0.2);
    ctx.fillRect(right - wall * 0.32, by - tileSize * 0.1, tileSize * 0.24, tileSize * 0.2);
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

  ctx.fillStyle = '#5d6059';
  ctx.fillRect(left + wall * 0.08, bottom - wall * 1.04, w - wall * 0.16, wall * 0.96);
  ctx.fillStyle = '#a3a294';
  ctx.fillRect(left + wall * 0.18, bottom - wall * 0.94, w - wall * 0.36, wall * 0.7);
  ctx.strokeStyle = 'rgba(42, 44, 40, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left + wall * 0.18, bottom - wall * 0.94, w - wall * 0.36, wall * 0.7);

  const gateW = tileSize * 1.9;
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

  ctx.fillStyle = '#777a70';
  for (let i = 0; i < 10; i++) {
    const bx = left + wall * 0.75 + i * ((w - wall * 1.5) / 9);
    if (Math.abs(bx) < gateW * 0.48) continue;
    ctx.fillRect(bx - tileSize * 0.12, bottom - wall * 1.12, tileSize * 0.24, tileSize * 0.24);
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

  if (building.rampartUnitId) {
    ctx.fillStyle = accent;
    ctx.strokeStyle = '#1d1208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -h * 0.24, Math.max(5, w * 0.025), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f0d173';
    ctx.beginPath();
    ctx.moveTo(-w * 0.025, -h * 0.22);
    ctx.lineTo(w * 0.04, -h * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHomeBuilding(building, layer = 'full') {
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

function drawTowerBuilding(building) {
  const x = building.x;
  const y = building.y;
  const w = building.width * tileSize;
  const h = building.height * tileSize;
  const accent = getTeamAccent(building.team);
  const stone = '#87897f';

  ctx.save();
  ctx.translate(x, y);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#1c1209';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.34, w * 0.43, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = stone;
  ctx.fillRect(-w * 0.28, -h * 0.56, w * 0.56, h * 0.96);
  ctx.strokeStyle = '#383b35';
  ctx.lineWidth = 3;
  ctx.strokeRect(-w * 0.28, -h * 0.56, w * 0.56, h * 0.96);

  ctx.fillStyle = '#666a60';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * w * 0.13 - w * 0.045, -h * 0.72, w * 0.09, h * 0.18);
  }
  ctx.fillRect(-w * 0.36, -h * 0.58, w * 0.72, h * 0.08);
  ctx.fillRect(-w * 0.37, -h * 0.63, w * 0.08, h * 0.13);
  ctx.fillRect(w * 0.29, -h * 0.63, w * 0.08, h * 0.13);

  ctx.strokeStyle = 'rgba(58, 55, 46, 0.45)';
  ctx.lineWidth = 1;
  for (let row = 0; row < 5; row++) {
    const yy = -h * 0.38 + row * h * 0.15;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, yy);
    ctx.lineTo(w * 0.28, yy);
    ctx.stroke();
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
  const camX = camera ? camera.x : 0;
  const camY = camera ? camera.y : 0;
  const zoom = camera ? camera.zoom : 1;
  const viewWidth = camera ? camera.viewportWidth / zoom : canvas.width;
  const viewHeight = camera ? camera.viewportHeight / zoom : canvas.height;
  const startX = Math.max(0, Math.floor((camX - tileSize * 3) / tileSize));
  const endX = Math.min(MAP_COLS - 1, Math.floor((camX + viewWidth + tileSize * 3) / tileSize));
  const startY = Math.max(0, Math.floor((camY - tileSize * 4) / tileSize));
  const endY = Math.min(MAP_ROWS - 1, Math.floor((camY + viewHeight + tileSize * 2) / tileSize));
  const drawList = [];

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const obstacleType = obstacleData[y][x];
      if (obstacleType === OBSTACLE.NONE) continue;
      drawList.push({
        type: 'obstacle',
        sortY: y * tileSize + (obstacleType === OBSTACLE.TREE ? tileSize * 0.9 : tileSize * 0.72),
        obstacleType,
        x,
        y
      });
    }
  }

  for (const sheep of sheepData) {
    if (sheep.isMounted) continue;
    if (sheep.x < camX - 40 || sheep.x > camX + viewWidth + 40 || sheep.y < camY - 40 || sheep.y > camY + viewHeight + 40) continue;
    drawList.push({ type: 'sheep', sortY: sheep.y + 12, sheep });
  }

  for (const duck of duckData) {
    if (duck.x < camX - 40 || duck.x > camX + viewWidth + 40 || duck.y < camY - 40 || duck.y > camY + viewHeight + 40) continue;
    drawList.push({ type: 'duck', sortY: duck.y + 8, duck });
  }

  for (const horse of horseData) {
    if (horse.isDead) continue;
    if (horse.x < camX - 50 || horse.x > camX + viewWidth + 50 || horse.y < camY - 50 || horse.y > camY + viewHeight + 50) continue;
    drawList.push({ type: 'horse', sortY: horse.y + 14, horse });
  }

  for (const building of buildingData) {
    if (building.isDead) continue;
    if (building.x < camX - 120 || building.x > camX + viewWidth + 120 || building.y < camY - 140 || building.y > camY + viewHeight + 90) continue;
    if (building.type === BUILDING_TYPES.HOME) {
      drawList.push({
        type: 'building',
        layer: 'base',
        sortY: building.y - building.height * tileSize * 0.52,
        building
      });
      drawList.push({
        type: 'building',
        layer: 'front',
        sortY: building.y + building.height * tileSize * 0.42,
        building
      });
    } else {
      drawList.push({
        type: 'building',
        layer: 'full',
        sortY: building.y + building.height * tileSize * 0.34,
        building
      });
    }
  }

  for (const unit of units) {
    drawList.push({ type: 'unit', sortY: unit.y + unit.size * 0.5, unit });
  }

  drawList.sort((a, b) => a.sortY - b.sortY);

  for (const item of drawList) {
    if (item.type === 'obstacle') {
      drawObstacle(item.obstacleType, item.x, item.y, item.x * tileSize, item.y * tileSize);
    } else if (item.type === 'building') {
      drawBuilding(item.building, item.layer || 'full');
    } else if (item.type === 'sheep') {
      drawSheep(item.sheep);
    } else if (item.type === 'duck') {
      drawDuck(item.duck);
    } else if (item.type === 'horse') {
      drawHorse(item.horse);
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

function canSpawnAt(x, y, unitSize = 20) {
  const offsets = [
    { dx: -unitSize / 2, dy: -unitSize / 2 },
    { dx: unitSize / 2, dy: -unitSize / 2 },
    { dx: -unitSize / 2, dy: unitSize / 2 },
    { dx: unitSize / 2, dy: unitSize / 2 }
  ];

  for (const offset of offsets) {
    const cornerX = x + offset.dx;
    const cornerY = y + offset.dy;

    const tileX = Math.floor(cornerX / tileSize);
    const tileY = Math.floor(cornerY / tileSize);

    if (!isWalkableTile(tileX, tileY)) {
      return false;
    }
  }

  return true;
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

function isCommandWalkablePoint(worldX, worldY, unitSize = 20) {
  return canSpawnAt(worldX, worldY, unitSize) && isVisualLandPoint(worldX, worldY);
}

function findNearestWalkablePoint(worldX, worldY, unitSize = 20, maxRadius = 16) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
  if (!terrainData || terrainData.length === 0) return null;

  const clampedX = Math.max(unitSize * 0.5, Math.min(worldX, getMapWidthPx() - unitSize * 0.5));
  const clampedY = Math.max(unitSize * 0.5, Math.min(worldY, getMapHeightPx() - unitSize * 0.5));

  if (isCommandWalkablePoint(clampedX, clampedY, unitSize)) {
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

        const candidateX = Math.max(unitSize * 0.5, Math.min(clampedX + dx, getMapWidthPx() - unitSize * 0.5));
        const candidateY = Math.max(unitSize * 0.5, Math.min(clampedY + dy, getMapHeightPx() - unitSize * 0.5));
        if (!isCommandWalkablePoint(candidateX, candidateY, unitSize)) continue;

        const distance = Math.hypot(candidateX - clampedX, candidateY - clampedY);
        if (distance < bestDistance) {
          best = { x: candidateX, y: candidateY };
          bestDistance = distance;
        }
      }
    }

    if (best) {
      return { x: best.x, y: best.y, adjusted: true };
    }
  }

  return null;
}

function randomSpotOnMap() {
  for (let attempt = 0; attempt < 400; attempt++) {
    const tileX = Math.floor(Math.random() * terrainData[0].length);
    const tileY = Math.floor(Math.random() * terrainData.length);

    if (isWalkableTile(tileX, tileY)) {
      return {
        x: tileX * tileSize + tileSize / 2,
        y: tileY * tileSize + tileSize / 2
      };
    }
  }

  return { x: tileSize / 2, y: tileSize / 2 };
}

function hasLineOfSight(startTile, endTile) {
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

  while (true) {
    if (!isWalkableTile(x, y)) {
      return false;
    }

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

    const movingDiagonally = (nextX !== x) && (nextY !== y);
    if (movingDiagonally) {
      const side1Blocked = !isWalkableTile(nextX, y);
      const side2Blocked = !isWalkableTile(x, nextY);

      if (side1Blocked || side2Blocked) {
        return false;
      }
    }

    x = nextX;
    y = nextY;
  }

  return true;
}

function smoothPath(path) {
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
        const side1Blocked = !isWalkableTile(end.x, start.y);
        const side2Blocked = !isWalkableTile(start.x, end.y);
        blockedDiagonal = side1Blocked || side2Blocked;
      }

      if (!blockedDiagonal && hasLineOfSight(start, end)) {
        found = true;
        break;
      }

      furthest--;
    }

    if (!found) {
      furthest = currentIndex + 1;
    }

    newPath.push(path[furthest]);

    if (furthest <= currentIndex) break;
    currentIndex = furthest;
  }

  const lastTile = path[path.length - 1];
  if (!newPath.some(t => t.x === lastTile.x && t.y === lastTile.y)) {
    newPath.push(lastTile);
  }

  return newPath;
}
