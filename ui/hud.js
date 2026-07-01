let hudRoot = null;
let resourceBar = null;
let resourceTeamEl = null;
let resourceGoldEl = null;
let resourceWoodEl = null;
let resourceStoneEl = null;
let resourceFoodEl = null;
let miniMapCanvas = null;
let miniMapCtx = null;
let redCountEl = null;
let blueCountEl = null;
let selectedInfoEl = null;
let unitActionsEl = null;
let constructionActionsEl = null;
let attackAtWillAction = null;
let holdFireAction = null;
let attackMoveAction = null;
let pickUpItemAction = null;
let dropItemAction = null;
let cookAction = null;
let upgradeCastleAction = null;
let mineGoldAction = null;
let mineStoneAction = null;
let chopWoodAction = null;
let gatherFoodAction = null;
let burnHouseAction = null;
let unitActionStatus = null;
let actionMessage = '';
let actionMessageUntil = 0;
let lastMiniMapRenderAt = 0;
const MINI_MAP_RENDER_INTERVAL_MS = 250;

function getCommandTargetMode() {
  return OpenRTS.ui?.commandTargeting?.getMode?.() || null;
}

function initHUD() {
  hudRoot = document.getElementById('hud');
  resourceBar = document.getElementById('resourceBar');
  resourceTeamEl = document.getElementById('resourceTeam');
  resourceGoldEl = document.getElementById('resourceGold');
  resourceWoodEl = document.getElementById('resourceWood');
  resourceStoneEl = document.getElementById('resourceStone');
  resourceFoodEl = document.getElementById('resourceFood');
  miniMapCanvas = document.getElementById('miniMapCanvas');
  redCountEl = document.getElementById('redCount');
  blueCountEl = document.getElementById('blueCount');
  selectedInfoEl = document.getElementById('selectedInfo');
  unitActionsEl = document.getElementById('unitActions');
  constructionActionsEl = document.getElementById('constructionActions');
  attackAtWillAction = document.getElementById('attackAtWillAction');
  holdFireAction = document.getElementById('holdFireAction');
  attackMoveAction = document.getElementById('attackMoveAction');
  pickUpItemAction = document.getElementById('pickUpItemAction');
  dropItemAction = document.getElementById('dropItemAction');
  cookAction = document.getElementById('cookAction');
  upgradeCastleAction = document.getElementById('upgradeCastleAction');
  mineGoldAction = document.getElementById('mineGoldAction');
  mineStoneAction = document.getElementById('mineStoneAction');
  chopWoodAction = document.getElementById('chopWoodAction');
  gatherFoodAction = document.getElementById('gatherFoodAction');
  burnHouseAction = document.getElementById('burnHouseAction');
  unitActionStatus = document.getElementById('unitActionStatus');
  OpenRTS.ui.commandTargeting?.configure({
    getSelectedUnits: getSelectedLivingUnits,
    setMessage: setActionMessage,
    clearMessage: () => { actionMessageUntil = 0; },
    updateActions: updateUnitActions,
    addMarker: typeof addCommandClickMarker === 'function' ? addCommandClickMarker : null
  });
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
  attackMoveAction?.addEventListener('click', () => toggleItemActionTargeting('attack-move'));
  pickUpItemAction?.addEventListener('click', () => toggleItemActionTargeting('pickup'));
  dropItemAction?.addEventListener('click', () => toggleItemActionTargeting('drop'));
  cookAction?.addEventListener('click', () => toggleItemActionTargeting('cook'));
  upgradeCastleAction?.addEventListener('click', () => toggleItemActionTargeting('upgrade-castle'));
  mineGoldAction?.addEventListener('click', () => toggleItemActionTargeting('mine-gold'));
  mineStoneAction?.addEventListener('click', () => toggleItemActionTargeting('mine-stone'));
  chopWoodAction?.addEventListener('click', () => toggleItemActionTargeting('chop-wood'));
  gatherFoodAction?.addEventListener('click', () => toggleItemActionTargeting('gather-food'));
  burnHouseAction?.addEventListener('click', () => toggleItemActionTargeting('burn-house'));
  constructionActionsEl?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-building-type]');
    if (!button || button.disabled) return;
    toggleItemActionTargeting(`build:${button.dataset.buildingType}`);
  });

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
  if (resourceBar) resourceBar.style.display = 'flex';
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
  return OpenRTS.rendering.canvas.minimap.terrainColor(type, TERRAIN);
}

