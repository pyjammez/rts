function unitHasActivePath(unit) {
  return typeof unit.hasActivePath === 'function'
    ? unit.hasActivePath()
    : !!(unit.path && unit.pathIndex < unit.path.length);
}

function isUnitMoving(unit) {
  return !!unit.target || unitHasActivePath(unit);
}

function canAutoEngage(unit) {
  return !unit.hiddenInHouse &&
    !unit.workerJob &&
    !unit.mountTarget &&
    !unit.pendingPickupItem &&
    !unit.pendingDropPoint;
}

function isIdleForAutoEngage(unit) {
  return canAutoEngage(unit) && !isUnitMoving(unit);
}

function autoAcquireRange(unit) {
  return Math.max(
    unit.aggroRange || 0,
    (unit.stopShootRange || unit.shootRange || 0) + tileSize * 2,
    (unit.shootRange || 0) + tileSize * 3,
    170
  );
}

function processUnitCombat(unit, dt) {
  if (unit.isDead) return;

  unit.fireCooldown = Math.max(0, unit.fireCooldown - dt);
  unit.attackRepathCooldown = Math.max(0, unit.attackRepathCooldown - dt);
  unit.attackAnimationTime = Math.max(0, (unit.attackAnimationTime || 0) - dt);

  let isMoving = isUnitMoving(unit);

  if (unit.mountTarget) {
    const sheep = unit.mountTarget;
    if (sheep.isDead || sheep.isMounted || (sheep.reservedByUnitId && sheep.reservedByUnitId !== unit.id)) {
      if (typeof unit.clearMountTarget === 'function') {
        unit.clearMountTarget();
      } else {
        unit.mountTarget = null;
      }
      return;
    }

    const dist = Math.hypot(sheep.x - unit.x, sheep.y - unit.y);
    if (dist <= unit.size * 0.9 + sheep.size * 0.45) {
      unit.clearMovementState();
      unit.mountSheep(sheep);
      return;
    }

    if (!unit.target && unit.attackRepathCooldown <= 0) {
      unit.attackRepathCooldown = 0.35;
      sheep.reservedByUnitId = unit.id;
      unit.setDestination(sheep.x, sheep.y);
    }
    return;
  }

  if (unit.fireStance === 'hold_fire') {
    unit.currentEnemy = null;
    unit.attackOrderTarget = null;
    unit.autoEngageTarget = null;
    return;
  }

  if (unit.attackOrderTarget) {
    if (!unit.isEnemyValid(unit.attackOrderTarget)) {
      unit.attackOrderTarget = null;
      unit.currentEnemy = null;
      unit.autoEngageTarget = null;
    } else {
      unit.currentEnemy = unit.attackOrderTarget;
    }
  }

  if (unit.attackOrderTarget) {
    const dx = unit.attackOrderTarget.x - unit.x;
    const dy = unit.attackOrderTarget.y - unit.y;
    const dist = Math.hypot(dx, dy);

    if (dist > unit.shootRange) {
      if (unit.attackRepathCooldown <= 0) {
        unit.attackRepathCooldown = 0.35;
        unit.setDestination(unit.attackOrderTarget.x, unit.attackOrderTarget.y);
      }
      return;
    }

    unit.path = [];
    unit.pathIndex = 0;
    unit.rawPath = [];
    unit.target = null;

    if (unit.fireCooldown <= 0) {
      unit.shootAt(unit.attackOrderTarget, unit.damage || 8);
    }
    return;
  }

  if (unit.currentEnemy) {
    const currentDist = Math.hypot(unit.currentEnemy.x - unit.x, unit.currentEnemy.y - unit.y);
    if (!unit.isEnemyValid(unit.currentEnemy) || currentDist > autoAcquireRange(unit)) {
      unit.currentEnemy = null;
      unit.autoEngageTarget = null;
    }
  }

  if (!unit.currentEnemy) {
    unit.currentEnemy = unit.findNearestEnemy(autoAcquireRange(unit));
  }

  if (unit.currentEnemy) {
    const currentDist = Math.hypot(unit.currentEnemy.x - unit.x, unit.currentEnemy.y - unit.y);
    if (currentDist > unit.shootRange) {
      if (isIdleForAutoEngage(unit) && unit.attackRepathCooldown <= 0) {
        unit.attackRepathCooldown = 0.35;
        unit.autoEngageTarget = unit.currentEnemy;
        unit.setDestination(unit.currentEnemy.x, unit.currentEnemy.y);
      }
      return;
    }
    if (unit.autoEngageTarget === unit.currentEnemy && typeof unit.clearMovementState === 'function') {
      unit.clearMovementState();
      unit.autoEngageTarget = null;
      isMoving = false;
    }
  }

  if (unit.currentEnemy && unit.fireCooldown <= 0) {
    const shotDamage = isMoving ? (unit.movingDamage || 4) : (unit.damage || 8);
    unit.shootAt(unit.currentEnemy, shotDamage);
  }
}

window.processUnitCombat = processUnitCombat;
