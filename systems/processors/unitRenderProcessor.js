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

  ctx.save();
  ctx.fillStyle = 'rgba(25, 12, 5, 0.28)';
  ctx.beginPath();
  ctx.ellipse(unit.x + 2, unit.y + 10, tileSize * 0.32, tileSize * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (unit.selected) {
    ctx.save();
    ctx.strokeStyle = unit.team === 'red' ? 'rgba(255, 196, 118, 0.9)' : 'rgba(173, 220, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y + 10, tileSize * 0.38, tileSize * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
    const barWidth = tileSize * 0.9;
    const barHeight = 4;
    const barX = unit.x - barWidth / 2;
    const barY = drawY - 8;
    const hpRatio = Math.max(0, unit.hp / unit.maxHp);
    ctx.fillStyle = 'rgba(41, 24, 12, 0.9)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = hpRatio > 0.5 ? '#5bbf55' : hpRatio > 0.25 ? '#d8a733' : '#a8362e';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    ctx.strokeStyle = 'rgba(255, 225, 151, 0.75)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

window.processUnitRender = processUnitRender;
