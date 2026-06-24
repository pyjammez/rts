(function registerModelFactoryResolver(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function fallbackModelId(entityOrSource, category) {
    const source = entityOrSource?.source || entityOrSource || {};
    const resolvedCategory = category || entityOrSource?.category || (
      source.unitType ? 'unit' :
      source.type ? 'building' :
      source.displayName ? 'wildlife' :
      source.objectType || 'object'
    );
    const model = source.model || source.unitType || source.type || source.displayName?.toLowerCase?.() || source.objectType || 'default';
    return `${resolvedCategory}.${model}`;
  }

  function resolve(entityOrSource, {
    category = null,
    fallbackId = null
  } = {}) {
    const asset = app.rendering.threeDomains?.resolveModelAsset
      ? app.rendering.threeDomains.resolveModelAsset(entityOrSource, category)
      : null;
    const id = asset?.id || fallbackId || fallbackModelId(entityOrSource, category);
    return {
      id,
      asset: asset || { id, kind: 'procedural' },
      factory: app.rendering.factoryRegistry?.get?.(id) || null,
      hasFactory: !!app.rendering.factoryRegistry?.has?.(id)
    };
  }

  function create(entityOrSource, options = {}, ...args) {
    const resolved = resolve(entityOrSource, options);
    if (resolved.factory) return resolved.factory(entityOrSource, resolved, ...args);
    return typeof options.fallback === 'function'
      ? options.fallback(entityOrSource, resolved, ...args)
      : null;
  }

  app.rendering.modelFactoryResolver = Object.freeze({
    fallbackModelId,
    resolve,
    create
  });
  app.diagnostics?.register?.('model-factory-resolver', () => ({
    schemaVersion: 1,
    factoryCount: app.rendering.factoryRegistry?.describe?.().count || 0
  }));
})(globalThis);
