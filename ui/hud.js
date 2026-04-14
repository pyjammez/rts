let hudRoot = null;
let miniMapCanvas = null;
let miniMapCtx = null;
let redCountEl = null;
let blueCountEl = null;

function initHUD() {
  hudRoot = document.getElementById('hud');
  miniMapCanvas = document.getElementById('miniMapCanvas');
  redCountEl = document.getElementById('redCount');
  blueCountEl = document.getElementById('blueCount');

  if (miniMapCanvas) {
    miniMapCtx = miniMapCanvas.getContext('2d');
  }

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

  // Camera viewport
  const vw = (camera.viewportWidth / camera.zoom / getMapWidthPx()) * w;
  const vh = (camera.viewportHeight / camera.zoom / getMapHeightPx()) * h;
  const vx = (camera.x / getMapWidthPx()) * w;
  const vy = (camera.y / getMapHeightPx()) * h;

  miniMapCtx.strokeStyle = '#ffffff';
  miniMapCtx.lineWidth = 1;
  miniMapCtx.strokeRect(vx, vy, vw, vh);
}

function renderHUD() {
  if (!hudRoot || hudRoot.style.display === 'none') return;
  updateTeamCounts();
  renderMiniMap();
}

document.addEventListener('DOMContentLoaded', initHUD);