function renderMiniMap() {
  if (!miniMapCtx || !terrainData || terrainData.length === 0) return;
  const now = performance.now();
  if (now - lastMiniMapRenderAt < MINI_MAP_RENDER_INTERVAL_MS) return;
  lastMiniMapRenderAt = now;
  const sourceUnits = (window.gameRuntime && Array.isArray(window.gameRuntime.aliveUnits))
    ? window.gameRuntime.aliveUnits
    : units;
  const goldMines = typeof getGoldMines === 'function' ? getGoldMines() : window.goldMineData;
  const houses = typeof getHouses === 'function' ? getHouses() : window.houseData;
  const buildings = typeof getBuildings === 'function' ? getBuildings() : window.buildingData;
  OpenRTS.rendering.canvas.minimap.render(miniMapCtx, {
    canvas: miniMapCanvas,
    terrainData,
    obstacleData,
    rows: MAP_ROWS,
    columns: MAP_COLS,
    tileSize,
    dimensions: { width: getMapWidthPx(), height: getMapHeightPx() },
    terrain: TERRAIN,
    obstacle: OBSTACLE,
    units: Array.isArray(sourceUnits) ? sourceUnits : [],
    sheep: Array.isArray(sheepData) ? sheepData : [],
    horses: Array.isArray(horseData) ? horseData : [],
    items: Array.isArray(window.itemData) ? window.itemData : [],
    goldMines: Array.isArray(goldMines) ? goldMines : [],
    houses: Array.isArray(houses) ? houses : [],
    buildings: Array.isArray(buildings) ? buildings : [],
    camera,
    teamColor: team => typeof getTeamColor === 'function' ? getTeamColor(team) : (team === 'red' ? '#ff4a4a' : '#59a0ff')
  });
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
  updateResourceBar();
  updateTeamCounts();
  updateSelectedInfo();
  updateUnitActions();
  renderMiniMap();
}

function getLocalResourceTeam() {
  const config = window.mapConfig || mapConfig || {};
  const humanSlot = Array.isArray(config.playerSlots)
    ? config.playerSlots.find(slot => slot.controller === 'human')
    : null;
  if (humanSlot?.flag) return humanSlot.flag;
  const teams = typeof getConfiguredTeams === 'function' ? getConfiguredTeams(config) : config.teams;
  return Array.isArray(teams) && teams[0] ? teams[0] : 'red';
}

function updateResourceBar() {
  if (!resourceBar || !OpenRTS.systems.resources) return;
  const team = getLocalResourceTeam();
  const resources = OpenRTS.systems.resources.get(team);
  if (resourceTeamEl) resourceTeamEl.textContent = team;
  if (resourceGoldEl) resourceGoldEl.textContent = String(resources.gold);
  if (resourceWoodEl) resourceWoodEl.textContent = String(resources.wood);
  if (resourceStoneEl) resourceStoneEl.textContent = String(resources.stone);
  if (resourceFoodEl) resourceFoodEl.textContent = String(resources.food);
}

function getSelectedLivingUnits() {
  return Array.isArray(units) ? units.filter(unit => unit.selected && !unit.isDead) : [];
}

function isBuilderUnit(unit) {
  if (OpenRTS.systems.workerEconomy?.isWorker?.(unit)) return true;
  const tags = Array.isArray(unit?.tags) ? unit.tags : [];
  return unit?.unitType === 'worker' || unit?.model === 'worker' || tags.includes('worker') || tags.includes('builder') || tags.includes('villager');
}

function formatResourceCost(cost = {}) {
  const entries = Object.entries(cost)
    .filter(([, value]) => Number(value) > 0)
    .map(([resource, value]) => `${value} ${resource}`);
  return entries.length ? entries.join(', ') : 'Free';
}

