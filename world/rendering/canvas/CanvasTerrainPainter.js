(function registerCanvasTerrainPainter(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};
  app.rendering.canvas = app.rendering.canvas || {};

  function drawTerrainTile(ctx, terrainType, drawX, drawY, {
    terrain,
    tileSize,
    tileSprites,
    volcanic = false
  }) {
    if (terrainType === terrain.WATER) {
      ctx.fillStyle = volcanic ? '#d94b19' : '#2f78b7';
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
      return;
    }

    const sprite = terrainType === terrain.GRASS
      ? tileSprites.grass
      : terrainType === terrain.SAND
        ? tileSprites.sand
        : tileSprites.dirt;
    const fallback = terrainType === terrain.GRASS
      ? '#4a7c3f'
      : terrainType === terrain.SAND
        ? '#c8b560'
        : '#8b6a3a';

    if (sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, drawX, drawY, tileSize, tileSize);
    } else {
      ctx.fillStyle = fallback;
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
    }
  }

  function drawTerrainAccents(ctx, terrainType, x, y, drawX, drawY, {
    terrain,
    tileSize,
    noise,
    volcanic = false
  }) {
    const n = noise(x + 17, y + 29);
    if (terrainType === terrain.WATER) {
      ctx.save();
      ctx.globalAlpha = volcanic ? 0.34 : 0.18;
      ctx.strokeStyle = volcanic
        ? (n > 0.5 ? '#ffd35a' : '#7e1c13')
        : (n > 0.5 ? '#9fd1e8' : '#1f5c91');
      ctx.lineWidth = volcanic ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(drawX + 4, drawY + tileSize * (0.35 + n * 0.2));
      ctx.quadraticCurveTo(drawX + 14, drawY + 10, drawX + 28, drawY + tileSize * (0.38 + n * 0.15));
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (terrainType === terrain.GRASS && n > 0.72) {
      ctx.fillStyle = n > 0.86 ? 'rgba(197, 178, 91, 0.1)' : 'rgba(15, 46, 18, 0.09)';
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
    }

    if (terrainType === terrain.SAND && n > 0.65) {
      ctx.fillStyle = 'rgba(132, 94, 43, 0.07)';
      ctx.fillRect(drawX, drawY, tileSize, tileSize);
    }
  }

  function drawTransitions(ctx, x, y, terrainType, drawX, drawY, {
    terrain,
    terrainData,
    tileSize,
    isInsideMap
  }) {
    if (terrainType !== terrain.WATER) return;
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
    const hasLandNeighbor = neighbors.some(n =>
      isInsideMap(n.x, n.y) && terrainData[n.y][n.x] !== terrain.WATER
    );
    if (!hasLandNeighbor) return;
    ctx.fillStyle = 'rgba(255, 240, 180, 0.15)';
    ctx.fillRect(drawX, drawY, tileSize, tileSize);
  }

  function renderWaterRipples(ctx, {
    camX,
    camY,
    viewWidth,
    viewHeight,
    terrainData,
    rows,
    columns,
    terrain,
    tileSize,
    timeSeconds,
    noise,
    volcanic = false
  }) {
    const startX = Math.max(0, Math.floor(camX / tileSize));
    const endX = Math.min(columns - 1, Math.floor((camX + viewWidth) / tileSize) + 1);
    const startY = Math.max(0, Math.floor(camY / tileSize));
    const endY = Math.min(rows - 1, Math.floor((camY + viewHeight) / tileSize) + 1);

    ctx.save();
    ctx.strokeStyle = volcanic ? 'rgba(255, 198, 72, 0.34)' : 'rgba(184, 222, 231, 0.22)';
    ctx.lineWidth = volcanic ? 2 : 1;
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (terrainData[y][x] !== terrain.WATER) continue;
        const n = noise ? noise(x + 5009, y + 911) : 1;
        if (n < 0.82) continue;
        const phase = timeSeconds * (volcanic ? 2.4 : 1.4) + n * Math.PI * 2;
        const ripple = volcanic ? 3 + (Math.sin(phase) + 1) * 4 : 4 + (Math.sin(phase) + 1) * 3;
        const cx = x * tileSize + tileSize * (0.25 + (noise ? noise(x + 31, y + 47) : 0.5) * 0.5);
        const cy = y * tileSize + tileSize * (0.25 + (noise ? noise(x + 79, y + 11) : 0.5) * 0.5);
        ctx.globalAlpha = volcanic ? 0.42 + Math.sin(phase) * 0.18 : 0.35 + Math.sin(phase) * 0.15;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ripple * 1.7, ripple * 0.55, 0.1, 0, Math.PI * 2);
        ctx.stroke();
        if (volcanic && n > 0.92) {
          ctx.fillStyle = `rgba(255, 228, 96, ${0.12 + Math.sin(phase) * 0.05})`;
          ctx.beginPath();
          ctx.ellipse(cx, cy, ripple * 1.1, ripple * 0.32, 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  app.rendering.canvas.terrainPainter = Object.freeze({
    drawTerrainTile,
    drawTerrainAccents,
    drawTransitions,
    renderWaterRipples
  });
})(globalThis);
