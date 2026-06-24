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
      this.collectionMeta = new Map();
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

    registerCollection(name, options = {}) {
      this.assertCollectionName(name);
      const existing = this.collectionMeta.get(name) || {};
      const meta = Object.freeze({
        name,
        required: !!options.required,
        description: options.description || existing.description || '',
        itemType: options.itemType || existing.itemType || 'unknown'
      });
      this.collectionMeta.set(name, meta);
      if (!this.collections.has(name)) {
        this.collections.set(name, []);
        this.revisions.set(name, this.revisions.get(name) || 0);
      }
      return meta;
    }

    replace(name, value) {
      this.assertCollectionName(name);
      if (!Array.isArray(value)) throw new TypeError(`World collection "${name}" must be an array`);
      if (!this.collectionMeta.has(name)) this.registerCollection(name);
      this.collections.set(name, value);
      this.revisions.set(name, (this.revisions.get(name) || 0) + 1);
      return value;
    }

    get(name) {
      return this.collections.get(name);
    }

    require(name) {
      if (!this.collections.has(name)) throw new Error(`Unknown world collection: ${name}`);
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

    append(name, item) {
      const collection = this.require(name);
      collection.push(item);
      this.touch(name);
      return item;
    }

    remove(name, predicate) {
      if (typeof predicate !== 'function') throw new TypeError('World collection remove requires a predicate');
      const collection = this.require(name);
      const kept = [];
      const removed = [];
      for (const item of collection) {
        if (predicate(item)) {
          removed.push(item);
        } else {
          kept.push(item);
        }
      }
      if (removed.length > 0) this.replace(name, kept);
      return removed;
    }

    snapshot(name) {
      const collection = this.require(name);
      return Object.freeze([...collection]);
    }

    assertCollectionName(name) {
      if (typeof name !== 'string' || !name) throw new TypeError('Collection name must be a non-empty string');
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
      const collections = {};
      for (const [name, value] of this.collectionMeta) {
        collections[name] = Object.freeze({
          ...value,
          revision: this.revision(name),
          size: this.collections.get(name)?.length || 0
        });
      }
      return Object.freeze({
        seed: this.seed,
        generation: this.generation,
        dimensions: this.dimensions(),
        collectionSizes: Object.freeze(collectionSizes),
        collections: Object.freeze(collections)
      });
    }
  }

  app.WorldRuntime = WorldRuntime;
  app.world.runtime = app.world.runtime instanceof WorldRuntime
    ? app.world.runtime
    : new WorldRuntime();
  app.runtime?.registerService('world', app.world.runtime);
  app.diagnostics?.register?.('world', () => app.world.runtime.describe());
})(globalThis);
