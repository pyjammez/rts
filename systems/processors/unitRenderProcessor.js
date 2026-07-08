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

function getAttackProgress(unit) {
  if (!unit.attackAnimationTime || !unit.attackAnimationDuration) return 1;
  return 1 - Math.max(0, Math.min(1, unit.attackAnimationTime / unit.attackAnimationDuration));
}

function getAttackTargetAngle(unit, facing) {
  const target = unit.currentEnemy || unit.attackOrderTarget || unit.autoEngageTarget;
  if (!target) return facing === -1 ? Math.PI : 0;
  return Math.atan2(target.y - unit.y, target.x - unit.x);
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

function drawLanceWeapon(unit, ctx, facing, baseX, baseY) {
  const progress = getAttackProgress(unit);
  const thrust = unit.attackAnimationTime > 0 ? Math.sin(progress * Math.PI) * 9 : 0;
  ctx.save();
  ctx.translate(baseX + facing * thrust, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(-0.08);
  ctx.strokeStyle = '#7a4a25';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(27, 0);
  ctx.stroke();
  ctx.fillStyle = '#d8d3bd';
  ctx.beginPath();
  ctx.moveTo(27, 0);
  ctx.lineTo(35, -3);
  ctx.lineTo(35, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBowWeapon(unit, ctx, facing, baseX, baseY, longbow = false) {
  const progress = getAttackProgress(unit);
  const firing = unit.attackAnimationTime > 0;
  const draw = firing ? Math.max(0, 1 - progress * 2.6) : 0.25;
  const length = longbow ? 25 : 19;
  const bend = longbow ? 8 : 6;
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(-0.16);

  ctx.strokeStyle = '#6b3f1f';
  ctx.lineWidth = longbow ? 2.6 : 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, -length * 0.5);
  ctx.quadraticCurveTo(12 + draw * bend, 0, 4, length * 0.5);
  ctx.stroke();

  ctx.strokeStyle = '#e7dbc2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, -length * 0.5);
  ctx.lineTo(-4 - draw * 7, 0);
  ctx.lineTo(4, length * 0.5);
  ctx.stroke();

  if (firing) {
    ctx.strokeStyle = '#cdbb7e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5 - draw * 7, 0);
    ctx.lineTo(17, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrossbowWeapon(unit, ctx, facing, baseX, baseY) {
  const progress = getAttackProgress(unit);
  const recoil = unit.attackAnimationTime > 0 ? Math.sin(progress * Math.PI) * -4 : 0;
  ctx.save();
  ctx.translate(baseX + facing * recoil, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(-0.05);
  ctx.strokeStyle = '#5b351d';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(19, 0);
  ctx.stroke();
  ctx.strokeStyle = '#8a5b32';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.quadraticCurveTo(15, 0, 6, 8);
  ctx.stroke();
  ctx.strokeStyle = '#e6dfcb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(11, 0);
  ctx.lineTo(6, 8);
  ctx.stroke();
  if (unit.attackAnimationTime > 0 && progress < 0.35) {
    ctx.strokeStyle = '#d8c09a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(28 + progress * 18, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGunWeapon(unit, ctx, facing, baseX, baseY) {
  const progress = getAttackProgress(unit);
  const firing = unit.attackAnimationTime > 0 && progress < 0.34;
  const recoil = unit.attackAnimationTime > 0 ? Math.sin(progress * Math.PI) * -5 : 0;
  ctx.save();
  ctx.translate(baseX + facing * recoil, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#2e302f';
  ctx.fillRect(-2, -3, 16, 5);
  ctx.fillStyle = '#151717';
  ctx.fillRect(3, 2, 5, 7);
  ctx.fillStyle = '#b3aaa0';
  ctx.fillRect(8, -2, 8, 3);
  if (firing) {
    const flash = 1 - progress / 0.34;
    ctx.fillStyle = `rgba(255, 220, 112, ${0.85 * flash})`;
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(31 + flash * 7, 0);
    ctx.lineTo(16, 6);
    ctx.lineTo(20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 147, 52, ${0.65 * flash})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawMuzzleFlash(ctx, x, y, facing, progress, color = '#ffd86f', scale = 1) {
  if (!(progress < 0.36)) return;
  const flash = Math.max(0, 1 - progress / 0.36);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = `rgba(255, 230, 128, ${0.82 * flash})`;
  ctx.beginPath();
  ctx.moveTo(0, -5 * scale);
  ctx.lineTo((16 + flash * 10) * scale, 0);
  ctx.lineTo(0, 5 * scale);
  ctx.lineTo(4 * scale, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.3 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawGenericRangedWeapon(unit, ctx, facing, baseX, baseY) {
  const progress = getAttackProgress(unit);
  const firing = unit.attackAnimationTime > 0;
  const recoil = firing ? Math.sin(progress * Math.PI) * -5 : 0;
  const weaponId = String(unit.weaponId || unit.weapon || '').toLowerCase();
  const isMissile = weaponId.includes('missile') || unit.projectileType === 'missile';
  const isBeam = weaponId.includes('laser') || weaponId.includes('beam') || weaponId.includes('lance');
  const isCannon = weaponId.includes('cannon') || weaponId.includes('plasma') || weaponId.includes('railgun');

  ctx.save();
  ctx.translate(baseX + facing * recoil, baseY);
  ctx.scale(facing, 1);
  ctx.rotate(isMissile ? -0.18 : -0.06);

  ctx.strokeStyle = isBeam ? '#7fe6ff' : isCannon ? '#3d3f43' : '#2e302f';
  ctx.lineWidth = isCannon ? 4.5 : isMissile ? 3.2 : 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(isCannon ? 24 : 18, 0);
  ctx.stroke();

  if (isMissile) {
    ctx.fillStyle = '#5f6267';
    ctx.beginPath();
    ctx.moveTo(17, -4);
    ctx.lineTo(28, 0);
    ctx.lineTo(17, 4);
    ctx.closePath();
    ctx.fill();
  }

  if (firing) {
    if (isBeam && progress < 0.45) {
      const beamAlpha = 1 - progress / 0.45;
      ctx.strokeStyle = `rgba(105, 232, 255, ${0.72 * beamAlpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(42 + beamAlpha * 14, 0);
      ctx.stroke();
    } else {
      drawMuzzleFlash(ctx, isCannon ? 24 : 18, 0, 1, progress, isCannon ? 'rgba(255, 133, 58, 0.75)' : 'rgba(255, 224, 120, 0.75)', isCannon ? 1.15 : 0.85);
    }
  }

  ctx.restore();
}

function drawThrownWeapon(unit, ctx, facing, baseX, baseY, kind = 'rock') {
  const progress = getAttackProgress(unit);
  const windup = unit.attackAnimationTime > 0 ? Math.sin(progress * Math.PI) : 0;
  const throwForward = unit.attackAnimationTime > 0 ? Math.max(0, progress - 0.32) * 24 : 0;
  ctx.save();
  ctx.translate(baseX + facing * throwForward, baseY - windup * 7);
  ctx.scale(facing, 1);
  ctx.rotate(-0.95 + windup * 1.65);

  ctx.strokeStyle = '#5f341d';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(11, 0);
  ctx.stroke();

  if (kind === 'grenade') {
    ctx.fillStyle = '#3f4736';
    ctx.beginPath();
    ctx.arc(15, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c2318';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (unit.attackAnimationTime > 0 && progress < 0.25) {
      ctx.strokeStyle = '#dba348';
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.quadraticCurveTo(23, -8, 27, -4);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#8a7f6d';
    ctx.beginPath();
    ctx.ellipse(15, 0, 4.6, 3.4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawUnitAttackWeapon(unit, ctx, riderYOffset = 0) {
  const weaponId = String(unit.weaponId || unit.weapon || '').toLowerCase();
  const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
  const baseX = unit.x + facing * 7;
  const baseY = unit.y - 2 + riderYOffset;

  if (weaponId.includes('sword') || (unit.melee && !weaponId.includes('lance'))) {
    drawSwordWeapon(unit, ctx, facing, baseX, baseY, unit.unitType === 'king' || unit.unitType === 'knight' ? 19 : 17);
    return;
  }
  if (weaponId.includes('lance') || weaponId.includes('spear')) {
    drawLanceWeapon(unit, ctx, facing, baseX, baseY);
    return;
  }
  if (weaponId.includes('longbow')) {
    drawBowWeapon(unit, ctx, facing, baseX, baseY, true);
    return;
  }
  if (weaponId.includes('bow') && !weaponId.includes('cross')) {
    drawBowWeapon(unit, ctx, facing, baseX, baseY, false);
    return;
  }
  if (weaponId.includes('crossbow')) {
    drawCrossbowWeapon(unit, ctx, facing, baseX, baseY);
    return;
  }
  if (weaponId.includes('pistol') || weaponId.includes('gun') || unit.projectileType === 'bullet') {
    drawGunWeapon(unit, ctx, facing, baseX, baseY);
    return;
  }
  if (weaponId.includes('grenade') || unit.projectileType === 'grenade') {
    drawThrownWeapon(unit, ctx, facing, baseX, baseY, 'grenade');
    return;
  }
  if (weaponId.includes('sling') || weaponId.includes('rock')) {
    drawThrownWeapon(unit, ctx, facing, baseX, baseY, 'rock');
    return;
  }

  if (unit.melee) {
    drawSwordWeapon(unit, ctx, facing, baseX, baseY);
  } else {
    drawGenericRangedWeapon(unit, ctx, facing, baseX, baseY);
  }
}

function drawVehicleAttackAnimation(unit, ctx, muzzleX, muzzleY, facing, scale = 1) {
  if (!unit.attackAnimationTime || !unit.attackAnimationDuration) return;
  const progress = getAttackProgress(unit);
  drawMuzzleFlash(ctx, muzzleX, muzzleY, facing, progress, 'rgba(255, 198, 73, 0.8)', scale);
}

function drawAirAttackAnimation(unit, ctx, facing) {
  if (!unit.attackAnimationTime || !unit.attackAnimationDuration) return;
  const progress = getAttackProgress(unit);
  const weaponId = String(unit.weaponId || unit.weapon || '').toLowerCase();
  const muzzleY = unit.y - 10 + Math.sin(progress * Math.PI) * -1.5;
  if (weaponId.includes('laser') || weaponId.includes('beam') || weaponId.includes('lance')) {
    const alpha = Math.max(0, 1 - progress / 0.42);
    if (alpha <= 0) return;
    ctx.save();
    ctx.strokeStyle = `rgba(112, 230, 255, ${0.68 * alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(unit.x + facing * 9, muzzleY);
    ctx.lineTo(unit.x + facing * (42 + alpha * 16), muzzleY - 2);
    ctx.stroke();
    ctx.restore();
  } else {
    drawMuzzleFlash(ctx, unit.x + facing * 13, muzzleY, facing, progress, 'rgba(255, 220, 96, 0.75)', 0.9);
  }
}

function getWorkerToolAnimation(unit) {
  const job = unit.workerJob;
  const animation = unit.workerGatherAnimation;
  if (!job || job.type !== 'gather' || !animation || !animation.target) return null;
  if (job.resourceType !== 'gold' && job.resourceType !== 'stone' && job.resourceType !== 'wood') return null;
  const phase = Math.max(0, Math.min(1, animation.progress || 0));
  const cycle = Math.sin((phase * Math.PI * 8) % (Math.PI * 2));
  return {
    resourceType: job.resourceType,
    cycle,
    impact: cycle > 0.72,
    target: animation.target
  };
}

function drawWorkerGatherTool(unit, ctx, riderYOffset = 0) {
  const animation = getWorkerToolAnimation(unit);
  if (!animation) return;

  const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
  const isWood = animation.resourceType === 'wood';
  const toolX = unit.x + facing * 7;
  const toolY = unit.y - 3 + riderYOffset;
  const swing = -0.35 + animation.cycle * 0.95;

  ctx.save();
  ctx.translate(toolX, toolY);
  ctx.scale(facing, 1);
  ctx.rotate(isWood ? -0.95 + swing : -1.25 + swing);

  ctx.strokeStyle = '#6b4324';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();

  if (isWood) {
    ctx.fillStyle = '#b8c0bd';
    ctx.strokeStyle = '#4d5652';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(19, -7);
    ctx.lineTo(27, -3);
    ctx.lineTo(25, 5);
    ctx.lineTo(18, 7);
    ctx.lineTo(21, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#b9c0bc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(27, 0);
    ctx.lineTo(16, 6);
    ctx.stroke();
  }
  ctx.restore();

  if (animation.impact) {
    const dx = animation.target.x - unit.x;
    const dy = animation.target.y - unit.y;
    const length = Math.hypot(dx, dy) || 1;
    const hitX = unit.x + dx / length * Math.min(length, tileSize * 0.55);
    const hitY = unit.y + dy / length * Math.min(length, tileSize * 0.55);
    ctx.save();
    ctx.strokeStyle = isWood ? 'rgba(130, 82, 37, 0.7)' : 'rgba(238, 218, 128, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = unit.heading + (i - 1) * 0.75;
      ctx.moveTo(hitX, hitY);
      ctx.lineTo(hitX + Math.cos(angle) * 8, hitY + Math.sin(angle) * 5);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawConstructionDozer(unit, ctx, isMoving) {
  const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
  const teamColor = typeof getTeamColor === 'function'
    ? getTeamColor(unit.team)
    : (unit.team === 'red' ? '#c63c3c' : '#3e69d7');
  const workPhase = unit.workerJob?.type === 'build' && unit.workerGatherAnimation
    ? Math.sin((unit.workerGatherAnimation.progress || 0) * Math.PI * 10)
    : 0;
  const bladeJitter = unit.workerJob?.type === 'build' ? workPhase * 1.4 : 0;
  const treadOffset = isMoving ? ((unit.spriteFrame || 0) % 4) : 0;

  ctx.save();
  ctx.translate(unit.x, unit.y + 2);
  ctx.scale(facing, 1);

  ctx.fillStyle = 'rgba(25, 12, 5, 0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 10, 23, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#242827';
  ctx.fillRect(-18, 5, 35, 8);
  ctx.fillStyle = '#151817';
  ctx.fillRect(-19, 7, 37, 5);
  ctx.fillStyle = '#6b6f64';
  for (let x = -15; x <= 13; x += 7) {
    ctx.beginPath();
    ctx.arc(x + treadOffset, 9, 3.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#c79b3b';
  ctx.strokeStyle = '#5b4522';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect?.(-15, -7, 29, 15, 4);
  if (!ctx.roundRect) {
    ctx.rect(-15, -7, 29, 15);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = teamColor;
  ctx.fillRect(-13, -5, 12, 11);

  ctx.fillStyle = '#8db1b8';
  ctx.strokeStyle = '#314449';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(11, -7);
  ctx.lineTo(13, 3);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ece2b5';
  ctx.fillRect(-12, -1, 11, 2);
  ctx.fillStyle = '#43351d';
  for (let x = -12; x < -2; x += 4) {
    ctx.fillRect(x, -2, 2, 4);
  }

  ctx.save();
  ctx.translate(19 + bladeJitter, 4);
  ctx.fillStyle = '#9ca09a';
  ctx.strokeStyle = '#4f5653';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(13, -9);
  ctx.lineTo(15, 6);
  ctx.lineTo(-4, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#3f4543';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.lineTo(-1, -4);
  ctx.moveTo(-8, 4);
  ctx.lineTo(-1, 5);
  ctx.stroke();
  ctx.restore();

  if (unit.workerJob?.type === 'build' && workPhase > 0.65) {
    ctx.strokeStyle = 'rgba(255, 216, 95, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(30, 5);
    ctx.lineTo(39, 1);
    ctx.moveTo(31, 8);
    ctx.lineTo(40, 10);
    ctx.stroke();
  }

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

  if (unit.movementType === 'air' || unit.unitType === 'balloon') {
    const bob = Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 1.2;
    const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(25, 12, 5, 0.18)';
    ctx.beginPath();
    ctx.ellipse(unit.x + 4, unit.y + 13, tileSize * 0.35, tileSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5b3a1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(unit.x - 8, unit.y - 3 + bob);
    ctx.lineTo(unit.x - 5, unit.y + 13);
    ctx.moveTo(unit.x + 8, unit.y - 3 + bob);
    ctx.lineTo(unit.x + 5, unit.y + 13);
    ctx.stroke();
    ctx.fillStyle = typeof getTeamColor === 'function' ? getTeamColor(unit.team) : '#c85c45';
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y - 12 + bob, 13, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4324';
    ctx.fillRect(unit.x - 7, unit.y + 11, 14, 8);
    ctx.restore();
    drawAirAttackAnimation(unit, ctx, facing);
    return;
  }

  const isMoving = unit.hasActivePath ? unit.hasActivePath() : !!unit.target;
  const stride = isMoving ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 1.4 : 0;

  if (unit.model === 'construction_dozer' || unit.unitType === 'mw_dozer') {
    drawConstructionDozer(unit, ctx, isMoving);
    const facing = unit.spriteDirectionRow === 1 ? -1 : 1;
    drawVehicleAttackAnimation(unit, ctx, unit.x + facing * 30, unit.y + 6, facing, 0.8);
    if (unit.selected) {
      const barWidth = tileSize * 1.05;
      const barHeight = 4;
      const barX = unit.x - barWidth / 2;
      const barY = unit.y - unit.size - 14;
      const hpRatio = Math.max(0, unit.hp / unit.maxHp);
      ctx.fillStyle = 'rgba(41, 24, 12, 0.9)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = hpRatio > 0.5 ? '#5bbf55' : hpRatio > 0.25 ? '#d8a733' : '#a8362e';
      ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
      ctx.strokeStyle = 'rgba(255, 225, 151, 0.75)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    return;
  }

  const hasMount = drawUnitMount(unit, ctx, isMoving, stride);
  const riderYOffset = hasMount ? -8 : 0;
  const legColor = '#332318';
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
    ctx.fillStyle = typeof getTeamColor === 'function' ? getTeamColor(unit.team) : (unit.team === 'red' ? '#c63c3c' : '#3e69d7');
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, unit.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const shirtColor = typeof getTeamColor === 'function' ? getTeamColor(unit.team) : (unit.team === 'red' ? '#d84545' : unit.team === 'blue' ? '#4c78ff' : null);
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
    ctx.fillStyle = typeof getTeamColor === 'function' ? getTeamColor(unit.team) : (unit.team === 'red' ? '#a53030' : '#315fc4');
    ctx.beginPath();
    ctx.ellipse(unit.x - facing * 8, unit.y - 1, 3.4, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (unit.unitType === 'king') {
    ctx.fillStyle = '#e6b83f';
    ctx.strokeStyle = '#6e4b12';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(unit.x - 8, unit.y - 13);
    ctx.lineTo(unit.x - 7, unit.y - 22);
    ctx.lineTo(unit.x - 2, unit.y - 17);
    ctx.lineTo(unit.x, unit.y - 24);
    ctx.lineTo(unit.x + 3, unit.y - 17);
    ctx.lineTo(unit.x + 8, unit.y - 22);
    ctx.lineTo(unit.x + 8, unit.y - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (unit.unitType === 'scout' && !unit.mountType) {
    ctx.fillStyle = '#704521';
    ctx.fillRect(unit.x - 10, unit.y + 1, 20, 3);
  }

  if (unit.unitType === 'worker') {
    drawWorkerGatherTool(unit, ctx, riderYOffset);
  }

  drawUnitAttackWeapon(unit, ctx, 0);

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
