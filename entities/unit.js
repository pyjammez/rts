const COMMAND_TYPE = Object.freeze({
  MOVE: 'move',
  ATTACK_UNIT: 'attack-unit',
  MOUNT_SHEEP: 'mount-sheep',
  PICK_UP_ITEM: 'pick-up-item',
  DROP_ITEM: 'drop-item'
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
      this.heading = Math.PI * 0.5;
        // Combat state
        this.isDead = false;
        this.shootRange = 120;      // px — starts shooting within this distance
        this.stopShootRange = 150;  // px — stops shooting beyond this distance
        this.fireRate = 1.2;        // shots per second
        this.fireCooldown = 0;
        this.fireStance = 'attack_at_will';
        this.currentEnemy = null;
        this.attackOrderTarget = null; // Explicit attack-move target unit (locked until dead)
        this.attackRepathCooldown = 0;
        this.attackAnimationTime = 0;
        this.attackAnimationDuration = 0.24;
        this.castleTopBuildingId = null;
        this.castleTopStairPoint = null;
        this.castleTopReached = false;
        this.castleRampBase = null;
        this.castleRampTop = null;
        this.castleRampClimbed = false;
        this.mountTarget = null;
        this.mountType = null;
        this.mountedSpeedBonus = 0;
        this.baseSpeed = speed;
        this.inventoryItem = null;
        this.pendingPickupItem = null;
        this.pendingDropPoint = null;
    }

    setFacingFromVector(dx, dy) {
      if (Math.hypot(dx, dy) > 0.001) this.heading = Math.atan2(dy, dx);
      if (Math.abs(dx) > Math.abs(dy)) {
        this.spriteDirectionRow = dx >= 0 ? 2 : 1;
      } else {
        this.spriteDirectionRow = dy >= 0 ? 0 : 3;
      }
    }

    setFireStance(stance) {
      this.fireStance = stance === 'hold_fire' ? 'hold_fire' : 'attack_at_will';
      if (this.fireStance === 'hold_fire') {
        this.currentEnemy = null;
        this.attackOrderTarget = null;
      }
    }

    pickUpItem(item) {
      if (!item || !item.pickupable || item.isPickedUp || this.inventoryItem) return false;
      this.inventoryItem = {
        id: item.itemId || item.obstacleType || 'item',
        name: item.displayName || 'Item',
        description: item.description || '',
        carryType: item.objectType === 'obstacle' ? 'obstacle' : 'item',
        obstacleType: item.obstacleType || null
      };
      if (typeof removeCarryableWorldObject !== 'function' || !removeCarryableWorldObject(item)) {
        this.inventoryItem = null;
        return false;
      }
      return true;
    }

    dropItem() {
      if (!this.inventoryItem || typeof dropCarriedItem !== 'function') return false;
      const distance = this.size + 14;
      const dropX = this.x + Math.cos(this.heading || 0) * distance;
      const dropY = this.y + Math.sin(this.heading || 0) * distance;
      return this.dropItemAt(dropX, dropY);
    }

    dropItemAt(dropX, dropY) {
      if (!this.inventoryItem || typeof dropCarriedItem !== 'function') return false;
      const item = this.inventoryItem;
      if (!dropCarriedItem(item, dropX, dropY)) return false;
      this.inventoryItem = null;
      return true;
    }

    clearPendingItemAction() {
      this.pendingPickupItem = null;
      this.pendingDropPoint = null;
    }

    issuePickupCommand(item) {
      if (!item || item.isDead || item.isPickedUp || !item.pickupable || this.inventoryItem) return false;
      this.commandQueue = [];
      this.clearMovementState();
      this.clearMountTarget();
      this.attackOrderTarget = null;
      this.currentEnemy = null;
      this.executeCommand({ type: COMMAND_TYPE.PICK_UP_ITEM, item });
      return true;
    }

    issueDropItemCommand(worldX, worldY) {
      if (!this.inventoryItem || !this.isValidDestination(worldX, worldY)) return false;
      const destination = findNearestWalkablePoint(worldX, worldY, this.size);
      if (!destination) return false;
      this.commandQueue = [];
      this.clearMovementState();
      this.clearMountTarget();
      this.attackOrderTarget = null;
      this.currentEnemy = null;
      this.executeCommand({ type: COMMAND_TYPE.DROP_ITEM, x: destination.x, y: destination.y });
      return true;
    }

    processPendingItemAction() {
      const item = this.pendingPickupItem;
      if (item) {
        if (item.isDead || item.isPickedUp || !item.pickupable || this.inventoryItem) {
          this.pendingPickupItem = null;
          return false;
        }
        const pickupRange = this.size * 0.5 + (item.size || 20) * 0.55 + 8;
        if (Math.hypot(item.x - this.x, item.y - this.y) <= pickupRange) {
          this.pendingPickupItem = null;
          this.clearMovementState();
          return this.pickUpItem(item);
        }
        if (!this.target && !this.hasActivePath()) this.setDestination(item.x, item.y);
      }

      const dropPoint = this.pendingDropPoint;
      if (dropPoint && this.inventoryItem) {
        const dropRange = Math.max(tileSize * 0.8, this.size);
        if (Math.hypot(dropPoint.x - this.x, dropPoint.y - this.y) <= dropRange) {
          this.pendingDropPoint = null;
          this.clearMovementState();
          return this.dropItemAt(dropPoint.x, dropPoint.y);
        }
        if (!this.target && !this.hasActivePath()) this.setDestination(dropPoint.x, dropPoint.y);
      } else if (dropPoint) {
        this.pendingDropPoint = null;
      }
      return false;
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

    clearMountTarget() {
      if (this.mountTarget && this.mountTarget.reservedByUnitId === this.id) {
        this.mountTarget.reservedByUnitId = null;
      }
      this.mountTarget = null;
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
      const destination = findNearestWalkablePoint(targetX, targetY, this.size);
      if (!destination) return;
      targetX = destination.x;
      targetY = destination.y;

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
      const destination = findNearestWalkablePoint(targetX, targetY, this.size);
      if (!destination) return;
      const command = { type: COMMAND_TYPE.MOVE, x: destination.x, y: destination.y };

      if (!append) {
        this.commandQueue = [];
        this.clearMovementState();
        this.clearPendingItemAction();
        this.attackOrderTarget = null;
        this.currentEnemy = null;
        this.castleTopBuildingId = null;
        this.castleTopStairPoint = null;
        this.castleTopReached = false;
        this.castleRampBase = null;
        this.castleRampTop = null;
        this.castleRampClimbed = false;
        this.clearMountTarget();
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
        this.clearPendingItemAction();
        this.castleTopBuildingId = null;
        this.castleTopStairPoint = null;
        this.castleTopReached = false;
        this.castleRampBase = null;
        this.castleRampTop = null;
        this.castleRampClimbed = false;
        this.clearMountTarget();
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

    issueMountCommand(sheep, { append = false } = {}) {
      if (!sheep || sheep.isDead || sheep.isMounted || sheep.reservedByUnitId) return;

      const command = { type: COMMAND_TYPE.MOUNT_SHEEP, sheep };

      if (!append) {
        this.commandQueue = [];
        this.clearMovementState();
        this.clearPendingItemAction();
        this.attackOrderTarget = null;
        this.currentEnemy = null;
        this.castleTopBuildingId = null;
        this.castleTopStairPoint = null;
        this.castleTopReached = false;
        this.castleRampBase = null;
        this.castleRampTop = null;
        this.castleRampClimbed = false;
        this.executeCommand(command);
        return;
      }

      const hasActiveMove = !!this.target || this.hasActivePath();
      if (!hasActiveMove) {
        this.executeCommand(command);
      } else if (this.commandQueue.length < MAX_COMMAND_QUEUE) {
        this.commandQueue.push(command);
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

      if (command.type === COMMAND_TYPE.MOUNT_SHEEP) {
        this.mountTarget = command.sheep;
        this.attackOrderTarget = null;
        this.currentEnemy = null;
        command.sheep.reservedByUnitId = this.id;
        this.setDestination(command.sheep.x, command.sheep.y);
      }

      if (command.type === COMMAND_TYPE.PICK_UP_ITEM) {
        this.pendingDropPoint = null;
        this.pendingPickupItem = command.item;
        this.setDestination(command.item.x, command.item.y);
      }

      if (command.type === COMMAND_TYPE.DROP_ITEM) {
        this.pendingPickupItem = null;
        this.pendingDropPoint = { x: command.x, y: command.y };
        this.setDestination(command.x, command.y);
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
      this.attackAnimationTime = this.attackAnimationDuration;
      if (this.melee) {
        target.takeDamage(damage);
        this.fireCooldown = 1 / this.fireRate;
        return;
      }
      OpenRTS.systems.projectiles.spawn({
        x: this.x,
        y: this.y,
        target,
        team: this.team,
        damage,
        shooter: this,
        speed: this.projectileSpeed,
        color: this.projectileColor,
        projectileType: this.projectileType,
        splashRadius: this.splashRadius
      });
      this.fireCooldown = 1 / this.fireRate;
    }

    mountSheep(sheep) {
      if (!sheep || sheep.isDead || sheep.isMounted) return false;
      if (this.unitType === 'scout' && this.mountType !== 'sheep' && typeof createWanderingHorse === 'function') {
        const facing = this.spriteDirectionRow === 1 ? -1 : 1;
        createWanderingHorse(this.x, this.y, facing);
      }
      sheep.isMounted = true;
      sheep.reservedByUnitId = null;
      sheep.riderUnitId = this.id;
      if (typeof removeSheepFromMap === 'function') {
        removeSheepFromMap(sheep);
      }
      this.mountTarget = null;
      this.mountType = 'sheep';
      this.mountedSpeedBonus = 42;
      this.baseSpeed = this.baseSpeed || this.speed;
      this.speed = this.baseSpeed + this.mountedSpeedBonus;
      this.role = this.role && !this.role.includes('mounted')
        ? `${this.role}, mounted`
        : this.role || 'Mounted unit';
      return true;
    }

    die() {
      this.isDead = true;
      this.selected = false;
      const deathNoise = typeof hashNoise === 'function'
        ? hashNoise(this.id + 31, Math.floor(this.y))
        : OpenRTS.random.stream('effects').next();
      const deathNoiseB = typeof hashNoise === 'function'
        ? hashNoise(this.id + 17, Math.floor(this.x))
        : OpenRTS.random.stream('effects').next();
      this.deathRotation = Math.atan2(
        deathNoise - 0.5,
        deathNoiseB - 0.5
      );
      this.path = [];
      this.pathIndex = 0;
      this.commandQueue = [];
      this.target = null;
      this.currentEnemy = null;
      this.clearPendingItemAction();
      this.clearMountTarget();
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
