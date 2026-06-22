let hudRoot = null;
let miniMapCanvas = null;
let miniMapCtx = null;
let redCountEl = null;
let blueCountEl = null;
let selectedInfoEl = null;
let unitActionsEl = null;
let attackAtWillAction = null;
let holdFireAction = null;
let pickUpItemAction = null;
let dropItemAction = null;
let cookAction = null;
let upgradeCastleAction = null;
let unitActionStatus = null;
let actionMessage = '';
let actionMessageUntil = 0;
let itemActionTargetMode = null;

function initHUD() {
  hudRoot = document.getElementById('hud');
  miniMapCanvas = document.getElementById('miniMapCanvas');
  redCountEl = document.getElementById('redCount');
  blueCountEl = document.getElementById('blueCount');
  selectedInfoEl = document.getElementById('selectedInfo');
  unitActionsEl = document.getElementById('unitActions');
  attackAtWillAction = document.getElementById('attackAtWillAction');
  holdFireAction = document.getElementById('holdFireAction');
  pickUpItemAction = document.getElementById('pickUpItemAction');
  dropItemAction = document.getElementById('dropItemAction');
  cookAction = document.getElementById('cookAction');
  upgradeCastleAction = document.getElementById('upgradeCastleAction');
  unitActionStatus = document.getElementById('unitActionStatus');
  const bottomEdgeScrollZone = document.getElementById('bottomEdgeScrollZone');

  const updateBottomEdgeScroll = event => {
    inputState.mouseInside = true;
    inputState.southEdgeActive = true;
    inputState.mouseX = event.clientX;
    inputState.mouseY = Math.max(0, event.currentTarget.getBoundingClientRect().bottom - 1);
  };
  bottomEdgeScrollZone?.addEventListener('mouseenter', updateBottomEdgeScroll);
  bottomEdgeScrollZone?.addEventListener('mousemove', updateBottomEdgeScroll);
  bottomEdgeScrollZone?.addEventListener('mouseleave', () => {
    inputState.southEdgeActive = false;
    inputState.mouseInside = false;
  });
  bottomEdgeScrollZone?.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof handleCameraGesture === 'function') {
      handleCameraGesture(event, event.clientX, event.clientY);
    }
  }, { passive: false });

  attackAtWillAction?.addEventListener('click', () => setSelectedUnitsFireStance('attack_at_will'));
  holdFireAction?.addEventListener('click', () => setSelectedUnitsFireStance('hold_fire'));
  pickUpItemAction?.addEventListener('click', () => toggleItemActionTargeting('pickup'));
  dropItemAction?.addEventListener('click', () => toggleItemActionTargeting('drop'));
  cookAction?.addEventListener('click', () => toggleItemActionTargeting('cook'));
  upgradeCastleAction?.addEventListener('click', () => toggleItemActionTargeting('upgrade-castle'));

  if (miniMapCanvas) {
    miniMapCtx = miniMapCanvas.getContext('2d');
    miniMapCanvas.addEventListener('click', handleMiniMapClick);
    miniMapCanvas.addEventListener('pointerdown', handleMiniMapClick);
  }

  document.addEventListener('pointerdown', handleMiniMapPointerCapture, true);

  const spawnRed = document.getElementById('spawnRed');
  const spawnBlue = document.getElementById('spawnBlue');

  if (spawnRed) {
    spawnRed.addEventListener('click', () => {
      spawnUnitForTeam('red');
      updateTeamCounts();
    });
  }

  if (spawnBlue) {
    spawnBlue.addEventListener('click', () => {
      spawnUnitForTeam('blue');
      updateTeamCounts();
    });
  }
}

function showHUD() {
  if (!hudRoot) initHUD();
  if (hudRoot) hudRoot.style.display = 'block';
  updateTeamCounts();
}

function updateTeamCounts() {
  if (!redCountEl || !blueCountEl || !Array.isArray(units)) return;
  const sourceUnits = (window.gameRuntime && Array.isArray(window.gameRuntime.aliveUnits))
    ? window.gameRuntime.aliveUnits
    : units;

  let red = 0;
  let blue = 0;

  for (const u of sourceUnits) {
    if (u.isDead) continue;
    if (u.team === 'red') red++;
    if (u.team === 'blue') blue++;
  }

  redCountEl.textContent = String(red);
  blueCountEl.textContent = String(blue);
}

