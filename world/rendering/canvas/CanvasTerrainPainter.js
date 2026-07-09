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
    isInsideMap,
    noise,
    volcanic = false
  }) {
    const neighbors = [
      { x: x + 1, y, side: 'right' },
      { x: x - 1, y, side: 'left' },
      { x, y: y + 1, side: 'bottom' },
      { x, y: y - 1, side: 'top' }
    ];

    for (const neighbor of neighbors) {
      if (!isInsideMap(neighbor.x, neighbor.y)) continue;
      const neighborType = terrainData[neighbor.y][neighbor.x];
      if (neighborType === terrainType) continue;
      drawTerrainEdge(ctx, {
        terrain,
        terrainType,
        neighborType,
        drawX,
        drawY,
        tileSize,
        side: neighbor.side,
        seedX: x,
        seedY: y,
        noise,
        volcanic
      });
    }
  }

  function fallbackNoise(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function edgeNoise(noise, x, y, offset = 0) {
    return typeof noise === 'function' ? noise(x + offset * 17, y + offset * 31) : fallbackNoise(x + offset * 17, y + offset * 31);
  }

  function transitionColors(terrain, terrainType, neighborType, volcanic) {
    const waterTouch = terrainType === terrain.WATER || neighborType === terrain.WATER;
    if (volcanic && waterTouch) {
      return {
        fill: terrainType === terrain.WATER ? 'rgba(255, 198, 64, 0)' : 'rgba(42, 31, 25, 0.42)',
        detail: terrainType === terrain.WATER ? 'rgba(255, 236, 118, 0.38)' : 'rgba(255, 98, 35, 0.28)',
        line: 'rgba(255, 181, 49, 0.45)',
        depth: 0
      };
    }
    if (waterTouch) {
      return {
        fill: terrainType === terrain.WATER ? 'rgba(140, 207, 221, 0)' : 'rgba(112, 92, 57, 0.13)',
        detail: terrainType === terrain.WATER ? 'rgba(226, 242, 232, 0.14)' : 'rgba(245, 226, 160, 0.12)',
        line: 'rgba(238, 240, 207, 0.18)',
        depth: 0
      };
    }
    if (terrainType === terrain.SAND || neighborType === terrain.SAND) {
      return {
        fill: terrainType === terrain.SAND ? 'rgba(87, 118, 51, 0.13)' : 'rgba(203, 173, 92, 0.18)',
        detail: 'rgba(80, 58, 32, 0.08)',
        line: 'rgba(245, 224, 145, 0.13)',
        depth: 10
      };
    }
    return {
      fill: 'rgba(75, 55, 35, 0.1)',
      detail: 'rgba(26, 60, 24, 0.08)',
      line: 'rgba(210, 190, 132, 0.1)',
      depth: 8
    };
  }

  function isWaterTransition(terrain, terrainType, neighborType) {
    return terrainType === terrain.WATER || neighborType === terrain.WATER;
  }

  function drawTerrainEdge(ctx, options) {
    if (!isWaterTransition(options.terrain, options.terrainType, options.neighborType)) {
      return;
    }

    const colors = transitionColors(options.terrain, options.terrainType, options.neighborType, options.volcanic);
    if (options.terrainType !== options.terrain.WATER && colors.depth > 0) {
      drawWavyEdgeBand(ctx, {
        ...options,
        depth: colors.depth,
        fillStyle: colors.fill
      });
    }
    drawWavyEdgeLine(ctx, {
      ...options,
      strokeStyle: colors.line
    });

    const n = edgeNoise(options.noise, options.seedX, options.seedY, options.side.length);
    if (options.terrainType !== options.terrain.WATER && n > 0.45) {
      drawPatchyEdgeDetail(ctx, {
        ...options,
        fillStyle: colors.detail,
        count: n > 0.78 ? 3 : 2
      });
    }
  }

  function edgePoint(side, tileSize, along, inset = 0, wobble = 0) {
    if (side === 'right') return { x: tileSize - inset + wobble, y: along };
    if (side === 'left') return { x: inset + wobble, y: along };
    if (side === 'bottom') return { x: along, y: tileSize - inset + wobble };
    return { x: along, y: inset + wobble };
  }

  function drawWavyEdgeBand(ctx, {
    drawX,
    drawY,
    tileSize,
    side,
    seedX,
    seedY,
    noise,
    depth,
    fillStyle
  }) {
    const steps = 5;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= steps; i++) {
      const along = (i / steps) * tileSize;
      const wobble = (edgeNoise(noise, seedX + i, seedY, 3) - 0.5) * tileSize * 0.16;
      const innerDepth = depth + edgeNoise(noise, seedX, seedY + i, 7) * tileSize * 0.18;
      outer.push(edgePoint(side, tileSize, along, 0, wobble * 0.25));
      inner.push(edgePoint(side, tileSize, along, innerDepth, wobble));
    }

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(outer[0].x, outer[0].y);
    for (const point of outer.slice(1)) ctx.lineTo(point.x, point.y);
    for (const point of inner.reverse()) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawWavyEdgeLine(ctx, {
    drawX,
    drawY,
    tileSize,
    side,
    seedX,
    seedY,
    noise,
    strokeStyle
  }) {
    const steps = 5;
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = Math.max(1, tileSize * 0.035);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const along = (i / steps) * tileSize;
      const wobble = (edgeNoise(noise, seedX + i, seedY, 11) - 0.5) * tileSize * 0.12;
      const point = edgePoint(side, tileSize, along, 2, wobble);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPatchyEdgeDetail(ctx, {
    drawX,
    drawY,
    tileSize,
    side,
    seedX,
    seedY,
    noise,
    fillStyle,
    count
  }) {
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.fillStyle = fillStyle;
    for (let i = 0; i < count; i++) {
      const along = tileSize * (0.18 + edgeNoise(noise, seedX + i, seedY, 19) * 0.64);
      const inset = tileSize * (0.12 + edgeNoise(noise, seedX, seedY + i, 23) * 0.22);
      const point = edgePoint(side, tileSize, along, inset, 0);
      const radius = tileSize * (0.06 + edgeNoise(noise, seedX + i, seedY + i, 29) * 0.08);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius * 1.8, radius, side === 'left' || side === 'right' ? Math.PI * 0.5 : 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
