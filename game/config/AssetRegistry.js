(function registerAssetRegistry(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.config = app.config || {};

  const DEFAULT_ASSETS = Object.freeze({
    schemaVersion: 1,
    models: {},
    textures: {},
    sounds: {}
  });

  let manifest = {
    ...DEFAULT_ASSETS,
    models: {},
    textures: {},
    sounds: {}
  };
  const loadState = {
    loaded: false,
    usedFallback: false,
    errors: []
  };

  function normalizeAssetGroup(group) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) return {};
    const normalized = {};
    for (const [id, asset] of Object.entries(group)) {
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
      normalized[id] = { ...asset, id };
    }
    return normalized;
  }

  function normalizeManifest(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('asset manifest must be an object');
    }
    return {
      schemaVersion: Number(data.schemaVersion) || 1,
      models: normalizeAssetGroup(data.models),
      textures: normalizeAssetGroup(data.textures),
      sounds: normalizeAssetGroup(data.sounds)
    };
  }

  async function loadAssetManifest(path = 'assets/data/assets.json') {
    try {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      manifest = normalizeManifest(await response.json());
    } catch (error) {
      loadState.usedFallback = true;
      loadState.errors.push(error.message);
      manifest = normalizeManifest(DEFAULT_ASSETS);
      console.warn('Using built-in asset manifest fallback.', error);
    }
    loadState.loaded = true;
    return loadState;
  }

  function get(kind, id) {
    return manifest?.[kind]?.[id] || null;
  }

  function resolveModel(logicalId, fallback = null) {
    return get('models', logicalId) || (fallback ? get('models', fallback) : null);
  }

  function resolveTexture(logicalId, fallback = null) {
    return get('textures', logicalId) || (fallback ? get('textures', fallback) : null);
  }

  function describe() {
    return {
      schemaVersion: manifest.schemaVersion,
      loaded: !!loadState.loaded,
      usedFallback: !!loadState.usedFallback,
      errors: [...loadState.errors],
      counts: {
        models: Object.keys(manifest.models || {}).length,
        textures: Object.keys(manifest.textures || {}).length,
        sounds: Object.keys(manifest.sounds || {}).length
      }
    };
  }

  app.config.assets = Object.freeze({
    get manifest() { return manifest; },
    loadState,
    loadAssetManifest,
    get,
    resolveModel,
    resolveTexture,
    describe
  });
  app.diagnostics?.register?.('assets', describe);
})(globalThis);
