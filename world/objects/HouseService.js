(function(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createNeutralHouse(options = {}) {
    const maxHp = Math.max(1, finiteNumber(options.maxHp, 260));
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const house = {
      id: options.id || 'house',
      objectType: 'house',
      displayName: options.displayName || 'Village House',
      description: options.description || 'A neutral house units can hide inside or burn down.',
      team: options.team || 'neutral',
      tileX: finiteNumber(options.tileX, 0),
      tileY: finiteNumber(options.tileY, 0),
      x: finiteNumber(options.x, 0),
      y: finiteNumber(options.y, 0),
      width: Math.max(1, finiteNumber(options.width, 2)),
      height: Math.max(1, finiteNumber(options.height, 2)),
      size: Math.max(1, finiteNumber(options.size, tileSize * 1.65)),
      hp: maxHp,
      maxHp,
      occupants: [],
      burning: false,
      burnTimer: 0,
      burnDuration: Math.max(0.1, finiteNumber(options.burnDuration, 30)),
      selected: false,
      isDead: false,
      isWreck: false,
      takeDamage(amount) {
        if (this.isDead || this.isWreck) return;
        this.hp = Math.max(0, this.hp - Math.max(0, finiteNumber(amount, 0)));
        if (this.hp <= 0 && typeof options.onDestroyed === 'function') {
          options.onDestroyed(this);
        }
      }
    };

    return house;
  }

  app.world.objectFactories.houses = Object.freeze({
    createNeutralHouse,
    describe() {
      return { factories: ['neutralHouse'] };
    }
  });
})(globalThis);
