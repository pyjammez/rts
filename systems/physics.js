let unitSpatialHash = new Map();
let unitSpatialCellSize = 64;

function getSpatialKey(cx, cy) {
  return `${cx},${cy}`;
}

function buildUnitSpatialHash(units, cellSize = 64) {
  unitSpatialCellSize = cellSize;
  const hash = new Map();

  for (const unit of units) {
    if (!unit || unit.isDead) continue;
    const cx = Math.floor(unit.x / cellSize);
    const cy = Math.floor(unit.y / cellSize);
    const key = getSpatialKey(cx, cy);
    let bucket = hash.get(key);
    if (!bucket) {
      bucket = [];
      hash.set(key, bucket);
    }
    bucket.push(unit);
  }

  unitSpatialHash = hash;
  return hash;
}

function getUnitsNearPoint(x, y, radius = 32) {
  if (!unitSpatialHash || unitSpatialHash.size === 0) return units;

  const cellSize = unitSpatialCellSize;
  const minCx = Math.floor((x - radius) / cellSize);
  const maxCx = Math.floor((x + radius) / cellSize);
  const minCy = Math.floor((y - radius) / cellSize);
  const maxCy = Math.floor((y + radius) / cellSize);

  const nearby = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const bucket = unitSpatialHash.get(getSpatialKey(cx, cy));
      if (!bucket) continue;
      nearby.push(...bucket);
    }
  }

  return nearby;
}

function removeCollisions(units, { rebuildSpatialHash = true } = {}) {
  // Broad phase using a spatial hash to avoid O(n^2) pair checks.
  if (rebuildSpatialHash) {
    buildUnitSpatialHash(units, 64);
  }
  const checkedPairs = new Set();

  for (const [key, bucket] of unitSpatialHash.entries()) {
    const [cxStr, cyStr] = key.split(',');
    const cx = Number(cxStr);
    const cy = Number(cyStr);

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const otherKey = getSpatialKey(cx + ox, cy + oy);
        const otherBucket = unitSpatialHash.get(otherKey);
        if (!otherBucket) continue;

        for (const a of bucket) {
          for (const b of otherBucket) {
            if (a === b) continue;
            const low = a.id < b.id ? a.id : b.id;
            const high = a.id < b.id ? b.id : a.id;
            const pairKey = `${low}:${high}`;
            if (checkedPairs.has(pairKey)) continue;
            checkedPairs.add(pairKey);
            a.resolveCollisionWith(b);
          }
        }
      }
    }
  }
}

function findPath(start, goal) {
    if (!isWalkableTile(start.x, start.y) || !isWalkableTile(goal.x, goal.y)) {
      return [];
    }

    const open = [];
  const openMap = new Map();
    const closed = new Set();
  
    function nodeKey(n) {
      return `${n.x},${n.y}`;
    }
  
    function heuristic(a, b) {
      //return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); // Euclidean distance
    }
  
    const startNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: heuristic(start, goal),
      parent: null
    };

    open.push(startNode);
    openMap.set(nodeKey(startNode), startNode);
  
    while (open.length > 0) {
      // Get node with lowest f = g + h
      let bestIndex = 0;
      let bestNode = open[0];
      for (let i = 1; i < open.length; i++) {
        const candidate = open[i];
        if ((candidate.g + candidate.h) < (bestNode.g + bestNode.h)) {
          bestNode = candidate;
          bestIndex = i;
        }
      }

      const current = open[bestIndex];
      open.splice(bestIndex, 1);
      const key = nodeKey(current);
      openMap.delete(key);
  
      if (current.x === goal.x && current.y === goal.y) {
        // Reached goal → reconstruct path
        const path = [];
        let n = current;
        while (n) {
          path.unshift({ x: n.x, y: n.y });
          n = n.parent;
        }
        return path;
      }
  
      closed.add(key);
  
      // Explore neighbors
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
        /* Add diagonal neighbors
        { x: current.x + 1, y: current.y + 1 },
        { x: current.x - 1, y: current.y - 1 },
        { x: current.x + 1, y: current.y - 1 },
        { x: current.x - 1, y: current.y + 1 }*/
      ];
  
      for (const n of neighbors) {
        const nKey = nodeKey(n);

        // Skip invalid or blocked tiles.
        if (!isWalkableTile(n.x, n.y)) continue;
        if (closed.has(nKey)) continue;

        // Check if already in open list
        const existing = openMap.get(nKey);
        const gScore = current.g + getMovementCost(n.x, n.y);

        if (!existing) {
          const newNode = {
            x: n.x,
            y: n.y,
            g: gScore,
            h: heuristic(n, goal),
            parent: current
          };
          open.push(newNode);
          openMap.set(nKey, newNode);
        } else if (gScore < existing.g) {
          // Better path
          existing.g = gScore;
          existing.parent = current;
        }
      }
    }
  
    // No path found
    return [];
  }