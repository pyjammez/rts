(function registerHouseInteractionService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function doorPoint(house, tileSize = 32) {
    return house ? { x: house.x, y: house.y + house.height * tileSize * 0.58 } : null;
  }

  function isPointInside(house, worldX, worldY, tileSize = 32) {
    if (!house || house.isWreck) return false;
    const halfW = house.width * tileSize * 0.55;
    const halfH = house.height * tileSize * 0.55;
    return worldX >= house.x - halfW && worldX <= house.x + halfW &&
      worldY >= house.y - halfH && worldY <= house.y + halfH;
  }

  function commandEnter(unit, house, options = {}) {
    if (!unit || unit.isDead || !house || house.isWreck || house.isDead) return false;
    const door = doorPoint(house, options.tileSize);
    if (!door) return false;
    const append = !!options.append;
    if (!append) {
      unit.commandQueue = [];
      unit.clearMovementState?.();
      unit.clearPendingItemAction?.();
      unit.clearMountTarget?.();
      unit.attackOrderTarget = null;
      unit.currentEnemy = null;
    }
    unit.pendingHouseEnter = house;
    unit.pendingHouseExit = null;
    unit.issueMoveCommand(door.x, door.y, { append });
    return true;
  }

  function commandExit(unit, options = {}) {
    if (!unit || !unit.insideHouseId) return false;
    const house = options.getHouseById?.(unit.insideHouseId);
    if (!house) return false;
    const tileSize = options.tileSize || 32;
    const door = doorPoint(house, tileSize);
    const movementOptions = unit.getMovementOptions ? unit.getMovementOptions() : {};
    const target = options.worldX !== null && options.worldX !== undefined && options.worldY !== null && options.worldY !== undefined
      ? options.findNearestWalkablePoint?.(options.worldX, options.worldY, unit.size, 16, movementOptions)
      : options.findNearestWalkablePoint?.(door.x, door.y + tileSize * 1.25, unit.size, 16, movementOptions);
    if (!target) return false;
    unit.hiddenInHouse = false;
    unit.insideHouseId = null;
    unit.x = door.x;
    unit.y = door.y;
    house.occupants = house.occupants.filter(id => String(id) !== String(unit.id));
    unit.pendingHouseEnter = null;
    unit.pendingHouseExit = null;
    const issued = unit.issueMoveCommand(target.x, target.y, { append: !!options.append });
    options.markDirty?.();
    return issued;
  }

  function burnNow(house, options = {}) {
    if (!house || house.isWreck) return false;
    house.burning = false;
    house.isDead = true;
    house.isWreck = true;
    house.hp = 0;
    house.selected = false;
    options.onDeselected?.(house);
    for (const unit of options.units || []) {
      if (String(unit.insideHouseId) === String(house.id)) {
        commandExit(unit, {
          ...options,
          worldX: house.x,
          worldY: house.y + (options.tileSize || 32) * 2,
          append: false
        });
        unit.takeDamage?.(Math.max(20, unit.maxHp * 0.35));
      }
    }
    options.markDirty?.();
    return true;
  }

  function startBurning(house, options = {}) {
    if (!house || house.isWreck || house.isDead) return false;
    house.burning = true;
    house.burnTimer = Math.max(house.burnTimer || 0, house.burnDuration || 30);
    options.markDirty?.();
    return true;
  }

  function updateBurning(dt, options = {}) {
    for (const house of options.houses || []) {
      if (!house.burning || house.isWreck) continue;
      house.burnTimer = Math.max(0, house.burnTimer - dt);
      house.hp = Math.max(0, house.maxHp * (house.burnTimer / house.burnDuration));
      for (const unitId of [...house.occupants]) {
        const unit = (options.units || []).find(candidate => String(candidate.id) === String(unitId));
        if (!unit || unit.isDead || String(unit.insideHouseId) !== String(house.id)) {
          house.occupants = house.occupants.filter(id => String(id) !== String(unitId));
          continue;
        }
        unit.takeDamage?.(dt * 14);
      }
      if (house.burnTimer <= 0 || house.hp <= 0) burnNow(house, options);
    }
  }

  function updateUnitInteractions(options = {}) {
    const tileSize = options.tileSize || 32;
    for (const unit of options.units || []) {
      if (!unit || unit.isDead || !unit.pendingHouseEnter) continue;
      const house = unit.pendingHouseEnter;
      const door = doorPoint(house, tileSize);
      if (!house || house.isWreck || house.isDead) {
        unit.pendingHouseEnter = null;
      } else if (door && Math.hypot(unit.x - door.x, unit.y - door.y) <= Math.max(tileSize * 0.55, unit.size)) {
        unit.clearMovementState?.();
        unit.hiddenInHouse = true;
        unit.insideHouseId = house.id;
        unit.pendingHouseEnter = null;
        unit.attackOrderTarget = null;
        unit.currentEnemy = null;
        unit.selected = false;
        unit.x = house.x;
        unit.y = house.y;
        if (!house.occupants.some(id => String(id) === String(unit.id))) house.occupants.push(unit.id);
        options.markDirty?.();
      }
    }
  }

  app.world.houseInteractions = Object.freeze({
    doorPoint,
    isPointInside,
    commandEnter,
    commandExit,
    burnNow,
    startBurning,
    updateBurning,
    updateUnitInteractions,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['commandEnter', 'commandExit', 'burnNow', 'startBurning', 'updateBurning', 'updateUnitInteractions']
      };
    }
  });

  app.diagnostics?.register?.('house-interactions', () => app.world.houseInteractions.describe());
})(globalThis);
