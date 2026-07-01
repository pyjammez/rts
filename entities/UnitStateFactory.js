(function registerUnitStateFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  function createInitialState({ id, x, y, team, hp, speed, size = 20, sprite = null }) {
    return {
      id,
      x,
      y,
      team,
      hp,
      maxHp: hp,
      speed,
      size,
      sprite,
      target: null,
      selected: false,
      shooter: null,
      rawPath: [],
      path: [],
      pathIndex: 0,
      commandQueue: [],
      stuckTime: 0,
      repathCooldown: 0,
      spriteFrame: 0,
      spriteFrameTime: 0,
      spriteFrameDuration: 0.12,
      spriteDirectionRow: 0,
      heading: Math.PI * 0.5,
      isDead: false,
      shootRange: 120,
      stopShootRange: 150,
      fireRate: 1.2,
      fireCooldown: 0,
      fireStance: 'attack_at_will',
      currentEnemy: null,
      attackOrderTarget: null,
      autoEngageTarget: null,
      aggroRange: 190,
      attackRepathCooldown: 0,
      attackAnimationTime: 0,
      attackAnimationDuration: 0.24,
      mountTarget: null,
      mountType: null,
      mountedSpeedBonus: 0,
      baseSpeed: speed,
      inventoryItem: null,
      pendingPickupItem: null,
      pendingDropPoint: null,
      workerJob: null,
      hiddenInHouse: false,
      insideHouseId: null,
      pendingHouseEnter: null,
      pendingHouseExit: null,
      movementType: 'ground',
      airborne: false,
      flightHeight: 0,
      canTargetGround: true,
      canTargetAir: false
    };
  }

  app.entities.unitState = Object.freeze({
    createInitialState
  });
})(globalThis);
