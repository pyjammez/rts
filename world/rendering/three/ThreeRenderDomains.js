(function registerThreeRenderDomains(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};
  app.rendering.threeDomains = app.rendering.threeDomains || {};

  function fallbackDynamicSources(fallbackUnits = []) {
    return {
      units: fallbackUnits,
      sheep: Array.isArray(root.sheepData) ? root.sheepData : [],
      ducks: Array.isArray(root.duckData) ? root.duckData : [],
      horses: Array.isArray(root.horseData) ? root.horseData : [],
      items: Array.isArray(root.itemData) ? root.itemData : [],
      projectiles: app.systems?.projectiles?.getProjectiles ? app.systems.projectiles.getProjectiles() : []
    };
  }

  function getDynamicRenderSources(fallbackUnits = []) {
    const query = app.entities?.query;
    if (!query?.query) return fallbackDynamicSources(fallbackUnits);

    return {
      units: query.sources({
        category: 'unit',
        predicate: entity => entity.components?.render?.visible !== false
      }),
      sheep: query.sources({
        category: 'wildlife',
        predicate: entity => entity.source?.displayName === 'Sheep' && !entity.source?.isMounted
      }),
      ducks: query.sources({
        category: 'wildlife',
        predicate: entity => entity.source?.displayName === 'Duck'
      }),
      horses: query.sources({
        category: 'wildlife',
        predicate: entity => entity.source?.displayName === 'Horse'
      }),
      items: query.sources({
        category: 'item',
        lifecycle: 'alive',
        predicate: entity => !entity.source?.isPickedUp
      }),
      projectiles: query.sources({
        category: 'projectile',
        predicate: entity => !entity.source?.dead
      })
    };
  }

  function resolveModelAsset(entityOrSource, category = null) {
    const source = entityOrSource?.source || entityOrSource || {};
    const resolvedCategory = category || entityOrSource?.category || (
      source.unitType ? 'unit' :
      source.type ? 'building' :
      source.objectType || 'object'
    );
    const displayModel = typeof source.displayName === 'string'
      ? source.displayName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
      : null;
    const model = source.model || source.unitType || source.type || displayModel || source.objectType || 'default';
    const assetId = source.assetId || `${resolvedCategory}.${model}`;
    return app.config?.assets?.resolveModel?.(assetId) || { id: assetId, kind: 'procedural', factory: model };
  }

  app.rendering.threeDomains = Object.freeze({
    getDynamicRenderSources,
    resolveModelAsset,
    describe: () => ({
      schemaVersion: 1,
      usesEntityRegistry: !!app.entities?.query?.query,
      assetManifestLoaded: !!app.config?.assets?.loadState?.loaded
    })
  });
  app.diagnostics?.register?.('three-render-domains', () => app.rendering.threeDomains.describe());
})(globalThis);
