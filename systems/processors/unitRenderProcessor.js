function processUnitRender(unit, ctx) {
  const drawX = unit.x - 16;
  const drawY = unit.y - 16;
  const frameSize = 32;
  const frameX = unit.spriteFrame * frameSize;
  const frameY = unit.spriteDirectionRow * frameSize;

  if (unit.isDead) {
    ctx.save();
    ctx.translate(unit.x, unit.y);
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.55;
    if (tileSprites.unit && tileSprites.unit.complete && tileSprites.unit.naturalWidth > 0) {
      ctx.drawImage(tileSprites.unit, frameX, frameY, frameSize, frameSize, -16, -16, tileSize, tileSize);
    } else {
      ctx.fillStyle = unit.team === 'red' ? '#c63c3c' : '#3e69d7';
      ctx.beginPath();
      ctx.ellipse(0, 0, unit.size * 0.7, unit.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (tileSprites.unit && tileSprites.unit.complete && tileSprites.unit.naturalWidth > 0) {
    ctx.drawImage(tileSprites.unit, frameX, frameY, frameSize, frameSize, drawX, drawY, tileSize, tileSize);
  } else {
    ctx.fillStyle = unit.team === 'red' ? '#c63c3c' : '#3e69d7';
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, unit.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const shirtColor = unit.team === 'red' ? '#d84545' : unit.team === 'blue' ? '#4c78ff' : null;
  if (shirtColor) {
    ctx.fillStyle = shirtColor;
    if (unit.spriteDirectionRow === 1) {
      ctx.fillRect(drawX + tileSize * 0.34, drawY + tileSize * 0.42, tileSize * 0.18, tileSize * 0.28);
    } else if (unit.spriteDirectionRow === 2) {
      ctx.fillRect(drawX + tileSize * 0.48, drawY + tileSize * 0.42, tileSize * 0.18, tileSize * 0.28);
    } else {
      ctx.fillRect(drawX + tileSize * 0.39, drawY + tileSize * 0.39, tileSize * 0.22, tileSize * 0.30);
    }
  }

  if (unit.selected) {
    const barWidth = tileSize;
    const barHeight = 4;
    const barX = drawX;
    const barY = drawY - 8;
    const hpRatio = Math.max(0, unit.hp / unit.maxHp);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = hpRatio > 0.5 ? '#3ecf3e' : hpRatio > 0.25 ? '#e6c025' : '#d63333';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

window.processUnitRender = processUnitRender;

