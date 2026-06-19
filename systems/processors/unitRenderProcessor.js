function drawUnitMount(unit, ctx, isMoving, stride) {
  const isSheepMount = unit.mountType === 'sheep';
  const isHorseMount = unit.unitType === 'scout' && !isSheepMount;
  if (!isSheepMount && !isHorseMount) return false;

  const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
  const bodyColor = isSheepMount ? '#eee4c7' : '#8a552e';
  const darkColor = isSheepMount ? '#211813' : '#3b2415';
  const maneColor = isSheepMount ? '#d8ceb5' : '#2a1710';
  const mountY = unit.y + (isSheepMount ? 8 : 9);
  const legStride = isMoving ? stride * 1.5 : 0;

  ctx.save();
  ctx.translate(unit.x, mountY);
  ctx.scale(facing, 1);

  ctx.fillStyle = 'rgba(25, 12, 5, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 9, isSheepMount ? 18 : 21, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, isSheepMount ? 16 : 20, isSheepMount ? 10 : 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isSheepMount) {
    ctx.fillStyle = '#f6edd6';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 5, -5 + Math.abs(i), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = maneColor;
    ctx.fillRect(-13, -7, 8, 9);
    ctx.fillStyle = '#6a3d21';
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    ctx.lineTo(-28, -7);
    ctx.lineTo(-23, 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(18, -5, isSheepMount ? 6 : 7, isSheepMount ? 6 : 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!isSheepMount) {
    ctx.fillRect(15, -11, 3, 8);
    ctx.fillRect(20, -11, 3, 8);
  }

  ctx.fillStyle = darkColor;
  const legXs = [-11, -4, 7, 14];
  legXs.forEach((legX, index) => {
    const swing = index % 2 === 0 ? -legStride : legStride;
    ctx.save();
    ctx.translate(legX, 5);
    ctx.rotate(swing * 0.05);
    ctx.fillRect(-1.2, 0, 2.4, isSheepMount ? 8 : 10);
    ctx.fillRect(-2.2, isSheepMount ? 7 : 9, 4.4, 1.8);
    ctx.restore();
  });

  ctx.fillStyle = '#5b3218';
  ctx.fillRect(-7, -9, 14, 4);
  ctx.restore();
  return true;
}

function getSwordSwing(unit) {
  if (!unit.attackAnimationTime || !unit.attackAnimationDuration) return 0;
  const progress = 1 - Math.max(0, Math.min(1, unit.attackAnimationTime / unit.attackAnimationDuration));
  return Math.sin(progress * Math.PI);
}

function drawSwordWeapon(unit, ctx, facing, baseX, baseY, length = 17) {
  const swing = getSwordSwing(unit);
  const restingAngle = -0.72;
  const attackAngle = -1.85 + swing * 2.75;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(unit.weaponId === 'sword' ? attackAngle : restingAngle);

  ctx.strokeStyle = '#d9d6c7';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  ctx.strokeStyle = '#5b3a1c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(5, 4);
  ctx.stroke();
  ctx.restore();
}

function processUnitRender(unit, ctx) {
  const drawX = unit.x - 16;
  const drawY = unit.y - 16;
  const frameSize = 32;
  const frameX = unit.spriteFrame * frameSize;
  const frameY = unit.spriteDirectionRow * frameSize;

  if (unit.isDead) {
    ctx.save();
    ctx.translate(unit.x, unit.y);
    ctx.rotate((unit.deathRotation || 0) + Math.PI * 0.08);

    ctx.fillStyle = 'rgba(26, 15, 7, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 8, unit.size * 0.85, unit.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e2d6bd';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 1);
    ctx.lineTo(8, 1);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 10);
    ctx.moveTo(-5, 6);
    ctx.lineTo(-13, 13);
    ctx.moveTo(5, 6);
    ctx.lineTo(13, 13);
    ctx.moveTo(-4, -2);
    ctx.lineTo(-13, -7);
    ctx.moveTo(4, -2);
    ctx.lineTo(13, -7);
    ctx.stroke();

    ctx.fillStyle = '#efe4c9';
    ctx.beginPath();
    ctx.arc(0, -10, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3523';
    ctx.beginPath();
    ctx.arc(-2, -11, 1, 0, Math.PI * 2);
    ctx.arc(2, -11, 1, 0, Math.PI * 2);
    ctx.fill();

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

  const isMoving = unit.hasActivePath ? unit.hasActivePath() : !!unit.target;
  const stride = isMoving ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 1.4 : 0;
  const hasMount = drawUnitMount(unit, ctx, isMoving, stride);
  const riderYOffset = hasMount ? -8 : 0;
  const legColor = unit.team === 'red' ? '#4c231d' : '#1d284c';
  const bootColor = '#211712';
  const legBaseY = unit.y + unit.size * 0.28;
  const legPairs = [
    [-4.5, -stride],
    [4.5, stride]
  ];

  ctx.save();
  ctx.translate(0, riderYOffset);

  if (!hasMount && tileSprites.unit && tileSprites.unit.complete && tileSprites.unit.naturalWidth > 0) {
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

  ctx.save();
  ctx.fillStyle = legColor;
  for (const [legX, swing] of legPairs) {
    ctx.save();
    ctx.translate(unit.x + legX, legBaseY);
    ctx.rotate(swing * 0.08);
    ctx.fillRect(-1.3, 0, 2.6, 7);
    ctx.fillStyle = bootColor;
    ctx.fillRect(-2.3, 6.3, 4.6, 1.7);
    ctx.fillStyle = legColor;
    ctx.restore();
  }
  ctx.restore();

  if (unit.unitType === 'knight') {
    const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
    ctx.fillStyle = '#4d4f4c';
    ctx.strokeStyle = '#222522';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(unit.x - facing * 8, unit.y - 1, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = unit.team === 'red' ? '#a53030' : '#315fc4';
    ctx.beginPath();
    ctx.ellipse(unit.x - facing * 8, unit.y - 1, 3.4, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();

    drawSwordWeapon(unit, ctx, facing, unit.x + facing * 7, unit.y - 2, 19);
  }

  if (unit.unitType === 'soldier') {
    const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
    drawSwordWeapon(unit, ctx, facing, unit.x + facing * 7, unit.y - 2, 18);
  }

  if (unit.unitType === 'scout' && !unit.mountType) {
    ctx.fillStyle = '#704521';
    ctx.fillRect(unit.x - 10, unit.y + 1, 20, 3);
  }

  ctx.restore();

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
