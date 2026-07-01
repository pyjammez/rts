(function registerRenderAssetAuditService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  const MODEL_ID_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*$/;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function sortedValues(values) {
    return [...new Set(values.filter(value => value !== undefined && value !== null).map(String).filter(Boolean))].sort();
  }

  function modelIdFor(category, recordId, record) {
    const model = record?.model || record?.type || recordId;
    return `${category}.${String(model || 'default')}`;
  }

  function collectExpectedModels(definitions = {}) {
    const expected = [];
    for (const [unitId, unit] of Object.entries(definitions.units || {})) {
      if (!isPlainObject(unit)) continue;
      expected.push({
        id: modelIdFor('unit', unitId, unit),
        category: 'unit',
        sourceId: unitId,
        sourceName: unit.name || unitId
      });
    }
    for (const [buildingId, building] of Object.entries(definitions.buildings || {})) {
      if (!isPlainObject(building)) continue;
      expected.push({
        id: modelIdFor('building', buildingId, building),
        category: 'building',
        sourceId: buildingId,
        sourceName: building.name || buildingId
      });
    }
    return expected.sort((a, b) => a.id.localeCompare(b.id) || a.sourceId.localeCompare(b.sourceId));
  }

  function normalizeFactoryList(factoryRegistry) {
    if (!factoryRegistry?.list) return [];
    return factoryRegistry.list().map(entry => ({
      id: entry.id,
      renderer: entry.metadata?.renderer || 'three',
      kind: entry.metadata?.kind || 'procedural',
      category: entry.metadata?.category || entry.id.split('.')[0]
    }));
  }

  function normalizeModelAssets(assetManifest = {}) {
    return Object.entries(assetManifest.models || {}).map(([id, asset]) => ({
      id,
      kind: asset?.kind || 'procedural',
      renderer: asset?.renderer || 'three',
      factory: asset?.factory || null,
      url: asset?.url || null,
      fallback: asset?.fallback || null,
      scale: Number.isFinite(Number(asset?.scale)) ? Number(asset.scale) : 1,
      lods: Array.isArray(asset?.lods) ? asset.lods.map(lod => ({ ...lod })) : [],
      animations: isPlainObject(asset?.animations) ? { ...asset.animations } : {},
      attachments: isPlainObject(asset?.attachments) ? { ...asset.attachments } : {}
    })).sort((a, b) => a.id.localeCompare(b.id));
  }

  function validateModelAsset(asset) {
    const diagnostics = [];
    if (!MODEL_ID_PATTERN.test(asset.id)) {
      diagnostics.push({ level: 'error', code: 'invalid_model_id', modelId: asset.id, message: `model id "${asset.id}" should look like "unit.worker" or "building.castle"` });
    }
    if (asset.kind !== 'procedural' && !asset.url) {
      diagnostics.push({ level: 'error', code: 'missing_model_url', modelId: asset.id, message: `imported model "${asset.id}" needs a url` });
    }
    if (asset.kind !== 'procedural' && !asset.fallback) {
      diagnostics.push({ level: 'warning', code: 'missing_import_fallback', modelId: asset.id, message: `imported model "${asset.id}" should declare a procedural fallback` });
    }
    if (asset.scale <= 0) {
      diagnostics.push({ level: 'error', code: 'invalid_model_scale', modelId: asset.id, message: `model "${asset.id}" scale must be positive` });
    }
    let previousDistance = -Infinity;
    asset.lods.forEach((lod, index) => {
      const distance = Number(lod.distance);
      if (!Number.isFinite(distance) || distance < 0) {
        diagnostics.push({ level: 'error', code: 'invalid_lod_distance', modelId: asset.id, message: `model "${asset.id}" lod ${index} needs a non-negative distance` });
      }
      if (distance <= previousDistance) {
        diagnostics.push({ level: 'warning', code: 'unsorted_lods', modelId: asset.id, message: `model "${asset.id}" lod distances should be increasing` });
      }
      previousDistance = distance;
      if (!lod.url && !lod.factory && !lod.fallback) {
        diagnostics.push({ level: 'warning', code: 'empty_lod', modelId: asset.id, message: `model "${asset.id}" lod ${index} should define url, factory, or fallback` });
      }
    });
    return diagnostics;
  }

  function createAudit({ definitions = {}, assetManifest = {}, factoryRegistry = app.rendering.factoryRegistry } = {}) {
    const expectedModels = collectExpectedModels(definitions);
    const assets = normalizeModelAssets(assetManifest);
    const factories = normalizeFactoryList(factoryRegistry);
    const assetIds = new Set(assets.map(asset => asset.id));
    const factoryIds = new Set(factories.map(factory => factory.id));
    const diagnostics = [];

    for (const expected of expectedModels) {
      if (!assetIds.has(expected.id) && !factoryIds.has(expected.id)) {
        diagnostics.push({
          level: 'warning',
          code: 'missing_model_contract',
          modelId: expected.id,
          message: `${expected.category} "${expected.sourceId}" expects "${expected.id}" but no asset or factory is registered`
        });
      }
    }

    for (const asset of assets) {
      diagnostics.push(...validateModelAsset(asset));
      if (asset.factory && !factoryIds.has(asset.factory) && !factoryIds.has(asset.id)) {
        diagnostics.push({
          level: 'warning',
          code: 'missing_named_factory',
          modelId: asset.id,
          message: `model "${asset.id}" asks for factory "${asset.factory}" but it is not registered`
        });
      }
    }

    return Object.freeze({
      schemaVersion: 1,
      expectedModelCount: expectedModels.length,
      assetModelCount: assets.length,
      factoryCount: factories.length,
      expectedModels,
      assets,
      factories,
      summary: {
        missingModelContracts: diagnostics.filter(item => item.code === 'missing_model_contract').length,
        importedModels: assets.filter(asset => asset.kind !== 'procedural').length,
        proceduralAssets: assets.filter(asset => asset.kind === 'procedural').length,
        lodReadyModels: assets.filter(asset => asset.lods.length > 0).length,
        animationReadyModels: assets.filter(asset => Object.keys(asset.animations).length > 0).length,
        diagnostics: diagnostics.length,
        errors: diagnostics.filter(item => item.level === 'error').length,
        warnings: diagnostics.filter(item => item.level === 'warning').length
      },
      facets: {
        categories: sortedValues([...expectedModels.map(model => model.category), ...factories.map(factory => factory.category)]),
        modelKinds: sortedValues(assets.map(asset => asset.kind)),
        renderers: sortedValues(assets.map(asset => asset.renderer))
      },
      diagnostics
    });
  }

  function describeAudit(audit) {
    return {
      schemaVersion: audit?.schemaVersion || 1,
      expectedModelCount: audit?.expectedModelCount || 0,
      assetModelCount: audit?.assetModelCount || 0,
      factoryCount: audit?.factoryCount || 0,
      summary: audit?.summary || {},
      facets: audit?.facets || {}
    };
  }

  app.rendering.renderAssetAudit = Object.freeze({
    MODEL_ID_PATTERN,
    collectExpectedModels,
    normalizeModelAssets,
    normalizeFactoryList,
    validateModelAsset,
    createAudit,
    describeAudit
  });
})(globalThis);
