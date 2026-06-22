(function registerWorldRuntime(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before WorldRuntime.js');

  class WorldRuntime {
    constructor() {
      this.tileSize = 0;
      this.rows = 0;
      this.columns = 0;
      this.seed = 0;
      this.generation = 0;
      this.collections = new Map();
      this.revisions = new Map();
    }

    configure({ tileSize, rows, columns }) {
      this.tileSize = tileSize;
      this.rows = rows;
      this.columns = columns;
      return this;
    }

    beginGeneration(seed) {
      this.seed = seed >>> 0;
      this.generation += 1;
      return this.generation;
    }

    replace(name, value) {
      if (typeof name !== 'string' || !name) throw new TypeError('Collection name must be a non-empty string');
      if (!Array.isArray(value)) throw new TypeError(`World collection "${name}" must be an array`);
      this.collections.set(name, value);
      this.revisions.set(name, (this.revisions.get(name) || 0) + 1);
      return value;
    }

    get(name) {
      return this.collections.get(name);
    }

    revision(name) {
      return this.revisions.get(name) || 0;
    }

    touch(name) {
      if (!this.collections.has(name)) throw new Error(`Unknown world collection: ${name}`);
      const revision = (this.revisions.get(name) || 0) + 1;
      this.revisions.set(name, revision);
      return revision;
    }

    dimensions() {
      return Object.freeze({
        tileSize: this.tileSize,
        rows: this.rows,
        columns: this.columns,
        width: this.columns * this.tileSize,
        height: this.rows * this.tileSize
      });
    }

    describe() {
      const collectionSizes = {};
      for (const [name, value] of this.collections) collectionSizes[name] = value.length;
      return Object.freeze({
        seed: this.seed,
        generation: this.generation,
        dimensions: this.dimensions(),
        collections: Object.freeze(collectionSizes)
      });
    }
  }

  app.WorldRuntime = WorldRuntime;
  app.world.runtime = app.world.runtime instanceof WorldRuntime
    ? app.world.runtime
    : new WorldRuntime();
  app.runtime?.registerService('world', app.world.runtime);
})(globalThis);
