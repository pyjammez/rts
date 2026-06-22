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

const runtime = OpenRTS.runtime;
const gameRuntime = runtime.setContext({
  units,
  camera,
  debug: DEBUG,
  input: inputState,
  bullets: OpenRTS.systems.projectiles.getProjectiles()
});
window.gameRuntime = gameRuntime;

OpenRTS.diagnostics.simulation.bindStateProvider(() => ({
  frame: runtime.frame,
  seed: OpenRTS.random.getSeed(),
  modeId: (window.mapConfig || mapConfig || {}).modeId,
  units,
  buildings: OpenRTS.world.runtime.get('buildings'),
  sheep: OpenRTS.world.runtime.get('sheep'),
  ducks: OpenRTS.world.runtime.get('ducks'),
  horses: OpenRTS.world.runtime.get('horses'),
  projectiles: OpenRTS.systems.projectiles.getProjectiles()
}));

OpenRTS.commands.bindFrameProvider(() => runtime.frame);

function findEntityById(collection, id) {
  return (Array.isArray(collection) ? collection : []).find(entity => String(entity.id) === String(id)) || null;
}

function resolveUnit(id) {
  return findEntityById(units, id);
}

function resolveBuilding(id) {
  return findEntityById(OpenRTS.world.runtime.get('buildings'), id);
}

function resolveCommandTarget(kind, id) {
  if (kind === 'unit') return resolveUnit(id);
  if (kind === 'building') return resolveBuilding(id);
  const collectionName = {
    sheep: 'sheep',
    duck: 'ducks',
    horse: 'horses',
    item: 'items',
    obstacle: 'obstacleEntities'
  }[kind];
  return collectionName ? findEntityById(OpenRTS.world.runtime.get(collectionName), id) : null;
}

function registerGameplayCommandHandlers() {
  const commandTypes = OpenRTS.commands.types;
  OpenRTS.commands.register(commandTypes.MOVE, command => {
    const unit = resolveUnit(command.payload.unitId);
    if (!unit || unit.isDead) return false;
    if (!command.payload.append && typeof clearCastleTopCommand === 'function') clearCastleTopCommand(unit);
    unit.issueMoveCommand(command.payload.x, command.payload.y, { append: !!command.payload.append });
    return true;
  });
  OpenRTS.commands.register(commandTypes.ATTACK, command => {
    const unit = resolveUnit(command.payload.unitId);
    const target = resolveCommandTarget(command.payload.targetKind, command.payload.targetId);
    if (!unit || unit.isDead || !target || target.isDead) return false;
    unit.issueAttackCommand(target, { append: !!command.payload.append });
    return true;
  });
  OpenRTS.commands.register(commandTypes.MOUNT, command => {
    const unit = resolveUnit(command.payload.unitId);
    const sheep = resolveCommandTarget('sheep', command.payload.sheepId);
    if (!unit || unit.isDead || !sheep) return false;
    unit.issueMountCommand(sheep, { append: !!command.payload.append });
    return true;
  });
  OpenRTS.commands.register(commandTypes.PICK_UP, command => {
    const unit = resolveUnit(command.payload.unitId);
    const item = resolveCommandTarget(command.payload.targetKind, command.payload.targetId);
    return !!unit && !unit.isDead && !!item && unit.issuePickupCommand(item);
  });
  OpenRTS.commands.register(commandTypes.DROP, command => {
    const unit = resolveUnit(command.payload.unitId);
    return !!unit && !unit.isDead && unit.issueDropItemCommand(command.payload.x, command.payload.y);
  });
  OpenRTS.commands.register(commandTypes.FIRE_STANCE, command => {
    const unit = resolveUnit(command.payload.unitId);
    if (!unit || unit.isDead) return false;
    unit.setFireStance(command.payload.stance);
    return true;
  });
  OpenRTS.commands.register(commandTypes.COOK, command => {
    const sheep = resolveCommandTarget('sheep', command.payload.sheepId);
    if (!sheep) return false;
    return !!OpenRTS.systems.cooking.start({
      sheep,
      team: command.payload.team,
      removeSheep: removeSheepFromMap,
      tileSize
    });
  });
  OpenRTS.commands.register(commandTypes.CASTLE_UPGRADE, command => {
    const king = resolveUnit(command.payload.kingId);
    const building = resolveBuilding(command.payload.buildingId);
    return OpenRTS.systems.castleUpgrades.upgrade(building, king);
  });
  OpenRTS.commands.register(commandTypes.CASTLE_ENTER, command => {
    const unit = resolveUnit(command.payload.unitId);
    const building = resolveBuilding(command.payload.buildingId);
    if (!unit || !building) return false;
    return commandUnitIntoCastle(
      unit,
      building,
      { x: command.payload.x, y: command.payload.y },
      !!command.payload.append,
      command.payload.laneIndex || 0
    );
  });
  OpenRTS.commands.register(commandTypes.CASTLE_EXIT, command => {
    const unit = resolveUnit(command.payload.unitId);
    const building = resolveBuilding(command.payload.buildingId);
    if (!unit || !building) return false;
    return commandUnitOutOfCastle(
      unit,
      building,
      { x: command.payload.x, y: command.payload.y },
      !!command.payload.append,
      command.payload.laneIndex || 0
    );
  });
  OpenRTS.commands.register(commandTypes.CASTLE_RAMPART, command => {
    const unit = resolveUnit(command.payload.unitId);
    const building = resolveBuilding(command.payload.buildingId);
    if (!unit || !building) return false;
    return commandUnitToCastleTop(
      unit,
      building,
      command.payload.index || 0,
      command.payload.total || 1,
      !!command.payload.append,
      command.payload.targetX,
      command.payload.targetY
    );
  });
}

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

