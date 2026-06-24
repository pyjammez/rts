(function registerAssetMetadataService(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.config = app.config || {};

  function normalizeModelMetadata(asset = {}) {
    return {
      id: asset.id || null,
      kind: asset.kind || 'procedural',
      renderer: asset.renderer || 'three',
      factory: asset.factory || null,
      url: asset.url || null,
      fallback: asset.fallback || null,
      scale: Number.isFinite(Number(asset.scale)) ? Number(asset.scale) : 1,
      rotation: asset.rotation || { x: 0, y: 0, z: 0 },
      lods: Array.isArray(asset.lods) ? asset.lods.map(lod => ({ ...lod })) : [],
      attachments: asset.attachments && typeof asset.attachments === 'object' ? { ...asset.attachments } : {},
      animations: asset.animations && typeof asset.animations === 'object' ? { ...asset.animations } : {}
    };
  }

  function resolveModelMetadata(id, fallback = null) {
    const asset = app.config.assets?.resolveModel?.(id, fallback);
    return asset ? normalizeModelMetadata(asset) : null;
  }

  app.config.assetMetadata = Object.freeze({
    normalizeModelMetadata,
    resolveModelMetadata
  });
})(globalThis);