function terrainMiniColor(type) {
  if (type === TERRAIN.WATER) return '#2f78b7';
  if (type === TERRAIN.SAND) return '#c8b560';
  if (type === TERRAIN.GRASS) return '#2f7a3a';
  return '#8a5a34';
}

function renderMiniMap() {
  if (!miniMapCtx || !terrainData || terrainData.length === 0) return;

  const w = miniMapCanvas.width;
  const h = miniMapCanvas.height;
  const cellW = w / MAP_COLS;
  const cellH = h / MAP_ROWS;

  miniMapCtx.clearRect(0, 0, w, h);

  // Terrain
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      miniMapCtx.fillStyle = terrainMiniColor(terrainData[y][x]);
      miniMapCtx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  // Obstacles
  if (obstacleData && obstacleData.length > 0) {
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const obs = obstacleData[y][x];
        if (obs === OBSTACLE.NONE) continue;
        miniMapCtx.fillStyle = obs === OBSTACLE.TREE ? '#1f4f1f' : '#666';
        miniMapCtx.fillRect(x * cellW, y * cellH, Math.max(1, cellW * 0.9), Math.max(1, cellH * 0.9));
      }
    }
  }

  // Units
  const sourceUnits = (window.gameRuntime && Array.isArray(window.gameRuntime.aliveUnits))
    ? window.gameRuntime.aliveUnits
    : units;
  if (Array.isArray(sourceUnits)) {
    for (const u of sourceUnits) {
      if (u.isDead) continue;
      const px = (u.x / getMapWidthPx()) * w;
      const py = (u.y / getMapHeightPx()) * h;
      miniMapCtx.fillStyle = u.team === 'red' ? '#ff4a4a' : '#59a0ff';
      miniMapCtx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  if (Array.isArray(sheepData)) {
    miniMapCtx.fillStyle = '#eadfca';
    for (const sheep of sheepData) {
      if (sheep.isMounted) continue;
      const px = (sheep.x / getMapWidthPx()) * w;
      const py = (sheep.y / getMapHeightPx()) * h;
      miniMapCtx.fillRect(px - 0.5, py - 0.5, 2, 2);
    }
  }

  if (Array.isArray(horseData)) {
    miniMapCtx.fillStyle = '#9a6336';
    for (const horse of horseData) {
      if (horse.isDead) continue;
      const px = (horse.x / getMapWidthPx()) * w;
      const py = (horse.y / getMapHeightPx()) * h;
      miniMapCtx.fillRect(px - 1, py - 1, 2.5, 2.5);
    }
  }

  if (Array.isArray(window.itemData)) {
    miniMapCtx.fillStyle = '#f0c35a';
    for (const item of window.itemData) {
      if (item.isDead || item.isPickedUp) continue;
      const px = (item.x / getMapWidthPx()) * w;
      const py = (item.y / getMapHeightPx()) * h;
      miniMapCtx.fillRect(px - 1, py - 1, 2, 2);
    }
  }

  const buildings = typeof getBuildings === 'function' ? getBuildings() : window.buildingData;
  if (Array.isArray(buildings)) {
    for (const building of buildings) {
      if (building.isDead) continue;
      const px = (building.x / getMapWidthPx()) * w;
      const py = (building.y / getMapHeightPx()) * h;
      const bw = Math.max(3, (building.width * tileSize / getMapWidthPx()) * w);
      const bh = Math.max(3, (building.height * tileSize / getMapHeightPx()) * h);
      miniMapCtx.fillStyle = building.team === 'red' ? '#c63c3c' : '#3e69d7';
      miniMapCtx.fillRect(px - bw * 0.5, py - bh * 0.5, bw, bh);
      miniMapCtx.strokeStyle = '#f8e7ad';
      miniMapCtx.strokeRect(px - bw * 0.5, py - bh * 0.5, bw, bh);
    }
  }

  // Camera viewport
  const vw = (camera.viewportWidth / camera.zoom / getMapWidthPx()) * w;
  const vh = (camera.viewportHeight / camera.zoom / getMapHeightPx()) * h;
  const rawVx = (camera.x / getMapWidthPx()) * w;
  const rawVy = (camera.y / getMapHeightPx()) * h;
  const vx = Math.max(0, Math.min(rawVx, w));
  const vy = Math.max(0, Math.min(rawVy, h));
  const clippedVw = Math.max(0, Math.min(rawVx + vw, w) - vx);
  const clippedVh = Math.max(0, Math.min(rawVy + vh, h) - vy);

  miniMapCtx.strokeStyle = '#ffffff';
  miniMapCtx.lineWidth = 1;
  miniMapCtx.strokeRect(vx, vy, clippedVw, clippedVh);
}

function handleMiniMapClick(e) {
  if (!miniMapCanvas || !camera || !terrainData || terrainData.length === 0) return;
  e.preventDefault();
  e.stopPropagation();

  const rect = miniMapCanvas.getBoundingClientRect();
  const scaleX = miniMapCanvas.width / rect.width;
  const scaleY = miniMapCanvas.height / rect.height;
  const mapX = (e.clientX - rect.left) * scaleX;
  const mapY = (e.clientY - rect.top) * scaleY;
  const worldX = (mapX / miniMapCanvas.width) * getMapWidthPx();
  const worldY = (mapY / miniMapCanvas.height) * getMapHeightPx();

  camera.x = worldX - (camera.viewportWidth / camera.zoom) * 0.5;
  camera.y = worldY - (camera.viewportHeight / camera.zoom) * 0.5;
  clampCameraPosition();
}

function handleMiniMapPointerCapture(e) {
  if (!miniMapCanvas || !camera || !terrainData || terrainData.length === 0) return;

  const rect = miniMapCanvas.getBoundingClientRect();
  const insideMiniMap = e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom;

  if (!insideMiniMap) return;
  handleMiniMapClick(e);
}

function renderHUD() {
  if (!hudRoot || hudRoot.style.display === 'none') return;
  updateTeamCounts();
  updateSelectedInfo();
  updateUnitActions();
  renderMiniMap();
}

function getSelectedLivingUnits() {
  return Array.isArray(units) ? units.filter(unit => unit.selected && !unit.isDead) : [];
}

function setActionMessage(message) {
  actionMessage = message;
  actionMessageUntil = performance.now() + 1800;
}

function setSelectedUnitsFireStance(stance) {
  const selectedUnits = getSelectedLivingUnits();
  if (selectedUnits.length === 0) return;
  selectedUnits.forEach(unit => {
    OpenRTS.commands.enqueue({
      type: OpenRTS.commands.types.FIRE_STANCE,
      payload: { unitId: unit.id, stance }
    });
  });
  setActionMessage(stance === 'hold_fire' ? 'Selected units will hold fire' : 'Selected units will attack at will');
  updateUnitActions();
}

function toggleItemActionTargeting(mode) {
  if (itemActionTargetMode === mode) {
    cancelItemActionTargeting();
    return;
  }
  const selectedUnits = getSelectedLivingUnits();
  const eligible = mode === 'pickup'
    ? selectedUnits.some(unit => !unit.inventoryItem)
    : mode === 'drop'
      ? selectedUnits.some(unit => !!unit.inventoryItem)
      : mode === 'upgrade-castle'
        ? selectedUnits.some(unit => unit.unitType === 'king')
        : selectedUnits.length > 0;
  if (!eligible) return;
  itemActionTargetMode = mode;
  actionMessageUntil = 0;
  updateUnitActions();
}

function cancelItemActionTargeting(message = 'Item action cancelled') {
  if (!itemActionTargetMode) return;
  itemActionTargetMode = null;
  if (message) setActionMessage(message);
  updateUnitActions();
}

function getItemActionTargetMode() {
  return itemActionTargetMode;
}

function handleItemActionTarget(worldX, worldY) {
  if (!itemActionTargetMode) return false;
  const selectedUnits = getSelectedLivingUnits();

  if (itemActionTargetMode === 'upgrade-castle') {
    const king = selectedUnits.find(unit => unit.unitType === 'king');
    const building = typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(worldX, worldY) : null;
    if (!king || !building || building.type !== 'home' || building.team !== king.team) {
      setActionMessage('Click your king\'s castle');
      return true;
    }
    if (building.upgradeLevel >= building.maxUpgradeLevel) {
      setActionMessage('That castle is fully upgraded');
      return true;
    }
    OpenRTS.commands.enqueue({
      type: OpenRTS.commands.types.CASTLE_UPGRADE,
      payload: { kingId: king.id, buildingId: building.id }
    });
    itemActionTargetMode = null;
    setActionMessage('Castle upgrade ordered');
    if (typeof addCommandClickMarker === 'function') addCommandClickMarker(building.x, building.y, 'green');
    updateUnitActions();
    return true;
  }

  if (itemActionTargetMode === 'cook') {
    const sheep = typeof getSheepAtPoint === 'function' ? getSheepAtPoint(worldX, worldY) : null;
    if (!sheep) {
      setActionMessage('Click a living sheep');
      return true;
    }
    const team = selectedUnits[0]?.team;
    if (!team) return true;
    OpenRTS.commands.enqueue({
      type: OpenRTS.commands.types.COOK,
      payload: { sheepId: sheep.id, team }
    });
    itemActionTargetMode = null;
    setActionMessage('Roast cooking for 10 seconds');
    if (typeof addCommandClickMarker === 'function') addCommandClickMarker(sheep.x, sheep.y, 'green');
    updateUnitActions();
    return true;
  }

  if (itemActionTargetMode === 'pickup') {
    const item = (typeof getWorldItemAtPoint === 'function' && getWorldItemAtPoint(worldX, worldY)) ||
      (typeof getObstacleAtPoint === 'function' && getObstacleAtPoint(worldX, worldY));
    if (!item || !item.pickupable || item.isDead || item.isPickedUp) {
      setActionMessage('Click a tree, rock, or item');
      return true;
    }
    const unit = selectedUnits.find(candidate => !candidate.inventoryItem);
    if (!unit) {
      setActionMessage('No selected unit can pick that up');
      return true;
    }
    OpenRTS.commands.enqueue({
      type: OpenRTS.commands.types.PICK_UP,
      payload: {
        unitId: unit.id,
        targetId: item.id,
        targetKind: item.objectType === 'obstacle' ? 'obstacle' : 'item'
      }
    });
    itemActionTargetMode = null;
    setActionMessage(`${unit.displayName || 'Unit'} moving to pick up ${item.displayName || 'item'}`);
    if (typeof addCommandClickMarker === 'function') addCommandClickMarker(item.x, item.y, 'green');
    updateUnitActions();
    return true;
  }

  const carryingUnits = selectedUnits.filter(unit => unit.inventoryItem);
  let ordered = 0;
  carryingUnits.forEach((unit, index) => {
    const angle = carryingUnits.length > 1 ? index / carryingUnits.length * Math.PI * 2 : 0;
    const radius = carryingUnits.length > 1 ? tileSize * 0.85 : 0;
    OpenRTS.commands.enqueue({
      type: OpenRTS.commands.types.DROP,
      payload: {
        unitId: unit.id,
        x: worldX + Math.cos(angle) * radius,
        y: worldY + Math.sin(angle) * radius
      }
    });
    ordered++;
  });
  if (ordered === 0) {
    setActionMessage('No selected unit can drop an item there');
    return true;
  }
  itemActionTargetMode = null;
  setActionMessage(`${ordered} unit${ordered === 1 ? '' : 's'} moving to the drop location`);
  if (typeof addCommandClickMarker === 'function') addCommandClickMarker(worldX, worldY, 'green');
  updateUnitActions();
  return true;
}

window.getItemActionTargetMode = getItemActionTargetMode;
window.handleItemActionTarget = handleItemActionTarget;
window.cancelItemActionTargeting = cancelItemActionTargeting;

function updateUnitActions() {
  if (!unitActionsEl) return;
  const selectedUnits = getSelectedLivingUnits();
  const hasUnits = selectedUnits.length > 0;
  const allHold = hasUnits && selectedUnits.every(unit => unit.fireStance === 'hold_fire');
  const allAttack = hasUnits && selectedUnits.every(unit => unit.fireStance !== 'hold_fire');
  const canDrop = selectedUnits.some(unit => !!unit.inventoryItem);
  const canPickUp = selectedUnits.some(unit => !unit.inventoryItem);

  if (!hasUnits && itemActionTargetMode) itemActionTargetMode = null;

  for (const button of [attackAtWillAction, holdFireAction, pickUpItemAction, dropItemAction, cookAction, upgradeCastleAction]) {
    if (button) button.disabled = !hasUnits;
  }
  if (pickUpItemAction) pickUpItemAction.disabled = !canPickUp;
  if (dropItemAction) dropItemAction.disabled = !canDrop;
  if (upgradeCastleAction) upgradeCastleAction.disabled = !selectedUnits.some(unit => unit.unitType === 'king');
  attackAtWillAction?.classList.toggle('is-active', allAttack);
  holdFireAction?.classList.toggle('is-active', allHold);
  pickUpItemAction?.classList.toggle('is-active', itemActionTargetMode === 'pickup');
  dropItemAction?.classList.toggle('is-active', itemActionTargetMode === 'drop');
  cookAction?.classList.toggle('is-active', itemActionTargetMode === 'cook');
  upgradeCastleAction?.classList.toggle('is-active', itemActionTargetMode === 'upgrade-castle');
  attackAtWillAction?.setAttribute('aria-pressed', String(allAttack));
  holdFireAction?.setAttribute('aria-pressed', String(allHold));
  pickUpItemAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'pickup'));
  dropItemAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'drop'));
  cookAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'cook'));
  upgradeCastleAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'upgrade-castle'));

  if (!unitActionStatus) return;
  if (itemActionTargetMode === 'pickup') {
    unitActionStatus.textContent = 'Click a tree, rock, or item';
  } else if (itemActionTargetMode === 'drop') {
    unitActionStatus.textContent = 'Click a map location to drop items';
  } else if (itemActionTargetMode === 'cook') {
    unitActionStatus.textContent = 'Click a living sheep to start cooking';
  } else if (itemActionTargetMode === 'upgrade-castle') {
    unitActionStatus.textContent = 'Click your castle to upgrade it';
  } else if (performance.now() < actionMessageUntil) {
    unitActionStatus.textContent = actionMessage;
  } else if (!hasUnits) {
    unitActionStatus.textContent = 'Select a unit';
  } else {
    const stance = allHold ? 'Hold fire' : allAttack ? 'Attack at will' : 'Mixed stance';
    unitActionStatus.textContent = `${selectedUnits.length} selected | ${stance}`;
  }
}

