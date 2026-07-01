(function registerBuildingService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  const TYPES = Object.freeze({
    HOME: 'home',
    TOWER: 'tower'
  });

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function fallbackStats(type) {
    return type === TYPES.TOWER
      ? { width: 2, height: 2, hp: 260, size: 70, name: 'Tower' }
      : { width: 3, height: 3, hp: 420, size: 96, name: 'Castle' };
  }

  function createBuilding(options = {}) {
    const type = options.type || TYPES.HOME;
    const stats = options.stats || fallbackStats(type);
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const tileX = Math.floor(finiteNumber(options.tileX, 0));
    const tileY = Math.floor(finiteNumber(options.tileY, 0));
    const width = Math.max(1, Math.floor(finiteNumber(stats.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(stats.height, 1)));
    const hp = Math.max(1, finiteNumber(stats.hp, 100));

    return {
      id: options.id || 'building',
      type,
      team: options.team || 'neutral',
      tileX,
      tileY,
      width,
      height,
      x: (tileX + width * 0.5) * tileSize,
      y: (tileY + height * 0.5) * tileSize,
      hp,
      maxHp: hp,
      size: Math.max(1, finiteNumber(stats.size, Math.max(width, height) * tileSize)),
      displayName: stats.name || type,
      model: stats.model || type,
      definitionType: options.definitionType || stats.id || type,
      factionId: options.factionId || null,
      range: finiteNumber(stats.range, 0),
      damage: finiteNumber(stats.damage, 0),
      attackCooldown: finiteNumber(stats.attackCooldown, 1),
      projectileSpeed: finiteNumber(stats.projectileSpeed, 260),
      projectileColor: stats.projectileColor || null,
      canTargetGround: stats.canTargetGround !== false,
      canTargetAir: !!stats.canTargetAir,
      upgradeLevel: 0,
      maxUpgradeLevel: Math.max(0, finiteNumber(options.maxUpgradeLevel, 3)),
      selected: false,
      isDead: false,
      takeDamage(amount) {
        if (this.isDead) return;
        this.hp = Math.max(0, this.hp - Math.max(0, finiteNumber(amount, 0)));
        if (this.hp <= 0) {
          this.isDead = true;
          this.selected = false;
          if (typeof options.onDestroyed === 'function') options.onDestroyed(this);
        }
      }
    };
  }

  app.world.buildingTypes = TYPES;
  app.world.objectFactories.buildings = Object.freeze({
    createBuilding,
    describe() {
      return { factories: ['building'], types: Object.values(TYPES) };
    }
  });
})(globalThis);
