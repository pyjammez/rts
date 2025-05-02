function removeCollisions(units) {
    // Simple collision avoidance
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const a = units[i];
            const b = units[j];
            a.resolveCollisionWith(b);
        }
    }
}

function findPath(start, goal) {
    const open = [];
    const closed = new Set();
  
    function nodeKey(n) {
      return `${n.x},${n.y}`;
    }
  
    function heuristic(a, b) {
      //return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); // Euclidean distance
    }
  
    open.push({
      x: start.x,
      y: start.y,
      g: 0,
      h: heuristic(start, goal),
      parent: null
    });
  
    while (open.length > 0) {
      // Get node with lowest f = g + h
      open.sort((a, b) => (a.g + a.h) - (b.g + b.h));
      const current = open.shift();
      const key = nodeKey(current);
  
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
  
        // Skip invalid tiles
        if (n.y < 0 || n.y >= mapData.length || n.x < 0 || n.x >= mapData[0].length) continue;
        if (mapData[n.y][n.x] !== TILE.GRASS) continue;
        if (closed.has(nKey)) continue;
  
        // Check if already in open list
        const existing = open.find(o => o.x === n.x && o.y === n.y);
        const gScore = current.g + 1;
  
        if (!existing) {
          open.push({
            x: n.x,
            y: n.y,
            g: gScore,
            h: heuristic(n, goal),
            parent: current
          });
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