function updateSelectedInfo() {
  if (!selectedInfoEl) return;
  const selectedUnits = getSelectedLivingUnits();

  if (selectedUnits.length === 1) {
    renderSelectedUnitInfo(selectedUnits[0]);
    return;
  }

  if (selectedUnits.length > 1) {
    const team = selectedUnits[0].team;
    const totalHp = selectedUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0);
    const maxHp = selectedUnits.reduce((sum, unit) => sum + unit.maxHp, 0);
    const carrying = selectedUnits.filter(unit => unit.inventoryItem).length;
    selectedInfoEl.innerHTML = `
      <div class="selected-info-name">
        <span>${selectedUnits.length} ${team} units</span>
        <span class="selected-info-tag">Selection</span>
      </div>
      <div class="selected-info-grid">
        ${createInfoStat('Combined HP', `${Math.ceil(totalHp)} / ${maxHp}`)}
        ${createInfoStat('Attack Stance', selectedUnits.every(unit => unit.fireStance === 'hold_fire') ? 'Hold fire' : 'Attack at will')}
        ${createInfoStat('Carrying Items', `${carrying} / ${selectedUnits.length}`)}
        ${createInfoStat('Team', team)}
      </div>
    `;
    return;
  }

  const building = typeof getSelectedBuilding === 'function' ? getSelectedBuilding() : null;

  if (building && !building.isDead) {
    const name = `${building.team} ${building.type}`;
    selectedInfoEl.style.display = 'block';
    selectedInfoEl.innerHTML = `
      <div class="selected-info-name">
        <span>${name}</span>
        <span class="selected-info-tag">Building</span>
      </div>
      <div class="selected-info-grid">
        ${createInfoStat('Hit Points', `${Math.ceil(building.hp)} / ${building.maxHp}`)}
        ${createInfoStat('Attack', building.damage ? building.damage : 'None')}
        ${createInfoStat('Range', building.range ? Math.round(building.range) : 'None')}
        ${building.type === 'home' ? createInfoStat('Upgrade Level', `${building.upgradeLevel || 0} / ${building.maxUpgradeLevel || 3}`) : ''}
        ${createInfoStat('Team', building.team)}
      </div>
    `;
    return;
  }

  const worldObject = typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null;
  if (worldObject) {
    renderSelectedWorldObjectInfo(worldObject);
    return;
  }

  selectedInfoEl.innerHTML = '<div class="command-empty-state">No selection</div>';
}

