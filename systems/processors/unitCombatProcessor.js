function processUnitCombat(unit, dt) {
  if (unit.isDead) return;

  unit.fireCooldown = Math.max(0, unit.fireCooldown - dt);
  unit.attackRepathCooldown = Math.max(0, unit.attackRepathCooldown - dt);

  const isMoving = !!unit.target || (unit.path && unit.pathIndex < unit.path.length);

  if (unit.attackOrderTarget) {
    if (!unit.isEnemyValid(unit.attackOrderTarget)) {
      unit.attackOrderTarget = null;
      unit.currentEnemy = null;
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
      unit.shootAt(unit.attackOrderTarget, 8);
    }
    return;
  }

  if (unit.currentEnemy) {
    const currentDist = Math.hypot(unit.currentEnemy.x - unit.x, unit.currentEnemy.y - unit.y);
    if (!unit.isEnemyValid(unit.currentEnemy) || currentDist > unit.stopShootRange) {
      unit.currentEnemy = null;
    }
  }

  if (!unit.currentEnemy) {
    unit.currentEnemy = unit.findNearestEnemy();
  }

  if (unit.currentEnemy && unit.fireCooldown <= 0) {
    const shotDamage = isMoving ? 4 : 8;
    unit.shootAt(unit.currentEnemy, shotDamage);
  }
}

window.processUnitCombat = processUnitCombat;

