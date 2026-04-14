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
  const height = fbmNoise(x, y);
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

function drawObstacle(obstacleType, x, y, drawX, drawY) {
  if (obstacleType === OBSTACLE.NONE) return;

  // Soft grounding shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(drawX + tileSize * 0.5, drawY + tileSize * 0.8, tileSize * 0.28, tileSize * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obstacleType === OBSTACLE.TREE) {
    // Brown trunk
    ctx.fillStyle = '#6b4c2f';
    ctx.fillRect(drawX + tileSize * 0.46, drawY + tileSize * 0.5, tileSize * 0.12, tileSize * 0.28);

    // Green foliage (three circles)
    ctx.fillStyle = '#2f6f34';
    
    // Left circle
    ctx.beginPath();
    ctx.arc(drawX + tileSize * 0.38, drawY + tileSize * 0.42, tileSize * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Right circle
    ctx.beginPath();
    ctx.arc(drawX + tileSize * 0.62, drawY + tileSize * 0.43, tileSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Top circle
    ctx.beginPath();
    ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.3, tileSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
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

  // Rock with subtle tile-unique variation.
  const jitter = hashNoise(x + 401, y + 883) * 0.08 - 0.04;
  const size = tileSize * (0.82 + hashNoise(x + 751, y + 199) * 0.18);
  const offsetX = (tileSize - size) * 0.5 + tileSize * jitter;
  const offsetY = (tileSize - size) * 0.52;

  if (tileSprites.stone.complete && tileSprites.stone.naturalWidth > 0) {
    ctx.drawImage(tileSprites.stone, drawX + offsetX, drawY + offsetY, size, size);
  } else {
    ctx.fillStyle = '#7f7f7f';
    ctx.beginPath();
    ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.56, tileSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderMap() {
  const camX = camera ? camera.x : 0;
  const camY = camera ? camera.y : 0;
  const zoom = camera ? camera.zoom : 1;
  const viewWidth = camera ? camera.viewportWidth / zoom : canvas.width;
  const viewHeight = camera ? camera.viewportHeight / zoom : canvas.height;

  const startX = Math.max(0, Math.floor(camX / tileSize));
  const endX = Math.min(terrainData[0].length - 1, Math.floor((camX + viewWidth) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(camY / tileSize));
  const endY = Math.min(terrainData.length - 1, Math.floor((camY + viewHeight) / tileSize) + 1);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const terrainType = terrainData[y][x];
      const drawX = x * tileSize;
      const drawY = y * tileSize;

      drawTerrainTile(terrainType, drawX, drawY);
      drawTransitions(x, y, terrainType, drawX, drawY);
      drawObstacle(obstacleData[y][x], x, y, drawX, drawY);
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
