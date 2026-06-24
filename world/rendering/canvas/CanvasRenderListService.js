(function registerCanvasRenderListService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};
  app.rendering.canvas = app.rendering.canvas || {};

  function isVisiblePoint(x, y, view, padding = 0) {
    return x >= view.x - padding &&
      x <= view.x + view.width + padding &&
      y >= view.y - padding &&
      y <= view.y + view.height + padding;
  }

  function createWorldObjectDrawList(options = {}) {
    const tileSize = options.tileSize || 32;
    const camera = options.camera || { x: 0, y: 0, zoom: 1, viewportWidth: options.canvasWidth || 0, viewportHeight: options.canvasHeight || 0 };
    const zoom = camera.zoom || 1;
    const view = {
      x: camera.x || 0,
      y: camera.y || 0,
      width: camera.viewportWidth ? camera.viewportWidth / zoom : options.canvasWidth || 0,
      height: camera.viewportHeight ? camera.viewportHeight / zoom : options.canvasHeight || 0
    };
    const rows = options.rows || 0;
    const columns = options.columns || 0;
    const obstacleNone = options.obstacleNone ?? 0;
    const obstacleTree = options.obstacleTree ?? 1;
    const homeType = options.homeType || 'home';
    const drawList = [];

    const startX = Math.max(0, Math.floor((view.x - tileSize * 3) / tileSize));
    const endX = Math.min(columns - 1, Math.floor((view.x + view.width + tileSize * 3) / tileSize));
    const startY = Math.max(0, Math.floor((view.y - tileSize * 4) / tileSize));
    const endY = Math.min(rows - 1, Math.floor((view.y + view.height + tileSize * 2) / tileSize));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const obstacleType = options.obstacleData?.[y]?.[x];
        if (obstacleType === undefined || obstacleType === obstacleNone) continue;
        drawList.push({
          type: 'obstacle',
          sortY: y * tileSize + (obstacleType === obstacleTree ? tileSize * 0.9 : tileSize * 0.72),
          obstacleType,
          x,
          y
        });
      }
    }

    for (const sheep of options.sheep || []) {
      if (sheep.isMounted || !isVisiblePoint(sheep.x, sheep.y, view, 40)) continue;
      drawList.push({ type: 'sheep', sortY: sheep.y + 12, sheep });
    }

    for (const roast of options.roasts || []) {
      if (!isVisiblePoint(roast.x, roast.y, view, 50)) continue;
      drawList.push({ type: 'roast', sortY: roast.y + 18, roast });
    }

    for (const duck of options.ducks || []) {
      if (!isVisiblePoint(duck.x, duck.y, view, 40)) continue;
      drawList.push({ type: 'duck', sortY: duck.y + 8, duck });
    }

    for (const horse of options.horses || []) {
      if (horse.isDead || !isVisiblePoint(horse.x, horse.y, view, 50)) continue;
      drawList.push({ type: 'horse', sortY: horse.y + 14, horse });
    }

    for (const worldItem of options.items || []) {
      if (worldItem.isDead || worldItem.isPickedUp || !isVisiblePoint(worldItem.x, worldItem.y, view, 30)) continue;
      drawList.push({ type: 'world-item', sortY: worldItem.y + 10, worldItem });
    }

    for (const mine of options.goldMines || []) {
      if (mine.isDead || !isVisiblePoint(mine.x, mine.y, view, 50)) continue;
      drawList.push({ type: 'gold-mine', sortY: mine.y + tileSize * 0.45, mine });
    }

    for (const house of options.houses || []) {
      if ((house.isDead && !house.isWreck) || !isVisiblePoint(house.x, house.y, view, 80)) continue;
      drawList.push({ type: 'house', sortY: house.y + house.height * tileSize * 0.35, house });
    }

    for (const building of options.buildings || []) {
      if (building.isDead || !isVisiblePoint(building.x, building.y, view, 140)) continue;
      if (building.type === homeType) {
        drawList.push({
          type: 'building',
          layer: 'base',
          sortY: building.y - building.height * tileSize * 0.52,
          building
        });
        drawList.push({
          type: 'building',
          layer: 'front',
          sortY: building.y + building.height * tileSize * 0.42,
          building
        });
      } else {
        drawList.push({
          type: 'building',
          layer: 'full',
          sortY: building.y + building.height * tileSize * 0.34,
          building
        });
      }
    }

    for (const unit of options.units || []) {
      if (unit.hiddenInHouse) continue;
      drawList.push({ type: 'unit', sortY: unit.y + unit.size * 0.5, unit });
    }

    drawList.sort((a, b) => a.sortY - b.sortY);
    return drawList;
  }

  app.rendering.canvas.renderLists = Object.freeze({
    createWorldObjectDrawList,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['createWorldObjectDrawList']
      };
    }
  });

  app.diagnostics?.register?.('canvas-render-lists', () => app.rendering.canvas.renderLists.describe());
})(globalThis);
