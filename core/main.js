const DEBUG = {
  showPaths: false,
  showRawPaths: false,
  showIllegalMoves: false
};

const camera = {
  x: 0,
  y: 0,
  speed: 700,
  edgeScrollMargin: 24,
  zoom: 1,
  minZoom3D: 0.22,
  maxZoom: 2.5,
  viewportWidth: canvas.width,
  viewportHeight: canvas.height
};

// Centralized runtime references used across systems.
const gameRuntime = {
  get units() { return units; },
  aliveUnits: [],
  ecsAliveUnits: [],
  get bullets() { return window.bullets || []; },
  camera,
  debug: DEBUG,
  input: inputState
};
window.gameRuntime = gameRuntime;

function getEdgeScrollDirection() {
  if (!inputState.mouseInside && !inputState.southEdgeActive) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;
  const commandBar = document.querySelector('.command-bar');
  const commandBarRect = commandBar?.getBoundingClientRect();
  const commandBarVisible = !!commandBarRect &&
    commandBarRect.width > 0 &&
    commandBarRect.height > 0 &&
    getComputedStyle(commandBar).display !== 'none';
  const bottomEdge = commandBarVisible
    ? Math.max(camera.edgeScrollMargin, Math.min(camera.viewportHeight, commandBarRect.top))
    : camera.viewportHeight;
  const bottomScrollMargin = Math.max(camera.edgeScrollMargin, 40);

  if (inputState.mouseInside) {
    if (inputState.mouseX <= camera.edgeScrollMargin) x -= 1;
    if (inputState.mouseX >= camera.viewportWidth - camera.edgeScrollMargin) x += 1;
    if (inputState.mouseY <= camera.edgeScrollMargin) y -= 1;
    if (inputState.mouseY >= bottomEdge - bottomScrollMargin && inputState.mouseY <= bottomEdge) y += 1;
  }
  if (inputState.southEdgeActive) y = 1;

  return { x, y };
}

function toggleDebugFlag(flagName) {
  if (!(flagName in DEBUG)) return;
  DEBUG[flagName] = !DEBUG[flagName];
  console.log(`${flagName}: ${DEBUG[flagName] ? 'ON' : 'OFF'}`);
}

function getMinZoomToFitMap() {
  const fitX = canvas.width / getMapWidthPx();
  const fitY = canvas.height / getMapHeightPx();
  const flatFit = Math.min(fitX, fitY);
  const is3D = typeof use3DRenderer === 'function' && use3DRenderer();

  if (is3D) {
    return Math.min(flatFit, camera.minZoom3D);
  }

  return flatFit;
}

function getCameraOverscan() {
  const visibleWorldWidth = camera.viewportWidth / camera.zoom;
  const visibleWorldHeight = camera.viewportHeight / camera.zoom;
  const is3D = typeof use3DRenderer === 'function' && use3DRenderer();

  if (is3D) {
    return {
      x: Math.max(tileSize * 6, visibleWorldWidth * 0.28),
      y: Math.max(tileSize * 9, visibleWorldHeight * 0.42)
    };
  }

  return {
    x: Math.max(tileSize * 2, visibleWorldWidth * 0.08),
    y: Math.max(tileSize * 2, visibleWorldHeight * 0.08)
  };
}

function clampCameraPosition() {
  const visibleWorldWidth = camera.viewportWidth / camera.zoom;
  const visibleWorldHeight = camera.viewportHeight / camera.zoom;
  const mapWidth = getMapWidthPx();
  const mapHeight = getMapHeightPx();
  const overscan = getCameraOverscan();
  const minX = -overscan.x;
  const maxX = mapWidth - visibleWorldWidth + overscan.x;
  const minY = -overscan.y;
  const maxY = mapHeight - visibleWorldHeight + overscan.y;

  if (minX > maxX) {
    camera.x = (minX + maxX) * 0.5;
  } else {
    camera.x = Math.max(minX, Math.min(camera.x, maxX));
  }

  if (minY > maxY) {
    camera.y = (minY + maxY) * 0.5;
  } else {
    camera.y = Math.max(minY, Math.min(camera.y, maxY));
  }
}

function zoomAtScreenPoint(screenX, screenY, zoomFactor) {
  const is3D = typeof use3DRenderer === 'function' && use3DRenderer() && typeof refresh3DCameraMatrices === 'function';
  if (is3D) refresh3DCameraMatrices();

  const worldBefore = screenToWorld(screenX, screenY);
  const minZoom = getMinZoomToFitMap();
  const nextZoom = Math.max(minZoom, Math.min(camera.zoom * zoomFactor, camera.maxZoom));

  if (nextZoom === camera.zoom) return;
  camera.zoom = nextZoom;

  if (is3D && worldBefore) {
    refresh3DCameraMatrices();
    const worldAfter = screenToWorld(screenX, screenY);

    if (worldAfter) {
      camera.x += worldBefore.x - worldAfter.x;
      camera.y += worldBefore.y - worldAfter.y;
      clampCameraPosition();
      refresh3DCameraMatrices();
      return;
    }
  }

  camera.x = worldBefore.x - screenX / camera.zoom;
  camera.y = worldBefore.y - screenY / camera.zoom;
  clampCameraPosition();
}

function zoomToFullMap() {
  camera.zoom = getMinZoomToFitMap();
  camera.x = getMapWidthPx() * 0.5 - (camera.viewportWidth / camera.zoom) * 0.5;
  camera.y = getMapHeightPx() * 0.5 - (camera.viewportHeight / camera.zoom) * 0.5;
  clampCameraPosition();
}

window.zoomToFullMap = zoomToFullMap;
window.zoomAtScreenPoint = zoomAtScreenPoint;
window.getEdgeScrollDirection = getEdgeScrollDirection;

