const tileSize = 32;

const TILE = {
    TREE: 0,
    GRASS: 1,
};

/* example
const mapData = [
  [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
];
*/
const mapData = Array.from({ length: 34 }, () =>
    Array.from({ length: 60 }, () => (Math.random() < 0.9 ? 1 : 0))
);

function renderMap() {
    for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
            const tile = mapData[y][x];
            ctx.fillStyle = tile === 1 ? '#4CAF50' : '#8B4513'; // grass or dirt
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
    }
}

function canSpawnAt(x, y, unitSize = 20) {
    const offsets = [
        { dx: -unitSize / 2, dy: -unitSize / 2 }, // top-left
        { dx: unitSize / 2, dy: -unitSize / 2 },  // top-right
        { dx: -unitSize / 2, dy: unitSize / 2 },  // bottom-left
        { dx: unitSize / 2, dy: unitSize / 2 },   // bottom-right
    ];

    for (const offset of offsets) {
        const cornerX = x + offset.dx;
        const cornerY = y + offset.dy;

        const tileX = Math.floor(cornerX / tileSize);
        const tileY = Math.floor(cornerY / tileSize);

        if (
        tileY < 0 || tileY >= mapData.length ||
        tileX < 0 || tileX >= mapData[0].length ||
        mapData[tileY][tileX] !== TILE.GRASS
        ) {
            return false; // One corner is invalid, block the move
        }
    }

    return true; // All corners are valid
}

function randomSpotOnMap() {
    const x = Math.floor(Math.random() * mapData[0].length)  * tileSize + tileSize / 2;
    const y = Math.floor(Math.random() * mapData.length)  * tileSize + tileSize / 2;
    return {x, y};
}

// this one was trying to cut through two trees touching diagonally
function old_hasLineOfSight(startTile, endTile) {
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
      if (mapData[y][x] !== TILE.GRASS) return false; // Blocked
  
      if (x === x1 && y === y1) break;
  
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  
    return true; // Clear path
}

// this one was supposed to prevent corner cutting but failed
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
    // --- Check if this tile is blocked ---
    if (
      y < 0 || y >= mapData.length ||
      x < 0 || x >= mapData[0].length ||
      mapData[y][x] !== TILE.GRASS
    ) {
      return false; // Blocked tile found
    }

    if (x === x1 && y === y1) break; // Reached the end tile

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

    // --- Prevent corner cutting ---
    const movingDiagonally = (nextX !== x) && (nextY !== y);

    if (movingDiagonally) {
      const side1Blocked = mapData[y][nextX] !== TILE.GRASS;
      const side2Blocked = mapData[nextY][x] !== TILE.GRASS;

      if (side1Blocked || side2Blocked) {
        return false; // Can't move diagonally past blocked tiles
      }
    }

    x = nextX;
    y = nextY;
  }

  return true; // Clear line of sight!
}

function old_smoothPath(path) {
    if (!path || path.length === 0) return [];
  
    const newPath = [];
    let currentIndex = 0;
  
    while (currentIndex < path.length - 1) {
      let furthest = path.length - 1;
      let found = false;
  
      // Try to jump as far ahead as possible
      while (furthest > currentIndex + 1) {
        if (hasLineOfSight(path[currentIndex], path[furthest])) {
          found = true;
          break; // Found a tile we can skip to
        }
        furthest--;
      }
  
      if (!found) {
        // No further jump found — move to the next immediate tile
        furthest = currentIndex + 1;
      }
  
      newPath.push(path[furthest]);
  
      // If we can't advance anymore, break to avoid infinite loop
      if (furthest <= currentIndex) break;
  
      currentIndex = furthest;
    }
    
    // Make sure the final goal tile is added if not already
    const lastTile = path[path.length - 1];
    if (!newPath.some(t => t.x === lastTile.x && t.y === lastTile.y)) {
        newPath.push(lastTile);
    }

    return newPath;
}

function smoothPath(path) { // supposedly avoids diagonal illegal moves
    if (!path || path.length === 0) return [];
  
    const newPath = [];
    let currentIndex = 0;
  
    while (currentIndex < path.length - 1) {
      let furthest = path.length - 1;
      let found = false;
  
      while (furthest > currentIndex + 1) {
        const start = path[currentIndex];
        const end = path[furthest];
  
        // --- Defensive corner-cutting check ---
        const dx = end.x - start.x;
        const dy = end.y - start.y;
  
        const movingDiagonally = Math.abs(dx) > 0 && Math.abs(dy) > 0;
  
        let blockedDiagonal = false;
  
        if (movingDiagonally) {
          const side1Blocked = mapData[start.y][end.x] !== TILE.GRASS;
          const side2Blocked = mapData[end.y][start.x] !== TILE.GRASS;
  
          blockedDiagonal = side1Blocked || side2Blocked;
        }
  
        // --- Acceptable jump? ---
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
  
    // Ensure the final goal tile is included
    const lastTile = path[path.length - 1];
    if (!newPath.some(t => t.x === lastTile.x && t.y === lastTile.y)) {
      newPath.push(lastTile);
    }
  
    return newPath;
}