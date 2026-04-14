const COMMAND_TYPE = Object.freeze({
  MOVE: 'move',
  ATTACK_UNIT: 'attack-unit'
});
const MAX_COMMAND_QUEUE = 16;

class Unit {
    constructor({ id, x, y, team, hp, speed, size = 20, sprite = null }) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.team = team;
      this.hp = hp;
      this.maxHp = hp;
      this.speed = speed;
      this.size = size;
      this.sprite = sprite; // Optional: reference to an image or canvas drawing logic
      this.target = null;
      this.selected = false;
      this.shooter = null;
      this.rawPath = [];
      this.path = []; // List of {x: tileX, y: tileY}
      this.pathIndex = 0;
      this.commandQueue = [];
      this.stuckTime = 0;
      this.repathCooldown = 0;
      this.spriteFrame = 0;
      this.spriteFrameTime = 0;
      this.spriteFrameDuration = 0.12;
      this.spriteDirectionRow = 0; // 0=down, 1=left, 2=right, 3=up
        // Combat state
        this.isDead = false;
        this.shootRange = 120;      // px — starts shooting within this distance
        this.stopShootRange = 150;  // px — stops shooting beyond this distance
        this.fireRate = 1.2;        // shots per second
        this.fireCooldown = 0;
        this.currentEnemy = null;
        this.attackOrderTarget = null; // Explicit attack-move target unit (locked until dead)
        this.attackRepathCooldown = 0;
    }

    setFacingFromVector(dx, dy) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.spriteDirectionRow = dx >= 0 ? 2 : 1;
      } else {
        this.spriteDirectionRow = dy >= 0 ? 0 : 3;
      }
    }

    updateWalkAnimation(dt, isMoving) {
      if (!isMoving) {
        this.spriteFrame = 0;
        this.spriteFrameTime = 0;
        return;
      }

      this.spriteFrameTime += dt;
      if (this.spriteFrameTime >= this.spriteFrameDuration) {
        this.spriteFrameTime -= this.spriteFrameDuration;
        this.spriteFrame = (this.spriteFrame + 1) % 4;
      }
    }

    hasActivePath() {
      return Array.isArray(this.path) && this.pathIndex < this.path.length;
    }

    clearMovementState() {
      this.path = [];
      this.pathIndex = 0;
      this.rawPath = [];
      this.target = null;
      this.stuckTime = 0;
      this.repathCooldown = 0;
    }

    isValidDestination(x, y) {
      return Number.isFinite(x) && Number.isFinite(y);
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

    setDestination(targetX, targetY) {
      if (!this.isValidDestination(targetX, targetY)) return;

      const startTile = {
        x: Math.floor(this.x / tileSize),
        y: Math.floor(this.y / tileSize)
      };

      const targetTile = {
        x: Math.floor(targetX / tileSize),
        y: Math.floor(targetY / tileSize)
      };

      this.target = { x: targetX, y: targetY };
      this.rawPath = findPath(startTile, targetTile); // <<< A* gives you a list of tiles
      this.path = smoothPath(this.rawPath);
      this.pathIndex = 0;
      this.stuckTime = 0;

      if (this.path.length === 0) {
        this.target = null;
      }
    }

    issueMoveCommand(targetX, targetY, { append = false } = {}) {
      if (!this.isValidDestination(targetX, targetY)) return;
      const command = { type: COMMAND_TYPE.MOVE, x: targetX, y: targetY };

      if (!append) {
        this.commandQueue = [];
        this.clearMovementState();
        this.attackOrderTarget = null;
        this.currentEnemy = null;
        this.executeCommand(command);
        return;
      }

      const hasActiveMove = !!this.target || this.hasActivePath();
      if (!hasActiveMove) {
        this.executeCommand(command);
      } else {
        if (this.commandQueue.length < MAX_COMMAND_QUEUE) {
          this.commandQueue.push(command);
        }
      }
    }

    issueAttackCommand(targetUnit, { append = false } = {}) {
      if (!targetUnit || targetUnit.isDead || targetUnit.team === this.team) return;

      const command = { type: COMMAND_TYPE.ATTACK_UNIT, targetUnit };

      if (!append) {
        this.commandQueue = [];
        this.clearMovementState();
        this.executeCommand(command);
        return;
      }

      const hasActiveMove = !!this.target || this.hasActivePath();
      if (!hasActiveMove) {
        this.executeCommand(command);
      } else {
        if (this.commandQueue.length < MAX_COMMAND_QUEUE) {
          this.commandQueue.push(command);
        }
      }
    }

    executeCommand(command) {
      if (command.type === COMMAND_TYPE.MOVE) {
        this.setDestination(command.x, command.y);
        return;
      }

      if (command.type === COMMAND_TYPE.ATTACK_UNIT) {
        this.attackOrderTarget = command.targetUnit;
        this.currentEnemy = command.targetUnit;
        this.attackRepathCooldown = 0;
      }
    }

    startNextCommand() {
      if (this.commandQueue.length === 0) return;
      const nextCommand = this.commandQueue.shift();
      this.executeCommand(nextCommand);
    }

    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp <= 0) this.die();
    }

    isEnemyValid(enemy) {
      return !!enemy && !enemy.isDead && enemy.team !== this.team;
    }

    findNearestEnemy() {
      const searchRadius = this.stopShootRange + tileSize;
      const candidates = typeof getUnitsNearPoint === 'function'
        ? getUnitsNearPoint(this.x, this.y, searchRadius)
        : units;

      let closest = null;
      let closestDist = this.shootRange;
      for (const other of candidates) {
        if (!this.isEnemyValid(other)) continue;
        const dist = Math.hypot(other.x - this.x, other.y - this.y);
        if (dist < closestDist) {
          closestDist = dist;
          closest = other;
        }
      }
      return closest;
    }

    shootAt(target, damage) {
      if (!target) return;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      this.setFacingFromVector(dx, dy);
      bullets.push(Bullet.obtain(this.x, this.y, target, this.team, damage, this));
      this.fireCooldown = 1 / this.fireRate;
    }

    die() {
      this.isDead = true;
      this.path = [];
      this.pathIndex = 0;
      this.commandQueue = [];
      this.target = null;
      this.currentEnemy = null;
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
          const side1Blocked = !isWalkableTile(b.x, a.y);
          const side2Blocked = !isWalkableTile(a.x, b.y);
    
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

// --- Bullets ---
window.bullets = window.bullets || [];
const bullets = window.bullets;


class Bullet {
  constructor(x, y, target, team, damage = 8, shooter = null) {
    this.reset(x, y, target, team, damage, shooter);
  }

  reset(x, y, target, team, damage = 8, shooter = null) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.team = team;
    this.damage = damage;
    this.dead = false;
    this.radius = 6; // larger for visibility
    this.maxRange = 1200; // px (increased for visibility)
    this.distanceTraveled = 0;
    // Fixed direction toward target's position at fire time
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    this.speed = 200; // slower for visibility
    this.shooter = shooter;
    // Store the intended target for possible special effects, but do not home in
    this.intendedTarget = target;
  }

  static obtain(x, y, target, team, damage = 8, shooter = null) {
    const pooled = Bullet.pool.pop();
    if (pooled) {
      pooled.reset(x, y, target, team, damage, shooter);
      return pooled;
    }
    return new Bullet(x, y, target, team, damage, shooter);
  }

  static release(bullet) {
    if (!bullet) return;
    Bullet.pool.push(bullet);
  }

  update(dt) {
    if (this.dead) return;

    const moveDist = this.speed * dt;
    this.x += this.dirX * moveDist;
    this.y += this.dirY * moveDist;
    this.distanceTraveled += moveDist;

    const candidates = typeof getUnitsNearPoint === 'function'
      ? getUnitsNearPoint(this.x, this.y, this.radius + tileSize)
      : units;

    for (const unit of candidates) {
      if (unit.isDead) continue;
      // Never collide with shooter or same-team units.
      if (unit === this.shooter) continue;
      if (unit.team === this.team) continue;

      const dx = unit.x - this.x;
      const dy = unit.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < unit.size * 0.5 + this.radius) {
        unit.takeDamage(this.damage);
        this.dead = true;
        return;
      }
    }

    // Remove bullet if out of range or off screen
    // Use global canvas if available, else fallback to large default
    const cW = typeof getMapWidthPx === 'function' ? getMapWidthPx() : 1920;
    const cH = typeof getMapHeightPx === 'function' ? getMapHeightPx() : 1080;
    if (this.distanceTraveled > this.maxRange ||
        this.x < 0 || this.x > cW ||
        this.y < 0 || this.y > cH) {
      this.dead = true;
    }
  }

  render(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.team === 'red' ? '#ff6600' : '#00ccff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.restore();
  }
}
Bullet.pool = [];

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update(dt);
    if (!b.dead) continue;
    bullets.splice(i, 1);
    Bullet.release(b);
  }
}

function renderBullets(ctx) {
  for (const b of bullets) b.render(ctx);
}

function renderUnits(debug = {}) {
  units.forEach(unit => {
    processUnitRender(unit, ctx);

    if (debug.showPaths) {
      unit.renderPath(ctx);
    }

    if (debug.showRawPaths) {
      unit.renderRawPath(ctx);
    }

    if (debug.showIllegalMoves) {
      unit.renderIllegalMoves(ctx);
    }
  });
}