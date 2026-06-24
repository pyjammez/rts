(function registerMapBuilderRuntimeService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function paintTile(worldX, worldY, options = {}) {
    const tileSize = options.tileSize || 32;
    const tileX = Math.floor(worldX / tileSize);
    const tileY = Math.floor(worldY / tileSize);
    if (!options.isInsideMap?.(tileX, tileY)) return { changed: false };
    const result = app.world.mapBuilderBrushes.applyBrush({
      ...options,
      tileX,
      tileY
    });
    if (!result.changed) return result;
    if (result.houses !== options.houses) options.replaceHouses?.(result.houses);
    options.rebuildObstacles?.();
    options.touchEditedMap?.();
    return result;
  }

  function exportMap(options = {}) {
    const name = String(options.name || 'Custom Map').trim() || 'Custom Map';
    return {
      id: options.id || `map-${Date.now()}`,
      name,
      rows: options.rows,
      columns: options.columns,
      tileSize: options.tileSize,
      terrain: (options.terrainData || []).map(row => [...row]),
      obstacles: (options.obstacleData || []).map(row => [...row]),
      decorations: (options.decorationData || []).map(row => [...row]),
      heights: (options.heightData || []).map(row => [...row]),
      houses: (options.houses || [])
        .filter(house => !house.isWreck)
        .map(house => ({ tileX: house.tileX, tileY: house.tileY }))
    };
  }

  app.world.mapBuilderRuntime = Object.freeze({
    paintTile,
    exportMap,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['paintTile', 'exportMap']
      };
    }
  });

  app.diagnostics?.register?.('map-builder-runtime', () => app.world.mapBuilderRuntime.describe());
})(globalThis);
