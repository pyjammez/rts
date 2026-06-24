(function registerObjectFactoryRegistry(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objectFactories = app.world.objectFactories || {};

  function categories() {
    return Object.keys(app.world.objectFactories)
      .filter(key => key !== 'registry' && typeof app.world.objectFactories[key] === 'object')
      .sort();
  }

  function methodsFor(category) {
    const group = app.world.objectFactories[category];
    if (!group || typeof group !== 'object') return [];
    return Object.keys(group)
      .filter(key => key !== 'describe' && typeof group[key] === 'function')
      .sort();
  }

  function create(category, method, options = {}) {
    const factory = app.world.objectFactories?.[category]?.[method];
    return typeof factory === 'function' ? factory(options) : null;
  }

  function describe() {
    return {
      schemaVersion: 1,
      categories: categories().map(category => ({
        category,
        methods: methodsFor(category)
      }))
    };
  }

  app.world.objectFactories.registry = Object.freeze({
    categories,
    methodsFor,
    create,
    describe
  });

  app.diagnostics?.register?.('world-object-factories', describe);
})(globalThis);
