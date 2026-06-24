(function registerUnitCommandIntents(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app?.commands) throw new Error('OpenRTS.commands must be initialized before UnitCommandIntents.js');

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getFormationOffset(index, totalUnits, spacing = 36) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(totalUnits)));
    const rows = Math.ceil(totalUnits / cols);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const originX = (cols - 1) * spacing * 0.5;
    const originY = (rows - 1) * spacing * 0.5;

    return {
      x: col * spacing - originX,
      y: row * spacing - originY
    };
  }

  function enqueue(type, payload, options = {}) {
    return app.commands.enqueue({
      type,
      payload,
      playerId: options.playerId || 'local'
    });
  }

  function enqueueAttackGroup(units, target, targetKind, append = false, options = {}) {
    let issued = 0;
    for (const unit of Array.isArray(units) ? units : []) {
      if (!unit || unit.isDead || !target) continue;
      enqueue(app.commands.types.ATTACK, {
        unitId: unit.id,
        targetId: target.id,
        targetKind,
        append: !!append
      }, options);
      issued++;
    }
    return issued;
  }

  function enqueueMount(unit, sheep, append = false, options = {}) {
    if (!unit || unit.isDead || !sheep) return null;
    return enqueue(app.commands.types.MOUNT, {
      unitId: unit.id,
      sheepId: sheep.id,
      append: !!append
    }, options);
  }

  function enqueueMoveGroupToWorld(units, world, append = false, deps = {}, options = {}) {
    return enqueueMovementGroupToWorld(app.commands.types.MOVE, units, world, append, deps, options);
  }

  function enqueueAttackMoveGroupToWorld(units, world, append = false, deps = {}, options = {}) {
    return enqueueMovementGroupToWorld(app.commands.types.ATTACK_MOVE, units, world, append, deps, options);
  }

  function enqueueMovementGroupToWorld(commandType, units, world, append = false, deps = {}, options = {}) {
    const group = Array.isArray(units) ? units.filter(unit => unit && !unit.isDead) : [];
    if (group.length === 0 || !world) return { issued: 0, marker: null };

    const {
      findNearestWalkablePoint = root.findNearestWalkablePoint,
      getMapWidthPx = root.getMapWidthPx,
      getMapHeightPx = root.getMapHeightPx,
      getCastleContainingPoint = root.getCastleContainingPoint,
      isPointInsideCastle = root.isPointInsideCastle
    } = deps;

    if (
      typeof findNearestWalkablePoint !== 'function' ||
      typeof getMapWidthPx !== 'function' ||
      typeof getMapHeightPx !== 'function'
    ) {
      return { issued: 0, marker: null };
    }

    const firstUnit = group[0];
    const baseDestination = findNearestWalkablePoint(
      world.x,
      world.y,
      firstUnit ? firstUnit.size : 20,
      16,
      firstUnit?.getMovementOptions ? firstUnit.getMovementOptions() : {}
    );
    if (!baseDestination) return { issued: 0, marker: null };

    let issued = 0;
    group.forEach((unit, index) => {
      const offset = getFormationOffset(index, group.length);
      const targetX = clamp(baseDestination.x + offset.x, unit.size * 0.5, getMapWidthPx() - unit.size * 0.5);
      const targetY = clamp(baseDestination.y + offset.y, unit.size * 0.5, getMapHeightPx() - unit.size * 0.5);
      const destination = findNearestWalkablePoint(targetX, targetY, unit.size, 16, unit.getMovementOptions ? unit.getMovementOptions() : {});
      if (!destination) return;

      issued++;
      if (unit.insideHouseId) {
        enqueue(app.commands.types.HOUSE_EXIT, {
          unitId: unit.id,
          x: destination.x,
          y: destination.y,
          append: !!append
        }, options);
        return;
      }

      const occupiedCastle = typeof getCastleContainingPoint === 'function'
        ? getCastleContainingPoint(unit.x, unit.y)
        : null;
      if (
        occupiedCastle &&
        typeof isPointInsideCastle === 'function' &&
        !isPointInsideCastle(occupiedCastle, destination.x, destination.y)
      ) {
        enqueue(app.commands.types.CASTLE_EXIT, {
          unitId: unit.id,
          buildingId: occupiedCastle.id,
          x: destination.x,
          y: destination.y,
          append: !!append,
          laneIndex: index
        }, options);
        return;
      }

      enqueue(commandType, {
        unitId: unit.id,
        x: destination.x,
        y: destination.y,
        append: !!append
      }, options);
    });

    return {
      issued,
      marker: issued > 0
        ? { x: baseDestination.x, y: baseDestination.y, color: commandType === app.commands.types.ATTACK_MOVE ? 'red' : 'green' }
        : null
    };
  }

  app.commandIntents = app.commandIntents || {};
  app.commandIntents.unit = Object.freeze({
    enqueue,
    enqueueAttackGroup,
    enqueueMount,
    enqueueMoveGroupToWorld,
    enqueueAttackMoveGroupToWorld,
    getFormationOffset
  });
})(globalThis);
