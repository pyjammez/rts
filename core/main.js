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
  simulation: OpenRTS.simulation.context,
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

OpenRTS.runtime.matchSnapshots?.bindStateProvider?.(() => ({
  frame: runtime.frame,
  seed: OpenRTS.random.getSeed(),
  modeId: (window.mapConfig || mapConfig || {}).modeId,
  config: window.mapConfig || mapConfig || {},
  entityRegistry: window.entityManager,
  resources: window.playerResources || {}
}));

OpenRTS.commands.bindFrameProvider(() => runtime.frame);

const gameplayCommandHandlers = OpenRTS.commands.gameplayHandlers.createRegistrar({
  units,
  worldRuntime: OpenRTS.world.runtime,
  systems: OpenRTS.systems,
  tileSize,
  removeSheepFromMap: typeof removeSheepFromMap === 'function' ? removeSheepFromMap : null,
  commandUnitIntoHouse: typeof commandUnitIntoHouse === 'function' ? commandUnitIntoHouse : null,
  commandUnitOutOfHouse: typeof commandUnitOutOfHouse === 'function' ? commandUnitOutOfHouse : null,
  startBurningHouse: typeof startBurningHouse === 'function' ? startBurningHouse : null
});

function registerGameplayCommandHandlers() {
  gameplayCommandHandlers.registerAll();
}

function registerGameModeAdapters() {
  const modeRuntime = OpenRTS.modes?.runtime;
  if (!modeRuntime || modeRuntime.get('versus')) return;

  const createMatch = config => ({
    modeId: config.modeId || 'versus',
    config: structuredClone(config || {}),
    seed: OpenRTS.random.getSeed()
  });
  const describeFromDefinition = modeId => {
    const mode = typeof getGameModeDefinition === 'function' ? getGameModeDefinition(modeId) : null;
    return {
      modeId,
      sections: [...(mode?.sections || [])],
      allowedUnits: [...(mode?.allowedUnits || [])],
      playable: !!mode?.playable
    };
  };
  const checkVictory = (_match, context) => {
    if (typeof evaluateGameFinishRules !== 'function') return null;
    return evaluateGameFinishRules(context.aliveUnits || gameRuntime.aliveUnits || []);
  };

  modeRuntime.register('versus', {
    createMatch,
    checkVictory,
    describeSetup: () => describeFromDefinition('versus')
  });
  modeRuntime.register('tower_defense', {
    createMatch,
    update: (dt, _match, context) => OpenRTS.systems.towerDefense?.update(dt, {
      units: context.aliveUnits || [],
      buildings: context.buildings || OpenRTS.world.runtime.get('buildings')
    }),
    checkVictory,
    describeSetup: () => describeFromDefinition('tower_defense')
  });
  modeRuntime.register('unit_comparison', {
    createMatch,
    update: (_dt, _match, context) => {
      if (typeof findNearestEnemyForUnit !== 'function') return null;
      for (const unit of context.aliveUnits || []) {
        if (unit.attackOrderTarget && unit.isEnemyValid(unit.attackOrderTarget)) continue;
        const target = findNearestEnemyForUnit(unit);
        if (target) unit.issueAttackCommand(target);
      }
      return null;
    },
    checkVictory,
    describeSetup: () => describeFromDefinition('unit_comparison')
  });
  modeRuntime.register('map_builder', {
    createMatch,
    describeSetup: () => describeFromDefinition('map_builder')
  });
}

function getEdgeScrollDirection() {
  return cameraController.getEdgeScrollDirection();
}

function toggleDebugFlag(flagName) {
  if (!(flagName in DEBUG)) return;
  DEBUG[flagName] = !DEBUG[flagName];
  console.log(`${flagName}: ${DEBUG[flagName] ? 'ON' : 'OFF'}`);
}