function refreshRuntimeUnits() {
  if (window.entityManager && typeof window.entityManager.syncUnits === 'function') {
    window.entityManager.syncUnits(units);
  }

  const aliveUnits = window.entityManager && typeof window.entityManager.getAliveUnits === 'function'
    ? window.entityManager.getAliveUnits()
    : units.filter(unit => !unit.isDead);
  gameRuntime.aliveUnits = aliveUnits;
  gameRuntime.ecsAliveUnits = aliveUnits;
  gameRuntime.bullets = OpenRTS.systems.projectiles.getProjectiles();

  if (typeof syncUnitComponentsFromUnits === 'function') {
    syncUnitComponentsFromUnits(aliveUnits);
  }
}

function getProjectileTargets(x, y, radius) {
  const targets = [];
  if (typeof getUnitsNearPoint === 'function') targets.push(...getUnitsNearPoint(x, y, radius));
  else targets.push(...units);
  if (typeof getLiveSheepNearPoint === 'function') targets.push(...getLiveSheepNearPoint(x, y, radius));
  if (typeof getLiveDucksNearPoint === 'function') targets.push(...getLiveDucksNearPoint(x, y, radius));
  if (typeof getLiveHorsesNearPoint === 'function') targets.push(...getLiveHorsesNearPoint(x, y, radius));
  if (typeof getLiveBuildingsNearPoint === 'function') targets.push(...getLiveBuildingsNearPoint(x, y, radius));
  return targets;
}

