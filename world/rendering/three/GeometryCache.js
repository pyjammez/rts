(function registerGeometryCache(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createGeometryCache() {
    const store = new Map();
    return Object.freeze({
      get(key, factory) {
        if (!store.has(key)) store.set(key, factory());
        return store.get(key);
      },
      has(key) {
        return store.has(key);
      },
      clear() {
        store.clear();
      },
      size() {
        return store.size;
      },
      keys() {
        return [...store.keys()];
      }
    });
  }

  app.rendering.geometryCaches = Object.freeze({
    createGeometryCache,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['createGeometryCache']
      };
    }
  });

  app.diagnostics?.register?.('geometry-caches', () => app.rendering.geometryCaches.describe());
})(globalThis);
