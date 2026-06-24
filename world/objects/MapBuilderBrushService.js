(function registerMapBuilderBrushService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function applyBrush(context = {}) {
    const tool = String(context.tool || 'grass');
    const tileX = Math.floor(Number(context.tileX) || 0);
    const tileY = Math.floor(Number(context.tileY) || 0);
    const terrain = context.terrain || {};
    const obstacle = context.obstacle || {};
    const decor = context.decor || {};
    const height = context.height || {};
    const terrainData = context.terrainData;
    const obstacleData = context.obstacleData;
    const decorationData = context.decorationData;
    const heightData = context.heightData;
    const houses = Array.isArray(context.houses) ? context.houses : [];

    if (!terrainData?.[tileY] || !obstacleData?.[tileY] || !decorationData?.[tileY] || !heightData?.[tileY]) {
      return { changed: false, houses };
    }

    let nextHouses = houses;
    if (tool === 'water') {
      terrainData[tileY][tileX] = terrain.WATER;
      obstacleData[tileY][tileX] = obstacle.NONE;
      decorationData[tileY][tileX] = decor.NONE;
      heightData[tileY][tileX] = height.LOW;
    } else if (tool === 'sand') {
      terrainData[tileY][tileX] = terrain.SAND;
    } else if (tool === 'grass') {
      terrainData[tileY][tileX] = terrain.GRASS;
    } else if (tool === 'dirt') {
      terrainData[tileY][tileX] = terrain.DIRT;
    } else if (tool === 'tree') {
      terrainData[tileY][tileX] = terrainData[tileY][tileX] === terrain.WATER ? terrain.GRASS : terrainData[tileY][tileX];
      obstacleData[tileY][tileX] = obstacle.TREE;
      decorationData[tileY][tileX] = decor.NONE;
    } else if (tool === 'rock') {
      obstacleData[tileY][tileX] = obstacle.ROCK;
      decorationData[tileY][tileX] = decor.NONE;
    } else if (tool === 'hill') {
      heightData[tileY][tileX] = height.HIGH;
      decorationData[tileY][tileX] = decor.HILL;
    } else if (tool === 'ditch') {
      heightData[tileY][tileX] = height.LOW;
      decorationData[tileY][tileX] = decor.DITCH;
      obstacleData[tileY][tileX] = obstacle.NONE;
    } else if (tool === 'low') {
      heightData[tileY][tileX] = height.LOW;
      decorationData[tileY][tileX] = decor.NONE;
    } else if (tool === 'high') {
      heightData[tileY][tileX] = height.HIGH;
      decorationData[tileY][tileX] = decor.HILL;
    } else if (tool === 'ramp') {
      heightData[tileY][tileX] = height.RAMP;
      decorationData[tileY][tileX] = decor.RAMP;
      obstacleData[tileY][tileX] = obstacle.NONE;
    } else if (tool === 'cliff') {
      heightData[tileY][tileX] = height.HIGH;
      obstacleData[tileY][tileX] = obstacle.NONE;
      decorationData[tileY][tileX] = decor.CLIFF;
    } else if (tool === 'hut') {
      decorationData[tileY][tileX] = decor.HUT;
    } else if (tool === 'well') {
      terrainData[tileY][tileX] = terrainData[tileY][tileX] === terrain.WATER ? terrain.GRASS : terrainData[tileY][tileX];
      obstacleData[tileY][tileX] = obstacle.NONE;
      decorationData[tileY][tileX] = decor.WELL;
    } else if (tool === 'house') {
      const createHouse = context.createHouse;
      const columns = Math.max(1, Number(context.columns) || terrainData[0].length);
      const rows = Math.max(1, Number(context.rows) || terrainData.length);
      const existing = houses.find(house => !house.isWreck && house.tileX === tileX && house.tileY === tileY);
      if (!existing && tileX < columns - 1 && tileY < rows - 1 && typeof createHouse === 'function') {
        nextHouses = [...houses, createHouse(tileX, tileY)];
      }
    } else if (tool === 'clear') {
      obstacleData[tileY][tileX] = obstacle.NONE;
      decorationData[tileY][tileX] = decor.NONE;
      heightData[tileY][tileX] = height.GROUND;
      nextHouses = houses.filter(house => !(tileX >= house.tileX && tileX < house.tileX + house.width && tileY >= house.tileY && tileY < house.tileY + house.height));
    }

    return {
      changed: true,
      houses: nextHouses,
      rebuildObstacles: true,
      terrainChanged: ['water', 'sand', 'grass', 'dirt', 'tree', 'well'].includes(tool),
      tool
    };
  }

  app.world.mapBuilderBrushes = Object.freeze({
    applyBrush,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['applyBrush']
      };
    }
  });

  app.diagnostics?.register?.('map-builder-brushes', () => app.world.mapBuilderBrushes.describe());
})(globalThis);
