(function registerRendererFactoryRegistry(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  class RendererFactoryRegistry {
    constructor() {
      this.factories = new Map();
    }

    register(id, factory, metadata = {}) {
      if (typeof id !== 'string' || !id) throw new TypeError('Renderer factory id must be a non-empty string');
      if (typeof factory !== 'function') throw new TypeError(`Renderer factory "${id}" must be a function`);
      if (this.factories.has(id)) throw new Error(`Renderer factory already registered: ${id}`);
      const entry = Object.freeze({ id, factory, metadata: { ...metadata } });
      this.factories.set(id, entry);
      return entry;
    }

    has(id) {
      return this.factories.has(id);
    }

    get(id) {
      return this.factories.get(id)?.factory || null;
    }

    create(id, ...args) {
      const factory = this.get(id);
      if (!factory) return null;
      return factory(...args);
    }

    list() {
      return [...this.factories.values()]
        .map(entry => ({ id: entry.id, metadata: { ...entry.metadata } }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    describe() {
      return {
        schemaVersion: 1,
        count: this.factories.size,
        factories: this.list()
      };
    }
  }

  const registry = app.rendering.factoryRegistry instanceof RendererFactoryRegistry
    ? app.rendering.factoryRegistry
    : new RendererFactoryRegistry();

  app.rendering.RendererFactoryRegistry = RendererFactoryRegistry;
  app.rendering.factoryRegistry = registry;
  app.runtime?.registerService?.('renderer-factories', registry);
  app.diagnostics?.register?.('renderer-factories', () => registry.describe());
})(globalThis);
