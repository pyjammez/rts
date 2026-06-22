(function registerThreeOverlayPass(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before OverlayPass.js');

  function drawBar(ctx, x, y, hp, maxHp, width, showNumbers = true) {
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    ctx.save();
    if (showNumbers) {
      ctx.font = 'bold 12px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(42,25,12,0.86)';
      ctx.strokeText(`${hp} / ${maxHp}`, x, y - 5);
      ctx.fillStyle = '#fff0c9';
      ctx.fillText(`${hp} / ${maxHp}`, x, y - 5);
    }
    ctx.fillStyle = 'rgba(41,24,12,0.92)';
    ctx.fillRect(x - width * 0.5, y, width, 7);
    ctx.fillStyle = ratio > 0.5 ? '#5bbf55' : ratio > 0.25 ? '#d8a733' : '#a8362e';
    ctx.fillRect(x - width * 0.5, y, width * ratio, 7);
    ctx.strokeStyle = 'rgba(255,225,151,0.82)';
    ctx.strokeRect(x - width * 0.5, y, width, 7);
    ctx.restore();
  }

  function drawMarkers(ctx, markers, projectWorld) {
    for (const marker of Array.isArray(markers) ? markers : []) {
      const point = projectWorld(marker.x, marker.y, 0.08);
      if (!point) continue;
      const progress = marker.age / marker.duration;
      const radius = marker.startRadius + (marker.endRadius - marker.startRadius) * progress;
      const alpha = 1 - progress;
      ctx.save();
      ctx.strokeStyle = marker.color === 'red'
        ? `rgba(255,74,74,${alpha})`
        : `rgba(91,224,120,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, Math.max(5, radius * 0.9), Math.max(3, radius * 0.36), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function selectedObjectHeight(object, treeType) {
    if (object.objectType === 'obstacle') return object.obstacleType === treeType ? 2.45 : 0.85;
    return object.displayName === 'Horse' ? 1 : 0.72;
  }

  function draw({
    ctx,
    canvas,
    units,
    buildings,
    selectedObject,
    markers,
    projectWorld,
    towerType = 'tower',
    treeType = 1,
    rampartHeight = 1.25
  }) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const building of Array.isArray(buildings) ? buildings : []) {
      if (building.isDead || !building.selected) continue;
      const point = projectWorld(building.x, building.y, building.type === towerType ? 2.9 : 2.5);
      if (point) drawBar(ctx, point.x, point.y, Math.ceil(building.hp), building.maxHp, 76);
    }
    for (const unit of Array.isArray(units) ? units : []) {
      if (unit.isDead || !unit.selected) continue;
      const elevation = unit.castleTopReached ? rampartHeight : 0;
      const point = projectWorld(unit.x, unit.y, 1.2 + elevation);
      if (point) drawBar(ctx, point.x, point.y, Math.ceil(unit.hp), unit.maxHp, 44, false);
    }
    if (selectedObject) {
      const point = projectWorld(
        selectedObject.x,
        selectedObject.y,
        selectedObjectHeight(selectedObject, treeType)
      );
      if (point) drawBar(ctx, point.x, point.y, Math.ceil(selectedObject.hp), selectedObject.maxHp, 54);
    }
    drawMarkers(ctx, markers, projectWorld);
  }

  const pass = Object.freeze({ draw, drawBar, drawMarkers, selectedObjectHeight });
  app.rendering.threeOverlay = pass;
  app.runtime?.registerService('three-overlay', pass);
})(globalThis);
