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

function createSheep(x, y, facing, phase) {
  return {
    x,
    y,
    facing,
    phase,
    team: 'neutral',
    hp: 24,
    maxHp: 24,
    size: 34,
    isDead: false,
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) this.die();
    },
    die() {
      this.isDead = true;
    }
  };
}

function getSheepAtPoint(worldX, worldY) {
  if (!Array.isArray(sheepData)) return null;

  let closest = null;
  let closestDist = Infinity;
  for (const sheep of sheepData) {
    if (sheep.isDead) continue;
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
    Math.hypot(sheep.x - worldX, sheep.y - worldY) <= radius + sheep.size * 0.5
  );
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
  ctx.beginPath();
  ctx.ellipse(12, -1, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, 6, 2, 6);
  ctx.fillRect(4, 6, 2, 6);

  ctx.fillStyle = '#fff8e8';
  ctx.fillRect(13, -3, 1, 1);
  ctx.restore();
}

function drawSheepSkeleton(sheep) {
  ctx.save();
  ctx.translate(sheep.x, sheep.y + 6);
  ctx.scale(sheep.facing * 1.35, 1.35);

  ctx.fillStyle = 'rgba(19, 10, 4, 0.24)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#e7dcc2';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  for (let i = -7; i <= 7; i += 4) {
    ctx.moveTo(i, -2);
    ctx.lineTo(i + 1, 4);
  }
  ctx.moveTo(-9, 2);
  ctx.lineTo(-14, 7);
  ctx.moveTo(8, 2);
  ctx.lineTo(14, 7);
  ctx.stroke();

  ctx.strokeStyle = '#cfc2a8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(13, -2, 4, 0, Math.PI * 2);
  ctx.moveTo(15, -3);
  ctx.lineTo(18, -5);
  ctx.stroke();
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
    if (sheep.x < camX - 40 || sheep.x > camX + viewWidth + 40 || sheep.y < camY - 40 || sheep.y > camY + viewHeight + 40) continue;
    drawList.push({ type: 'sheep', sortY: sheep.y + 12, sheep });
  }

  for (const unit of units) {
    if (unit.isDead) continue;
    drawList.push({ type: 'unit', sortY: unit.y + unit.size * 0.5, unit });
  }

  drawList.sort((a, b) => a.sortY - b.sortY);

  for (const item of drawList) {
    if (item.type === 'obstacle') {
      drawObstacle(item.obstacleType, item.x, item.y, item.x * tileSize, item.y * tileSize);
    } else if (item.type === 'sheep') {
      drawSheep(item.sheep);
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