function getBuildableBuildingsForUnit(unit) {
  if (!unit || !isBuilderUnit(unit)) return [];
  const config = window.mapConfig || mapConfig || {};
  const faction = typeof getConfiguredFactionForTeam === 'function'
    ? getConfiguredFactionForTeam(unit.team, config)
    : null;
  const ids = Array.isArray(faction?.buildings) && faction.buildings.length
    ? faction.buildings
    : ['tower'];
  const seen = new Set();
  return ids
    .filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(id => typeof getBuildingDefinition === 'function' ? getBuildingDefinition(id) : null)
    .filter(Boolean);
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
  OpenRTS.ui.commandTargeting?.toggle(mode);
}

function cancelItemActionTargeting(message = 'Item action cancelled') {
  OpenRTS.ui.commandTargeting?.cancel(message);
}

function getItemActionTargetMode() {
  return getCommandTargetMode();
}

function handleItemActionTarget(worldX, worldY) {
  return !!OpenRTS.ui.commandTargeting?.targetAt(worldX, worldY);
}

window.getItemActionTargetMode = getItemActionTargetMode;
window.handleItemActionTarget = handleItemActionTarget;
window.cancelItemActionTargeting = cancelItemActionTargeting;
window.toggleItemActionTargeting = toggleItemActionTargeting;

function updateUnitActions() {
  if (!unitActionsEl) return;
  const selectedUnits = getSelectedLivingUnits();
  const hasUnits = selectedUnits.length > 0;
  const allHold = hasUnits && selectedUnits.every(unit => unit.fireStance === 'hold_fire');
  const allAttack = hasUnits && selectedUnits.every(unit => unit.fireStance !== 'hold_fire');
  const canDrop = selectedUnits.some(unit => !!unit.inventoryItem);
  const canPickUp = selectedUnits.some(unit => !unit.inventoryItem);
  const hasWorker = selectedUnits.some(isBuilderUnit);

  const itemActionTargetMode = getCommandTargetMode();
  if (!hasUnits && itemActionTargetMode) OpenRTS.ui.commandTargeting?.cancel('');
  renderConstructionActions(selectedUnits, itemActionTargetMode);

  for (const button of [
    attackAtWillAction,
    holdFireAction,
    attackMoveAction,
    pickUpItemAction,
    dropItemAction,
    cookAction,
    upgradeCastleAction,
    mineGoldAction,
    mineStoneAction,
    chopWoodAction,
    gatherFoodAction,
    burnHouseAction
  ]) {
    if (button) button.disabled = !hasUnits;
  }
  if (pickUpItemAction) pickUpItemAction.disabled = !canPickUp;
  if (dropItemAction) dropItemAction.disabled = !canDrop;
  if (upgradeCastleAction) upgradeCastleAction.disabled = !selectedUnits.some(unit => unit.unitType === 'king');
  for (const button of [mineGoldAction, mineStoneAction, chopWoodAction, gatherFoodAction]) {
    if (button) button.disabled = !hasWorker;
  }
  attackAtWillAction?.classList.toggle('is-active', allAttack);
  holdFireAction?.classList.toggle('is-active', allHold);
  attackMoveAction?.classList.toggle('is-active', itemActionTargetMode === 'attack-move');
  pickUpItemAction?.classList.toggle('is-active', itemActionTargetMode === 'pickup');
  dropItemAction?.classList.toggle('is-active', itemActionTargetMode === 'drop');
  cookAction?.classList.toggle('is-active', itemActionTargetMode === 'cook');
  upgradeCastleAction?.classList.toggle('is-active', itemActionTargetMode === 'upgrade-castle');
  mineGoldAction?.classList.toggle('is-active', itemActionTargetMode === 'mine-gold');
  mineStoneAction?.classList.toggle('is-active', itemActionTargetMode === 'mine-stone');
  chopWoodAction?.classList.toggle('is-active', itemActionTargetMode === 'chop-wood');
  gatherFoodAction?.classList.toggle('is-active', itemActionTargetMode === 'gather-food');
  burnHouseAction?.classList.toggle('is-active', itemActionTargetMode === 'burn-house');
  attackAtWillAction?.setAttribute('aria-pressed', String(allAttack));
  holdFireAction?.setAttribute('aria-pressed', String(allHold));
  attackMoveAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'attack-move'));
  pickUpItemAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'pickup'));
  dropItemAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'drop'));
  cookAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'cook'));
  upgradeCastleAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'upgrade-castle'));
  mineGoldAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'mine-gold'));
  mineStoneAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'mine-stone'));
  chopWoodAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'chop-wood'));
  gatherFoodAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'gather-food'));
  burnHouseAction?.setAttribute('aria-pressed', String(itemActionTargetMode === 'burn-house'));

  if (!unitActionStatus) return;
  if (itemActionTargetMode === 'attack-move') {
    unitActionStatus.textContent = 'Click a map location to attack-move';
  } else if (itemActionTargetMode === 'pickup') {
    unitActionStatus.textContent = 'Click a tree, rock, or item';
  } else if (itemActionTargetMode === 'drop') {
    unitActionStatus.textContent = 'Click a map location to drop items';
  } else if (itemActionTargetMode === 'cook') {
    unitActionStatus.textContent = 'Click a living sheep to start cooking';
  } else if (itemActionTargetMode === 'upgrade-castle') {
    unitActionStatus.textContent = 'Click your castle to upgrade it';
  } else if (itemActionTargetMode === 'mine-gold') {
    unitActionStatus.textContent = 'Click a gold mine';
  } else if (itemActionTargetMode === 'mine-stone') {
    unitActionStatus.textContent = 'Click a rock outcrop';
  } else if (itemActionTargetMode === 'chop-wood') {
    unitActionStatus.textContent = 'Click a tree';
  } else if (itemActionTargetMode === 'gather-food') {
    unitActionStatus.textContent = 'Click a living sheep or duck';
  } else if (itemActionTargetMode === 'build-tower' || String(itemActionTargetMode || '').startsWith('build:')) {
    const buildingType = itemActionTargetMode === 'build-tower' ? 'tower' : itemActionTargetMode.slice('build:'.length);
    const building = typeof getBuildingDefinition === 'function' ? getBuildingDefinition(buildingType) : null;
    const cost = OpenRTS.systems.workerEconomy?.getBuildCost?.(buildingType) || {};
    unitActionStatus.textContent = `Click a build location for ${building?.name || 'building'} (${formatResourceCost(cost)})`;
  } else if (itemActionTargetMode === 'burn-house') {
    unitActionStatus.textContent = 'Click an intact house to burn it';
  } else if (performance.now() < actionMessageUntil) {
    unitActionStatus.textContent = actionMessage;
  } else if (!hasUnits) {
    unitActionStatus.textContent = 'Select a unit';
  } else {
    const stance = allHold ? 'Hold fire' : allAttack ? 'Attack at will' : 'Mixed stance';
    unitActionStatus.textContent = `${selectedUnits.length} selected | ${stance}`;
  }
}

