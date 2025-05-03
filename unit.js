class Unit {
    constructor({ id, x, y, team, hp, speed, sprite = null }) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.team = team;
      this.hp = hp;
      this.maxHp = hp;
      this.speed = speed;
      this.sprite = sprite; // Optional: reference to an image or canvas drawing logic
      this.target = null;
      this.selected = false;
      this.size = 20;
      this.rawPath = [];
      this.path = []; // List of {x: tileX, y: tileY}
    }
  
    moveToward(targetX, targetY, dt) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy); //  Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 10) {
        this.target = null;
        return;
      }

      // when it stops trying to move.
      // if multiple are pushing to reach the same spot they can keep walking forever.
      const dirX = dx / dist;
      const dirY = dy / dist;
      const moveAmount = this.speed * dt;

      const nextX = this.x + dirX * Math.min(moveAmount, dist);
      const nextY = this.y + dirY * Math.min(moveAmount, dist);

      if (canSpawnAt(nextX, nextY)) {
        this.x = nextX;
        this.y = nextY;
      } else {

        const tryX = this.x + dirX * Math.min(moveAmount, dist);
        if (canSpawnAt(tryX, this.y)) {
          this.x = tryX;
        }
    
        const tryY = this.y + dirY * Math.min(moveAmount, dist);
        if (canSpawnAt(this.x, tryY)) {
          this.y = tryY;
        }
      }
    }

    moveAlongPath(dt) {
      if (!this.path || this.path.length === 0) return; // No path or already at target

      const nextTile = this.path[0];
      const targetX = nextTile.x * tileSize + tileSize / 2;
      const targetY = nextTile.y * tileSize + tileSize / 2;
      
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) { // 2 or 10?
        // Arrived at this waypoint, move to next
        console.log("shifting", nextTile);
        this.path.shift();
      } else {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const moveAmount = this.speed * dt;

        // try moving directly
        const nextX = this.x + dirX * moveAmount;
        const nextY = this.y + dirY * moveAmount;
        //this.x += dirX * Math.min(moveAmount, dist);
        //this.y += dirY * Math.min(moveAmount, dist);

        if (canSpawnAt(nextX, nextY, this.size)) {
          this.x = nextX;
          this.y = nextY;
        } else {
          const tryX = this.x + dirX * Math.min(moveAmount, dist);
          if (canSpawnAt(tryX, this.y)) {
            this.x = tryX;
          }
      
          const tryY = this.y + dirY * Math.min(moveAmount, dist);
          if (canSpawnAt(this.x, tryY)) {
            this.y = tryY;
          }
        }
      }
    }
  
    setDestination(targetX, targetY) {
      const startTile = {
        x: Math.floor(this.x / tileSize),
        y: Math.floor(this.y / tileSize)
      };

      const targetTile = {
        x: Math.floor(targetX / tileSize),
        y: Math.floor(targetY / tileSize)
      };

      this.rawPath = findPath(startTile, targetTile); // <<< A* gives you a list of tiles
      this.path = smoothPath(this.rawPath);
    }

    takeDamage(amount) {
      this.hp -= amount;
      if (this.hp <= 0) {
        this.die();
      }
    }
  
    die() {
      console.log(`Unit ${this.id} died.`);
      // Implement removal from game logic here
    }
  
    render(ctx) {
      /* Circle unit
      ctx.fillStyle = this.team;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
      ctx.fill();
      */
     
      ctx.drawImage(tileSprites['guy'], 20, 20, 100, 100, this.x -16, this.y -16, tileSize, tileSize);
    }

    renderPath(ctx) {
      ctx.strokeStyle = 'cyan'; // Line color
      ctx.lineWidth = 2;
      if (!this.path || this.path.length === 0) return;

      ctx.beginPath();
    
      // Start at the unit's current position
      ctx.moveTo(this.x, this.y);
    
      // Draw lines to each tile center in the path
      this.path.forEach(tile => {
        const px = tile.x * tileSize + tileSize / 2;
        const py = tile.y * tileSize + tileSize / 2;
        ctx.lineTo(px, py);
      });
    
      ctx.stroke();
    }

    renderRawPath(ctx) {
      // --- Draw RAW path (unsmoothed) ---
      ctx.strokeStyle = 'red'; // Red = raw zig-zag path
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      this.rawPath.forEach(tile => {
        const px = tile.x * tileSize + tileSize / 2;
        const py = tile.y * tileSize + tileSize / 2;
        ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    renderIllegalMoves(ctx) {
      for (let i = 0; i < this.path.length - 1; i++) {
        const a = this.path[i];
        const b = this.path[i + 1];
    
        const dx = b.x - a.x;
        const dy = b.y - a.y;
    
        const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
    
        if (isDiagonal) {
          const side1Blocked = mapData[a.y][b.x] !== TILE.GRASS;
          const side2Blocked = mapData[b.y][a.x] !== TILE.GRASS;
    
          if (side1Blocked || side2Blocked) {
            // Draw a red line to show illegal diagonal move
            const ax = a.x * tileSize + tileSize / 2;
            const ay = a.y * tileSize + tileSize / 2;
            const bx = b.x * tileSize + tileSize / 2;
            const by = b.y * tileSize + tileSize / 2;
    
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }
    }

    resolveCollisionWith(other) {
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (this.size + other.size) / 2;
    
      if (dist < minDist && dist > 0.01) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
    
        const moveAX = -nx * overlap;
        const moveAY = -ny * overlap;
        const moveBX = nx * overlap;
        const moveBY = ny * overlap;
    
        // --- Check if moving 'this' is valid ---
        const newAX = this.x + moveAX;
        const newAY = this.y + moveAY;
    
        if (canSpawnAt(newAX, newAY, this.size)) {
          this.x = newAX;
          this.y = newAY;
        }
    
        // --- Check if moving 'other' is valid ---
        const newBX = other.x + moveBX;
        const newBY = other.y + moveBY;
    
        if (canSpawnAt(newBX, newBY, other.size)) {
          other.x = newBX;
          other.y = newBY;
        }
      }
    }
}

function renderUnits() {
  units.forEach(unit => {
    unit.render(ctx);
    unit.renderPath(ctx);
    unit.renderRawPath(ctx);
    unit.renderIllegalMoves(ctx);
  });
}