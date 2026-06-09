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
  if (!inputState.mouseInside) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;

  if (inputState.mouseX <= camera.edgeScrollMargin) x -= 1;
  if (inputState.mouseX >= camera.viewportWidth - camera.edgeScrollMargin) x += 1;
  if (inputState.mouseY <= camera.edgeScrollMargin) y -= 1;
  if (inputState.mouseY >= camera.viewportHeight - camera.edgeScrollMargin) y += 1;

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
  return Math.min(fitX, fitY);
}

function clampCameraPosition() {
  const visibleWorldWidth = camera.viewportWidth / camera.zoom;
  const visibleWorldHeight = camera.viewportHeight / camera.zoom;
  const mapWidth = getMapWidthPx();
  const mapHeight = getMapHeightPx();

  if (visibleWorldWidth >= mapWidth) {
    camera.x = (mapWidth - visibleWorldWidth) * 0.5;
  } else {
    const maxX = mapWidth - visibleWorldWidth;
    camera.x = Math.max(0, Math.min(camera.x, maxX));
  }

  if (visibleWorldHeight >= mapHeight) {
    camera.y = (mapHeight - visibleWorldHeight) * 0.5;
  } else {
    const maxY = mapHeight - visibleWorldHeight;
    camera.y = Math.max(0, Math.min(camera.y, maxY));
  }
}

function zoomAtScreenPoint(screenX, screenY, zoomFactor) {
  const worldBefore = screenToWorld(screenX, screenY);
  const minZoom = getMinZoomToFitMap();

  camera.zoom = Math.max(minZoom, Math.min(camera.zoom * zoomFactor, camera.maxZoom));

  camera.x = worldBefore.x - screenX / camera.zoom;
  camera.y = worldBefore.y - screenY / camera.zoom;
  clampCameraPosition();
}

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
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y
  };
}

function update(dt) {
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

  updateBullets(dt);

  removeCollisions(aliveUnits, { rebuildSpatialHash: false });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  renderMap();
  if (typeof renderWorldObjects === 'function') {
    renderWorldObjects(gameRuntime.aliveUnits, ctx, DEBUG);
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

function initializeGame() {
  console.log('Initializing game with config:', mapConfig);
  regenerateMapData();
  spawnInitialUnits();
  if (typeof showHUD === 'function') showHUD();
  requestAnimationFrame(gameLoop);
}