function renderConstructionActions(selectedUnits, itemActionTargetMode) {
  if (!constructionActionsEl) return;
  const builder = selectedUnits.find(isBuilderUnit);
  if (!builder) {
    constructionActionsEl.innerHTML = '<div class="command-empty-state compact">Select a builder</div>';
    return;
  }

  const buildings = getBuildableBuildingsForUnit(builder);
  if (!buildings.length) {
    constructionActionsEl.innerHTML = '<div class="command-empty-state compact">No buildings</div>';
    return;
  }

  const activeMode = itemActionTargetMode || '';
  const resources = OpenRTS.systems.resources;
  constructionActionsEl.innerHTML = buildings.map(building => {
    const cost = OpenRTS.systems.workerEconomy?.getBuildCost?.(building.id) || building.cost || {};
    const canAfford = !resources || resources.canAfford(builder.team, cost);
    const mode = `build:${building.id}`;
    const active = activeMode === mode || (activeMode === 'build-tower' && building.id === 'tower');
    return `
      <button class="command-action construction-action${active ? ' is-active' : ''}" type="button"
        data-building-type="${building.id}" aria-pressed="${active}" ${canAfford ? '' : 'disabled'}
        title="${formatResourceCost(cost)}">
        <span>${building.name || building.id}</span>
        <small>${formatResourceCost(cost)}</small>
      </button>
    `;
  }).join('');
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
        ${createInfoStat('HP', `${Math.ceil(totalHp)} / ${maxHp}`)}
        ${createInfoStat('Stance', selectedUnits.every(unit => unit.fireStance === 'hold_fire') ? 'Hold fire' : 'Attack')}
        ${createInfoStat('Items', `${carrying} / ${selectedUnits.length}`)}
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
        ${createInfoStat('HP', `${Math.ceil(building.hp)} / ${building.maxHp}`)}
        ${createInfoStat('Attack', building.damage ? building.damage : 'None')}
        ${createInfoStat('Range', building.range ? Math.round(building.range) : 'None')}
        ${building.type === 'home' ? createInfoStat('Upg.', `${building.upgradeLevel || 0} / ${building.maxUpgradeLevel || 3}`) : ''}
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
  const range = Number.isFinite(Number(unit.shootRange)) ? Math.round(unit.shootRange) : 'Unknown';
  const speed = Number.isFinite(Number(unit.speed)) ? Math.round(unit.speed) : 'Unknown';
  const role = unit.role || 'Field unit';
  const weapon = unit.weaponName || unit.weaponId || 'Unknown';
  const splash = Number(unit.splashRadius) > 0
    ? createInfoStat('Splash', Math.round(unit.splashRadius))
    : '';
  const mountStatus = unit.mountType === 'sheep' ? 'Riding sheep' : unit.unitType === 'scout' ? 'Mounted scout' : 'On foot';
  const inventory = unit.inventoryItem?.name || 'Empty';
  const workerStatus = isBuilderUnit(unit)
    ? createInfoStat('Job', unit.workerJob ? `${unit.workerJob.type} ${unit.workerJob.resourceType || unit.workerJob.buildingType}` : 'Idle')
    : '';
  const status = unit.attackOrderTarget ? 'Attacking' : unit.hasActivePath && unit.hasActivePath() ? 'Moving' : 'Idle';

  selectedInfoEl.style.display = 'block';
  selectedInfoEl.innerHTML = `
    <div class="selected-info-name">
      <span>${unit.team} ${name}</span>
      <span class="selected-info-tag">${role}</span>
    </div>
    <div class="selected-info-grid">
      ${createInfoStat('HP', hp)}
      ${createInfoStat('Weapon', weapon)}
      ${createInfoStat('Power', damage)}
      ${createInfoStat('Range', range)}
      ${splash}
      ${createInfoStat('Speed', speed)}
      ${createInfoStat('Mount', mountStatus)}
      ${createInfoStat('Inventory', inventory)}
      ${workerStatus}
      ${createInfoStat('Stance', unit.fireStance === 'hold_fire' ? 'Hold' : 'Attack')}
      ${createInfoStat('Status', status)}
    </div>
  `;
}

