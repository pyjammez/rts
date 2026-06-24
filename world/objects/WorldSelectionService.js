(function registerWorldSelectionService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  const channels = new Map();

  function createChannel(name) {
    if (typeof name !== 'string' || !name) throw new TypeError('Selection channel name must be a non-empty string');
    if (channels.has(name)) return channels.get(name);

    let selected = null;
    const channel = Object.freeze({
      name,
      select(object) {
        this.clear();
        if (!object || object.isDead) return null;
        object.selected = true;
        selected = object;
        return selected;
      },
      clear() {
        if (selected) selected.selected = false;
        selected = null;
      },
      clearIfSelected(object) {
        if (selected !== object) return false;
        this.clear();
        return true;
      },
      get() {
        return selected && !selected.isDead ? selected : null;
      },
      isSelected(object) {
        return !!object && selected === object && !object.isDead;
      },
      describe() {
        return {
          name,
          selectedId: selected?.id ?? null,
          selectedType: selected?.objectType || selected?.type || null
        };
      }
    });
    channels.set(name, channel);
    return channel;
  }

  function channel(name) {
    return createChannel(name);
  }

  function describe() {
    return {
      schemaVersion: 1,
      channels: Array.from(channels.values()).map(entry => entry.describe())
    };
  }

  app.world.selection = Object.freeze({
    channel,
    createChannel,
    describe
  });

  app.diagnostics?.register?.('world-selection', describe);
})(globalThis);
