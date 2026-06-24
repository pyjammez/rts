(function(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createObstacle(options = {}) {
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    const isTree = Boolean(options.isTree);
    const maxHp = Math.max(1, finiteNumber(options.maxHp, isTree ? 120 : 220));
    return {
      id: options.id || 'obstacle',
      objectType: 'obstacle',
      obstacleType: options.obstacleType,
      tileX: finiteNumber(options.tileX, 0),
      tileY: finiteNumber(options.tileY, 0),
      x: finiteNumber(options.x, 0),
      y: finiteNumber(options.y, 0),
      size: Math.max(1, finiteNumber(options.size, tileSize * (isTree ? 1.35 : 1.05))),
      displayName: options.displayName || (isTree ? 'Tree' : 'Stone Outcrop'),
      description: options.description || (isTree
        ? 'A mature natural obstacle providing cover and blocking movement.'
        : 'A dense formation of weathered stone that blocks movement.'),
      material: options.material || (isTree ? 'Wood' : 'Stone'),
      hardness: options.hardness || (isTree ? 'Medium' : 'Very high'),
      team: options.team || 'neutral',
      pickupable: options.pickupable !== false,
      isPickedUp: false,
      hp: maxHp,
      maxHp,
      selected: false,
      isDead: false,
      takeDamage(amount) {
        if (this.isDead) return;
        this.hp = Math.max(0, this.hp - Math.max(0, finiteNumber(amount, 0)));
        if (this.hp <= 0) this.die();
      },
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.selected = false;
        if (typeof options.onDestroyed === 'function') options.onDestroyed(this);
      }
    };
  }

  app.world.objectFactories.obstacles = Object.freeze({
    createObstacle,
    describe() {
      return { factories: ['obstacle'] };
    }
  });
})(globalThis);
