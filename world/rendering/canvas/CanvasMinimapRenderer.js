(function registerCanvasMinimapRenderer(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};
  app.rendering.canvas = app.rendering.canvas || {};

  function terrainColor(type, terrain = {}) {
    if (type === terrain.WATER) return '#2f78b7';
    if (type === terrain.SAND) return '#c8b560';
    if (type === terrain.GRASS) return '#2f7a3a';
    return '#8a5a34';
  }

  function project(point, dimensions, width, height) {
    return {
      x: (point.x / dimensions.width) * width,
      y: (point.y / dimensions.height) * height
    };
  }

  function render(ctx, options = {}) {
    const canvas = options.canvas;
    const terrainData = options.terrainData || [];
    const rows = options.rows || terrainData.length;
    const columns = options.columns || terrainData[0]?.length || 0;
    if (!ctx || !canvas || rows <= 0 || columns <= 0) return false;

    const width = canvas.width;
    const height = canvas.height;
    const tileSize = options.tileSize || 32;
    const dimensions = options.dimensions || { width: columns * tileSize, height: rows * tileSize };
    const cellW = width / columns;
    const cellH = height / rows;
    const terrain = options.terrain || {};
    const obstacle = options.obstacle || {};
    const teamColor = options.teamColor || (team => team === 'red' ? '#ff4a4a' : '#59a0ff');

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        ctx.fillStyle = terrainColor(terrainData[y][x], terrain);
        ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const obs = options.obstacleData?.[y]?.[x];
        if (obs === undefined || obs === obstacle.NONE) continue;
        ctx.fillStyle = obs === obstacle.TREE ? '#1f4f1f' : '#666';
        ctx.fillRect(x * cellW, y * cellH, Math.max(1, cellW * 0.9), Math.max(1, cellH * 0.9));
      }
    }

    for (const unit of options.units || []) {
      if (unit.isDead) continue;
      const point = project(unit, dimensions, width, height);
      ctx.fillStyle = teamColor(unit.team);
      ctx.fillRect(point.x - 1, point.y - 1, 3, 3);
    }

    ctx.fillStyle = '#eadfca';
    for (const sheep of options.sheep || []) {
      if (sheep.isMounted) continue;
      const point = project(sheep, dimensions, width, height);
      ctx.fillRect(point.x - 0.5, point.y - 0.5, 2, 2);
    }

    ctx.fillStyle = '#9a6336';
    for (const horse of options.horses || []) {
      if (horse.isDead) continue;
      const point = project(horse, dimensions, width, height);
      ctx.fillRect(point.x - 1, point.y - 1, 2.5, 2.5);
    }

    ctx.fillStyle = '#f0c35a';
    for (const item of options.items || []) {
      if (item.isDead || item.isPickedUp) continue;
      const point = project(item, dimensions, width, height);
      ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
    }

    ctx.fillStyle = '#d9aa33';
    for (const mine of options.goldMines || []) {
      if (mine.isDead) continue;
      const point = project(mine, dimensions, width, height);
      ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    }

    for (const house of options.houses || []) {
      if (house.isDead && !house.isWreck) continue;
      const point = project(house, dimensions, width, height);
      ctx.fillStyle = house.isWreck ? '#2b241f' : house.burning ? '#c94a24' : '#8a5a34';
      ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    }

    for (const building of options.buildings || []) {
      if (building.isDead) continue;
      const point = project(building, dimensions, width, height);
      const bw = Math.max(3, (building.width * tileSize / dimensions.width) * width);
      const bh = Math.max(3, (building.height * tileSize / dimensions.height) * height);
      ctx.fillStyle = teamColor(building.team);
      ctx.fillRect(point.x - bw * 0.5, point.y - bh * 0.5, bw, bh);
      ctx.strokeStyle = '#f8e7ad';
      ctx.strokeRect(point.x - bw * 0.5, point.y - bh * 0.5, bw, bh);
    }

    const camera = options.camera;
    if (camera) {
      const vw = (camera.viewportWidth / camera.zoom / dimensions.width) * width;
      const vh = (camera.viewportHeight / camera.zoom / dimensions.height) * height;
      const rawVx = (camera.x / dimensions.width) * width;
      const rawVy = (camera.y / dimensions.height) * height;
      const vx = Math.max(0, Math.min(rawVx, width));
      const vy = Math.max(0, Math.min(rawVy, height));
      const clippedVw = Math.max(0, Math.min(rawVx + vw, width) - vx);
      const clippedVh = Math.max(0, Math.min(rawVy + vh, height) - vy);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, clippedVw, clippedVh);
    }

    return true;
  }

  app.rendering.canvas.minimap = Object.freeze({
    render,
    terrainColor,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['render', 'terrainColor']
      };
    }
  });

  app.diagnostics?.register?.('canvas-minimap', () => app.rendering.canvas.minimap.describe());
})(globalThis);