function updateCamera(dt) {
  camera.viewportWidth = canvas.width;
  camera.viewportHeight = canvas.height;

  const minZoom = getMinZoomToFitMap();
  if (camera.zoom < minZoom) {
    camera.zoom = minZoom;
  }

  const edge = getEdgeScrollDirection();
  const moveX = ((inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)) + edge.x;
  const moveY = ((inputState.down ? 1 : 0) - (inputState.up ? 1 : 0)) + edge.y;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    camera.x += (moveX / length) * camera.speed * dt;
    camera.y += (moveY / length) * camera.speed * dt;
  }

  clampCameraPosition();
}

function screenToWorld(screenX, screenY) {
  if (typeof use3DRenderer === 'function' && use3DRenderer() && typeof get3DWorldPoint === 'function') {
    const point = get3DWorldPoint(screenX, screenY);
    if (point) return point;
  }

  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y
  };
}

window.screenToWorld = screenToWorld;

function update(dt) {
  if (typeof isGameSessionActive === 'function' && !isGameSessionActive()) return;
  if (typeof isGameSessionFinished === 'function' && isGameSessionFinished()) return;

  updateCamera(dt);

  if (typeof updateCommandClickMarkers === 'function') {
    updateCommandClickMarkers(dt);
  }

  if (window.entityManager && typeof window.entityManager.syncUnits === 'function') {
    window.entityManager.syncUnits(units);
  }

  const aliveUnits = window.entityManager && typeof window.entityManager.getAliveUnits === 'function'
    ? window.entityManager.getAliveUnits()
    : units.filter(unit => !unit.isDead);
  gameRuntime.aliveUnits = aliveUnits;
  gameRuntime.ecsAliveUnits = aliveUnits;

  if (typeof syncUnitComponentsFromUnits === 'function') {
    syncUnitComponentsFromUnits(aliveUnits);
  }

  if (typeof updateActiveGameMode === 'function') {
    updateActiveGameMode(dt, aliveUnits);
  }

  if (typeof updateSheep === 'function') {
    updateSheep(dt);
  }

  if (typeof updateDucks === 'function') {
    updateDucks(dt);
  }

  if (typeof updateHorses === 'function') {
    updateHorses(dt);
  }

  if (typeof updateUnitMovementSystem === 'function') {
    updateUnitMovementSystem(aliveUnits, dt);
  }

  // Build broad-phase index before combat/projectile queries.
  if (typeof buildUnitSpatialHash === 'function') {
    buildUnitSpatialHash(aliveUnits, 64);
  }

  if (typeof updateUnitCombatSystem === 'function') {
    updateUnitCombatSystem(aliveUnits, dt);
  }

  if (typeof updateBuildings === 'function') {
    updateBuildings(dt, aliveUnits);
  }

  updateBullets(dt);

  removeCollisions(aliveUnits, { rebuildSpatialHash: false });

  if (typeof updateGameFinishRules === 'function') {
    updateGameFinishRules(units.filter(unit => !unit.isDead));
  }
}

function render() {
  if (typeof use3DRenderer === 'function' && use3DRenderer() && typeof render3DScene === 'function') {
    if (render3DScene(units)) {
      renderSelectionBox();
      if (typeof renderHUD === 'function') renderHUD();
      return;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  renderMap();
  if (typeof renderWorldObjects === 'function') {
    renderWorldObjects(units, ctx, DEBUG);
  } else if (typeof renderUnitSystem === 'function') {
    renderUnitSystem(gameRuntime.aliveUnits, ctx, DEBUG);
  }
  renderBullets(ctx);
  if (typeof renderCommandClickMarkers === 'function') {
    renderCommandClickMarkers(ctx);
  }
  ctx.restore();

  renderWorldAtmosphere();
  renderSelectionBox();
  if (typeof renderHUD === 'function') renderHUD();
}

function renderWorldAtmosphere() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sunWash = ctx.createLinearGradient(0, 0, w, h);
  sunWash.addColorStop(0, 'rgba(255, 220, 145, 0.26)');
  sunWash.addColorStop(0.48, 'rgba(255, 220, 145, 0.06)');
  sunWash.addColorStop(1, 'rgba(62, 37, 18, 0.12)');
  ctx.fillStyle = sunWash;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'multiply';
  const vignette = ctx.createRadialGradient(
    w * 0.5,
    h * 0.42,
    Math.min(w, h) * 0.12,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72
  );
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(0.68, 'rgba(95, 57, 24, 0.1)');
  vignette.addColorStop(1, 'rgba(22, 11, 4, 0.46)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#f7df9b';
  for (let i = 0; i < 120; i++) {
    const x = (i * 97 + MAP_SEED % 311) % w;
    const y = (i * 53 + MAP_SEED % 197) % h;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function applyInitialCameraForMode() {
  const config = window.mapConfig || mapConfig || {};
  if (config.modeId !== 'unit_comparison') return;

  camera.x = getMapWidthPx() * 0.5 - (camera.viewportWidth / camera.zoom) * 0.5;
  camera.y = getMapHeightPx() * 0.5 - (camera.viewportHeight / camera.zoom) * 0.5;
  clampCameraPosition();
}

function initializeGame() {
  console.log('Initializing game with config:', mapConfig);
  if (typeof resetGameSession === 'function') resetGameSession();
  regenerateMapData();
  spawnInitialUnits();
  if (typeof startGameSession === 'function') startGameSession(window.mapConfig || mapConfig || {});
  applyInitialCameraForMode();
  if (typeof showHUD === 'function') showHUD();
  if (typeof startGameLoop === 'function') {
    startGameLoop();
  } else {
    requestAnimationFrame(gameLoop);
  }
}