function registerRuntimeSystems() {
  if (runtime.hasSystem('camera')) return;

  runtime.registerSystem({ id: 'camera', order: 10, update: updateCamera });
  runtime.registerSystem({
    id: 'command-markers',
    order: 20,
    update: dt => {
      if (typeof updateCommandClickMarkers === 'function') updateCommandClickMarkers(dt);
    }
  });
  runtime.registerSystem({ id: 'entity-sync', order: 30, update: refreshRuntimeUnits });
  runtime.registerSystem({
    id: 'commands',
    order: 35,
    update: () => OpenRTS.commands.process(runtime.frame, gameRuntime)
  });
  runtime.registerSystem({
    id: 'game-mode',
    order: 40,
    update: dt => {
      if (typeof updateActiveGameMode === 'function') updateActiveGameMode(dt, gameRuntime.aliveUnits);
    }
  });
  runtime.registerSystem({
    id: 'wildlife',
    order: 50,
    update: dt => OpenRTS.systems.wildlife.update(dt, {
      sheep: OpenRTS.world.runtime.get('sheep'),
      ducks: OpenRTS.world.runtime.get('ducks'),
      horses: OpenRTS.world.runtime.get('horses')
    }, {
      random: wildlifeRandom,
      isWalkable: isCommandWalkablePoint,
      isDuckPreferred: isDuckPreferredPoint
    })
  });
  runtime.registerSystem({
    id: 'cooking',
    order: 60,
    update: dt => OpenRTS.systems.cooking.update(dt, gameRuntime.aliveUnits)
  });
  runtime.registerSystem({
    id: 'movement',
    order: 70,
    update: dt => {
      if (typeof updateUnitMovementSystem === 'function') updateUnitMovementSystem(gameRuntime.aliveUnits, dt);
    }
  });
  runtime.registerSystem({
    id: 'spatial-index',
    order: 80,
    update: () => {
      if (typeof buildUnitSpatialHash === 'function') buildUnitSpatialHash(gameRuntime.aliveUnits, 64);
    }
  });
  runtime.registerSystem({
    id: 'combat',
    order: 90,
    update: dt => {
      if (typeof updateUnitCombatSystem === 'function') updateUnitCombatSystem(gameRuntime.aliveUnits, dt);
    }
  });
  runtime.registerSystem({
    id: 'buildings',
    order: 100,
    update: dt => OpenRTS.systems.buildingCombat.update(dt, {
      buildings: OpenRTS.world.runtime.get('buildings'),
      units: gameRuntime.aliveUnits
    }, {
      homeType: BUILDING_TYPES.HOME,
      towerType: BUILDING_TYPES.TOWER,
      tileSize,
      getRampartDefender: getCastleTopDefender,
      spawnProjectile: projectile => {
        return !!OpenRTS.systems.projectiles.spawn(projectile);
      }
    })
  });
  runtime.registerSystem({
    id: 'projectiles',
    order: 110,
    update: dt => OpenRTS.systems.projectiles.update(dt, {
      queryPadding: tileSize,
      queryTargets: getProjectileTargets,
      getBounds: () => ({ width: getMapWidthPx(), height: getMapHeightPx() })
    })
  });
  runtime.registerSystem({
    id: 'collisions',
    order: 120,
    update: () => removeCollisions(gameRuntime.aliveUnits, { rebuildSpatialHash: false })
  });
  runtime.registerSystem({
    id: 'match-rules',
    order: 130,
    update: () => {
      if (typeof updateGameFinishRules === 'function') {
        updateGameFinishRules(units.filter(unit => !unit.isDead));
      }
    }
  });
}

function update(dt) {
  if (typeof isGameSessionActive === 'function' && !isGameSessionActive()) return;
  if (typeof isGameSessionFinished === 'function' && isGameSessionFinished()) return;
  runtime.update(dt);
}

function render2DScene() {
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
  OpenRTS.systems.projectiles.render2D(ctx);
  if (typeof renderCommandClickMarkers === 'function') {
    renderCommandClickMarkers(ctx);
  }
  ctx.restore();

  renderWorldAtmosphere();
  return true;
}

function registerRenderers() {
  if (OpenRTS.rendering.describe().renderers.length > 0) return;

  OpenRTS.rendering.register({
    id: 'three',
    priority: 100,
    available: () => typeof use3DRenderer === 'function' &&
      use3DRenderer() &&
      typeof render3DScene === 'function',
    render: () => render3DScene(units)
  });
  OpenRTS.rendering.register({
    id: 'canvas-2d',
    priority: 0,
    render: render2DScene
  });
}

function render() {
  OpenRTS.rendering.render({ runtime, units, camera });
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
  runtime.resetClock();
  OpenRTS.commands.clear();
  OpenRTS.systems.projectiles.reset();
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

registerGameplayCommandHandlers();
registerRuntimeSystems();
registerRenderers();