function createInfoStat(label, value) {
  return `<div class="selected-info-stat"><span>${label}</span><b>${value}</b></div>`;
}

function renderSelectedUnitInfo(unit) {
  const name = unit.displayName || unit.unitType || 'Unit';
  const hp = `${Math.ceil(unit.hp)} / ${unit.maxHp}`;
  const damage = Number.isFinite(Number(unit.damage)) ? unit.damage : 'Unknown';
  const movingDamage = Number.isFinite(Number(unit.movingDamage)) ? unit.movingDamage : 'Unknown';
  const range = Number.isFinite(Number(unit.shootRange)) ? Math.round(unit.shootRange) : 'Unknown';
  const speed = Number.isFinite(Number(unit.speed)) ? Math.round(unit.speed) : 'Unknown';
  const role = unit.role || 'Field unit';
  const weapon = unit.weaponName || unit.weaponId || 'Unknown';
  const splash = Number(unit.splashRadius) > 0
    ? createInfoStat('Splash Radius', Math.round(unit.splashRadius))
    : '';
  const mountStatus = unit.mountType === 'sheep' ? 'Riding sheep' : unit.unitType === 'scout' ? 'Mounted scout' : 'On foot';
  const inventory = unit.inventoryItem?.name || 'Empty';

  selectedInfoEl.style.display = 'block';
  selectedInfoEl.innerHTML = `
    <div class="selected-info-name">
      <span>${unit.team} ${name}</span>
      <span class="selected-info-tag">${role}</span>
    </div>
    <div class="selected-info-grid">
      ${createInfoStat('Hit Points', hp)}
      ${createInfoStat('Weapon', weapon)}
      ${createInfoStat('Weapon Power', damage)}
      ${createInfoStat('Moving Power', movingDamage)}
      ${createInfoStat('Range', range)}
      ${splash}
      ${createInfoStat('Speed', speed)}
      ${createInfoStat('Mount', mountStatus)}
      ${createInfoStat('Inventory', inventory)}
      ${createInfoStat('Fire Stance', unit.fireStance === 'hold_fire' ? 'Hold fire' : 'Attack at will')}
      ${createInfoStat('Team', unit.team)}
      ${createInfoStat('Unit Type', unit.unitType || 'soldier')}
      ${createInfoStat('Status', unit.attackOrderTarget ? 'Attacking' : unit.hasActivePath && unit.hasActivePath() ? 'Moving' : 'Idle')}
    </div>
  `;
}

