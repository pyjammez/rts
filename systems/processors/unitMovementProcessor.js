function processUnitMovement(unit, dt) {
  if (unit.isDead) {
    unit.path = [];
    unit.rawPath = [];
    unit.pathIndex = 0;
    unit.target = null;
    unit.updateWalkAnimation(dt, false);
    return;
  }

  if (unit.repathCooldown > 0) {
    unit.repathCooldown = Math.max(0, unit.repathCooldown - dt);
  }

  if (!unit.path || unit.pathIndex >= unit.path.length) {
    unit.stuckTime = 0;
    unit.updateWalkAnimation(dt, false);
    if (unit.target) {
      unit.target = null;
      unit.pathIndex = 0;
      unit.startNextCommand();
    }
    return;
  }

  const nextTile = unit.path[unit.pathIndex];
  const targetX = nextTile.x * tileSize + tileSize / 2;
  const targetY = nextTile.y * tileSize + tileSize / 2;

  const dx = targetX - unit.x;
  const dy = targetY - unit.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const oldX = unit.x;
  const oldY = unit.y;
  const waypointArrivalRadius = 4;

  if (dist < waypointArrivalRadius) {
    unit.pathIndex++;
    unit.stuckTime = 0;
    unit.updateWalkAnimation(dt, false);

    if (unit.pathIndex >= unit.path.length) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.target = null;
      unit.startNextCommand();
    }
    return;
  }

  const dirX = dx / dist;
  const dirY = dy / dist;
  const moveAmount = unit.speed * dt;
  let moved = false;

  unit.setFacingFromVector(dirX, dirY);

  const nextX = unit.x + dirX * moveAmount;
  const nextY = unit.y + dirY * moveAmount;

  if (canSpawnAt(nextX, nextY, unit.size)) {
    unit.x = nextX;
    unit.y = nextY;
    moved = true;
  } else {
    const tryX = unit.x + dirX * Math.min(moveAmount, dist);
    if (canSpawnAt(tryX, unit.y)) {
      unit.x = tryX;
      moved = true;
    }

    const tryY = unit.y + dirY * Math.min(moveAmount, dist);
    if (canSpawnAt(unit.x, tryY)) {
      unit.y = tryY;
      moved = true;
    }

    if (!moved) {
      const nudge = moveAmount * 0.75;
      const perpX = -dirY;
      const perpY = dirX;

      const sideAX = unit.x + perpX * nudge;
      const sideAY = unit.y + perpY * nudge;
      if (canSpawnAt(sideAX, sideAY, unit.size)) {
        unit.x = sideAX;
        unit.y = sideAY;
        moved = true;
      } else {
        const sideBX = unit.x - perpX * nudge;
        const sideBY = unit.y - perpY * nudge;
        if (canSpawnAt(sideBX, sideBY, unit.size)) {
          unit.x = sideBX;
          unit.y = sideBY;
          moved = true;
        }
      }
    }
  }

  const movedDistance = Math.hypot(unit.x - oldX, unit.y - oldY);
  unit.updateWalkAnimation(dt, movedDistance >= 0.2);

  if (movedDistance < 0.2 && dist >= waypointArrivalRadius) {
    unit.stuckTime += dt;
  } else {
    unit.stuckTime = 0;
  }

  if (unit.stuckTime > 0.35 && unit.target && unit.repathCooldown === 0) {
    unit.repathCooldown = 0.25;
    unit.stuckTime = 0;
    unit.setDestination(unit.target.x, unit.target.y);
  }
}

window.processUnitMovement = processUnitMovement;

