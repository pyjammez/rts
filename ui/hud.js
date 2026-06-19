let hudRoot = null;
let miniMapCanvas = null;
let miniMapCtx = null;
let redCountEl = null;
let blueCountEl = null;
let selectedInfoEl = null;

function initHUD() {
  hudRoot = document.getElementById('hud');
  miniMapCanvas = document.getElementById('miniMapCanvas');
  redCountEl = document.getElementById('redCount');
  blueCountEl = document.getElementById('blueCount');
  selectedInfoEl = document.getElementById('selectedInfo');

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
  renderMiniMap();
}

function updateSelectedInfo() {
  if (!selectedInfoEl) return;
  const selectedUnits = Array.isArray(units)
    ? units.filter(unit => unit.selected && !unit.isDead)
    : [];

  if (selectedUnits.length === 1) {
    renderSelectedUnitInfo(selectedUnits[0]);
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

  selectedInfoEl.style.display = 'none';
  selectedInfoEl.textContent = '';
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
      ${createInfoStat('Team', unit.team)}
      ${createInfoStat('Unit Type', unit.unitType || 'soldier')}
      ${createInfoStat('Status', unit.attackOrderTarget ? 'Attacking' : unit.hasActivePath && unit.hasActivePath() ? 'Moving' : 'Idle')}
    </div>
  `;
}

function renderSelectedWorldObjectInfo(object) {
  const isObstacle = object.objectType === 'obstacle';
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
      <span class="selected-info-tag">${isObstacle ? 'Natural obstacle' : 'Wildlife'}</span>
    </div>
    <div class="selected-info-grid">
      ${createInfoStat('Hit Points', hp)}
      ${createInfoStat('Team', object.team || 'neutral')}
      ${isObstacle ? createInfoStat('Material', object.material || 'Natural') : createInfoStat('Habitat', object.habitat || 'Land')}
      ${isObstacle ? createInfoStat('Hardness', object.hardness || 'Unknown') : createInfoStat('Speed', Math.round(object.speed || 0))}
      ${createInfoStat('Status', status)}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', initHUD);