const cameraController = OpenRTS.camera.controller.createCameraController({
  camera,
  inputState,
  canvas,
  tileSize,
  document,
  getComputedStyle,
  getMapWidthPx,
  getMapHeightPx,
  use3DRenderer: () => false,
  refresh3DCameraMatrices: () => {
    if (typeof refresh3DCameraMatrices === 'function') refresh3DCameraMatrices();
  },
  get3DWorldPoint: (screenX, screenY) => {
    return typeof get3DWorldPoint === 'function' ? get3DWorldPoint(screenX, screenY) : null;
  }
});

function getMinZoomToFitMap() {
  return cameraController.getMinZoomToFitMap();
}

function getCameraOverscan() {
  return cameraController.getCameraOverscan();
}

function clampCameraPosition() {
  cameraController.clampCameraPosition();
}

function zoomAtScreenPoint(screenX, screenY, zoomFactor) {
  cameraController.zoomAtScreenPoint(screenX, screenY, zoomFactor);
}

function zoomToFullMap() {
  cameraController.zoomToFullMap();
}

window.zoomToFullMap = zoomToFullMap;
window.zoomAtScreenPoint = zoomAtScreenPoint;
window.getEdgeScrollDirection = getEdgeScrollDirection;

function updateCamera(dt) {
  cameraController.update(dt);
}

function screenToWorld(screenX, screenY) {
  return cameraController.screenToWorld(screenX, screenY);
}

window.screenToWorld = screenToWorld;

