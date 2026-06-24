(function registerStaticWorldSignatureService(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function summarizeMapConfig(mapConfig = {}) {
    return {
      terrainPreset: mapConfig.terrainPreset || '',
      mapStyle: mapConfig.mapStyle || '',
      terrain: mapConfig.terrain || {},
      waterPercent: mapConfig.waterPercent,
      rockCount: mapConfig.rockCount,
      treeCount: mapConfig.treeCount
    };
  }

  function createBuildingSignature(buildings = []) {
    return buildings
      .map(building => `${building.id}:${building.isDead ? 1 : 0}:${building.upgradeLevel || 0}`)
      .join(',');
  }

  function createSignature({
    seed = '',
    columns = 0,
    rows = 0,
    buildings = [],
    obstacleRevision = 0,
    goldMineRevision = 0,
    houseRevision = 0,
    mapConfig = {}
  } = {}) {
    return [
      seed,
      columns,
      rows,
      createBuildingSignature(buildings),
      obstacleRevision,
      goldMineRevision,
      houseRevision,
      JSON.stringify(summarizeMapConfig(mapConfig))
    ].join(':');
  }

  app.rendering.staticWorldSignatures = Object.freeze({
    createSignature,
    createBuildingSignature,
    summarizeMapConfig
  });
})(globalThis);