function renderSelectedWorldObjectInfo(object) {
  const isObstacle = object.objectType === 'obstacle';
  const isItem = object.objectType === 'item';
  const isResource = object.objectType === 'resource';
  const isHouse = object.objectType === 'house';
  const hp = `${Math.ceil(object.hp)} / ${object.maxHp}`;
  const status = object.isDead
    ? 'Destroyed'
    : isHouse && object.isWreck
      ? 'Burnt wreck'
    : isHouse && object.burning
      ? `Burning (${Math.ceil(object.burnTimer)}s)`
    : isResource
      ? 'Available'
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
      <span class="selected-info-tag">${isHouse ? 'House' : isResource ? 'Resource' : isItem ? 'Item' : isObstacle ? 'Natural obstacle' : 'Wildlife'}</span>
    </div>
    <div class="selected-info-grid">
      ${createInfoStat('HP', hp)}
      ${isHouse ? createInfoStat('Occupants', `${object.occupants?.length || 0}`) : isResource ? createInfoStat('Resource', object.resourceType || 'Unknown') : isItem ? createInfoStat('Portable', object.pickupable ? 'Yes' : 'No') : isObstacle ? createInfoStat('Material', object.material || 'Natural') : createInfoStat('Habitat', object.habitat || 'Land')}
      ${isHouse ? createInfoStat('Roof', object.occupants?.length ? 'Open' : 'Covered') : isResource ? createInfoStat('Remaining', Math.ceil(object.amount || 0)) : isItem ? createInfoStat('Item Type', object.itemId || 'item') : isObstacle ? createInfoStat('Hardness', object.hardness || 'Unknown') : createInfoStat('Speed', Math.round(object.speed || 0))}
      ${createInfoStat('Status', status)}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', initHUD);
