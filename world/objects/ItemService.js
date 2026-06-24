(function(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createWorldItem(options = {}) {
    const item = options.item || {};
    const maxHp = Math.max(1, finiteNumber(options.maxHp, 12));
    return {
      id: options.id || 'item',
      itemId: item.id || options.itemId || 'field_kit',
      x: finiteNumber(options.x, 0),
      y: finiteNumber(options.y, 0),
      team: options.team || 'neutral',
      objectType: 'item',
      displayName: item.name || options.displayName || 'Field Kit',
      description: item.description || options.description || 'A compact battlefield supply kit.',
      hp: maxHp,
      maxHp,
      size: Math.max(1, finiteNumber(options.size, 20)),
      pickupable: options.pickupable !== false,
      isPickedUp: false,
      isDead: false,
      selected: false,
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

  app.world.objectFactories.items = Object.freeze({
    createWorldItem,
    describe() {
      return { factories: ['worldItem'] };
    }
  });
})(globalThis);