function refreshRuntimeUnits() {
  const worldCollections = {
    buildings: OpenRTS.world.runtime.get('buildings'),
    sheep: OpenRTS.world.runtime.get('sheep'),
    ducks: OpenRTS.world.runtime.get('ducks'),
    horses: OpenRTS.world.runtime.get('horses'),
    items: OpenRTS.world.runtime.get('items'),
    goldMines: OpenRTS.world.runtime.get('goldMines'),
    houses: OpenRTS.world.runtime.get('houses'),
    obstacleEntities: OpenRTS.world.runtime.get('obstacleEntities')
  };
  const projectiles = OpenRTS.systems.projectiles.getProjectiles();

  if (window.entityManager && typeof window.entityManager.syncAll === 'function') {
    window.entityManager.syncAll({
      units,
      collections: worldCollections,
      projectiles,
      frame: runtime.frame
    });
    gameRuntime.entityRegistry = window.entityManager;
  }

  const aliveUnits = window.entityManager && typeof window.entityManager.getAliveUnits === 'function'
    ? window.entityManager.getAliveUnits()
    : units.filter(unit => !unit.isDead);
  gameRuntime.aliveUnits = aliveUnits;
  gameRuntime.ecsAliveUnits = aliveUnits;
  gameRuntime.bullets = projectiles;

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
  registerGameModeAdapters();

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
    id: 'vision',
    order: 32,
    update: dt => OpenRTS.systems.vision?.update(dt, {
      registry: window.entityManager,
      teams: typeof getConfiguredTeams === 'function' ? getConfiguredTeams(window.mapConfig || mapConfig || {}) : []
    })
  });
  runtime.registerSystem({
    id: 'commands',
    order: 35,
    update: () => OpenRTS.commands.process(runtime.frame, gameRuntime)
  });
  runtime.registerSystem({
    id: 'game-mode',
    order: 40,
    update: dt => {
      const modeResult = typeof updateActiveGameMode === 'function'
        ? updateActiveGameMode(dt, gameRuntime.aliveUnits)
        : OpenRTS.modes?.runtime?.update(dt, {
          aliveUnits: gameRuntime.aliveUnits,
          buildings: OpenRTS.world.runtime.get('buildings')
        });
      if (modeResult && typeof finishGame === 'function') finishGame(modeResult);
    }
  });
  runtime.registerSystem({
    id: 'skirmish-ai',
    order: 45,
    update: dt => OpenRTS.systems.skirmishAi?.update(dt, {
      units: gameRuntime.aliveUnits,
      buildings: OpenRTS.world.runtime.get('buildings')
    }, {
      commands: OpenRTS.commands,
      entityManager: window.entityManager,
      query: OpenRTS.entities?.query
    })
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
    id: 'houses',
    order: 65,
    update: dt => {
      if (typeof updateHouseUnitInteractions === 'function') updateHouseUnitInteractions();
      if (typeof updateHouses === 'function') updateHouses(dt);
    }
  });
  runtime.registerSystem({
    id: 'movement',
    order: 70,
    update: dt => {
      if (typeof updateUnitMovementSystem === 'function') updateUnitMovementSystem(gameRuntime.aliveUnits, dt);
    }
  });
  runtime.registerSystem({
    id: 'worker-economy',
    order: 75,
    update: dt => OpenRTS.systems.workerEconomy?.update(dt, {
      units: gameRuntime.aliveUnits
    })
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
  if (typeof window.renderBuildPlacementPreview === 'function') {
    window.renderBuildPlacementPreview(ctx);
  }
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
    id: 'canvas-2d',
    priority: 100,
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
  if (config.modeId === 'unit_comparison') {
    camera.x = getMapWidthPx() * 0.5 - (camera.viewportWidth / camera.zoom) * 0.5;
    camera.y = getMapHeightPx() * 0.5 - (camera.viewportHeight / camera.zoom) * 0.5;
    clampCameraPosition();
    return;
  }

  if (config.modeId === 'map_builder') return;

  const slots = typeof getActivePlayerSlots === 'function' ? getActivePlayerSlots(config) : [];
  const localTeam = slots.find(slot => slot.controller === 'human')?.flag || 'red';
  const home = typeof getTeamHome === 'function' ? getTeamHome(localTeam) : null;
  const focus = home || units.find(unit => unit.team === localTeam && !unit.isDead);
  if (!focus) return;

  camera.x = focus.x - (camera.viewportWidth / camera.zoom) * 0.5;
  camera.y = focus.y - (camera.viewportHeight / camera.zoom) * 0.5;
  clampCameraPosition();
}

function configureMatchResources(config = window.mapConfig || mapConfig || {}) {
  const slots = typeof getActivePlayerSlots === 'function' ? getActivePlayerSlots(config) : [];
  const teams = typeof getConfiguredTeams === 'function' ? getConfiguredTeams(config) : ['red', 'blue'];
  const firstFaction = slots.length && typeof getFactionDefinition === 'function'
    ? getFactionDefinition(slots[0].factionId)
    : null;
  const ruleset = typeof getRulesetDefinition === 'function'
    ? getRulesetDefinition(firstFaction?.ruleset || 'open_rts_core')
    : null;

  OpenRTS.systems.resources?.configure({
    resources: ruleset?.resources || null
  });

  OpenRTS.systems.resources?.reset(teams, {
    gold: config.startingGold ?? 140,
    wood: config.startingWood ?? 160,
    stone: config.startingStone ?? 0,
    food: config.startingFood ?? 0
  });

  for (const slot of slots) {
    const faction = typeof getFactionDefinition === 'function' ? getFactionDefinition(slot.factionId) : null;
    if (slot.flag && faction?.startingResources) {
      OpenRTS.systems.resources?.set?.(slot.flag, faction.startingResources);
    }
  }
}

function initializeGame() {
  console.log('Initializing game with config:', mapConfig);
  if (typeof resetGameSession === 'function') resetGameSession();
  runtime.resetClock();
  runtime.resetSystems({ config: window.mapConfig || mapConfig || {} });
  OpenRTS.commands.clear();
  OpenRTS.systems.projectiles.reset();
  OpenRTS.systems.skirmishAi?.reset();
  OpenRTS.systems.workerEconomy?.reset();
  OpenRTS.systems.towerDefense?.reset(window.mapConfig || mapConfig || {});
  configureMatchResources(window.mapConfig || mapConfig || {});
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
