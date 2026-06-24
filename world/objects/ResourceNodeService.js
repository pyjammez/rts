(function(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createGoldMine(options = {}) {
    const amount = Math.max(1, Math.floor(finiteNumber(options.amount, 800)));
    const tileSize = Math.max(1, finiteNumber(options.tileSize, 32));
    return {
      id: options.id || 'goldmine',
      objectType: 'resource',
      resourceType: 'gold',
      displayName: options.displayName || 'Gold Mine',
      description: options.description || 'A neutral gold deposit that workers can mine.',
      team: options.team || 'neutral',
      tileX: finiteNumber(options.tileX, 0),
      tileY: finiteNumber(options.tileY, 0),
      x: finiteNumber(options.x, 0),
      y: finiteNumber(options.y, 0),
      size: Math.max(1, finiteNumber(options.size, tileSize * 2.7)),
      amount,
      maxAmount: amount,
      hp: amount,
      maxHp: amount,
      selected: false,
      isDead: false,
      takeDamage(amountToRemove) {
        if (this.isDead) return;
        const removed = Math.max(0, Math.min(this.amount, finiteNumber(amountToRemove, 0)));
        this.amount -= removed;
        this.hp = this.amount;
        if (this.amount <= 0) {
          this.isDead = true;
          this.selected = false;
        }
        if (typeof options.onChanged === 'function') options.onChanged(this);
      }
    };
  }

  app.world.objectFactories.resources = Object.freeze({
    createGoldMine,
    describe() {
      return { factories: ['goldMine'] };
    }
  });
})(globalThis);