function renderSelectedWorldObjectInfo(object) {
  const isObstacle = object.objectType === 'obstacle';
  const isItem = object.objectType === 'item';
  const hp = `${Math.ceil(object.hp)} / ${object.maxHp}`;
  const status = object.isDead
    ? 'Destroyed'
    : object.hp < object.maxHp
      ? 'Damaged'
      : object.displayName === 'Duck'
        ? 'Swimming'
        : object.grazeTimer > 0
          ? 'Grazing'
          : isObstacle
            ? 'Intact'
            : 'Wandering';

  selectedInfoEl.style.display = 'block';
  selectedInfoEl.innerHTML = `
    <div class="selected-info-name">
      <span>${object.displayName || 'World Object'}</span>
      <span class="selected-info-tag">${isItem ? 'Item' : isObstacle ? 'Natural obstacle' : 'Wildlife'}</span>
    </div>
    <div class="selected-info-grid">
      ${createInfoStat('Hit Points', hp)}
      ${createInfoStat('Team', object.team || 'neutral')}
      ${isItem ? createInfoStat('Portable', object.pickupable ? 'Yes' : 'No') : isObstacle ? createInfoStat('Material', object.material || 'Natural') : createInfoStat('Habitat', object.habitat || 'Land')}
      ${isItem ? createInfoStat('Item Type', object.itemId || 'item') : isObstacle ? createInfoStat('Hardness', object.hardness || 'Unknown') : createInfoStat('Speed', Math.round(object.speed || 0))}
      ${createInfoStat('Status', status)}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', initHUD);
