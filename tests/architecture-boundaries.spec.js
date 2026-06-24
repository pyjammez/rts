import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('player input cannot bypass the authoritative command stream', () => {
  const input = fs.readFileSync(new URL('../systems/input.js', import.meta.url), 'utf8');
  const hud = fs.readFileSync(new URL('../ui/hud.js', import.meta.url), 'utf8');
  const forbidden = /\.issue(?:Move|Attack|Mount|Pickup|Drop)Command\s*\(|\.setFireStance\s*\(/;

  assert.doesNotMatch(input, forbidden);
  assert.doesNotMatch(hud, forbidden);
  assert.match(input, /OpenRTS\.commands/);
  assert.match(hud, /OpenRTS\.commands/);
});

test('player input delegates unit command intent construction', () => {
  const input = fs.readFileSync(new URL('../systems/input.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const intentsScript = 'game/commands/UnitCommandIntents.js';
  const inputScript = 'systems/input.js';

  assert.match(input, /OpenRTS\.commandIntents\.unit/);
  assert.doesNotMatch(input, /function\s+enqueue(?:Attack|Mount|Move|Unit)/);
  assert.ok(
    index.indexOf(intentsScript) !== -1 && index.indexOf(inputScript) !== -1,
    'index.html must load unit command intents and input scripts'
  );
  assert.ok(
    index.indexOf(intentsScript) < index.indexOf(inputScript),
    'unit command intents must load before input'
  );
});

test('gameplay command registration lives outside the composition root', () => {
  const main = fs.readFileSync(new URL('../core/main.js', import.meta.url), 'utf8');
  const handlers = fs.readFileSync(new URL('../game/commands/GameplayCommandHandlers.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const commandBusScript = 'game/commands/CommandBus.js';
  const handlersScript = 'game/commands/GameplayCommandHandlers.js';
  const mainScript = 'core/main.js';

  assert.match(handlers, /createRegistrar/);
  assert.match(handlers, /registerAll/);
  assert.match(main, /OpenRTS\.commands\.gameplayHandlers\.createRegistrar/);
  assert.doesNotMatch(main, /Order one unit to move to a world point/);
  assert.doesNotMatch(main, /resolveCommandTarget/);
  assert.ok(index.indexOf(commandBusScript) < index.indexOf(handlersScript), 'command bus must load before gameplay handlers');
  assert.ok(index.indexOf(handlersScript) < index.indexOf(mainScript), 'gameplay handlers must load before main');
});

test('camera policy lives outside the composition root', () => {
  const main = fs.readFileSync(new URL('../core/main.js', import.meta.url), 'utf8');
  const cameraController = fs.readFileSync(new URL('../core/camera/CameraController.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const cameraScript = 'core/camera/CameraController.js';
  const mainScript = 'core/main.js';

  assert.match(cameraController, /createCameraController/);
  assert.match(cameraController, /zoomAtScreenPoint/);
  assert.match(cameraController, /getEdgeScrollDirection/);
  assert.match(main, /OpenRTS\.camera\.controller\.createCameraController/);
  assert.doesNotMatch(main, /querySelector\('\\.command-bar'\)/);
  assert.doesNotMatch(main, /const\s+bottomScrollMargin/);
  assert.ok(index.indexOf(cameraScript) !== -1, 'camera controller must be loaded');
  assert.ok(index.indexOf(cameraScript) < index.indexOf(mainScript), 'camera controller must load before main');
});

test('package manifest policy loads before package content loading', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../game/config/PackageManifestService.js', import.meta.url), 'utf8');
  const manifestScript = 'game/config/PackageManifestService.js';
  const loaderScript = 'game/config/ContentPackLoader.js';

  assert.match(service, /createPackageLock/);
  assert.match(service, /sortByDependencies/);
  assert.match(service, /satisfiesEngineVersion/);
  assert.ok(index.indexOf(manifestScript) !== -1, 'package manifest service must be loaded');
  assert.ok(index.indexOf(loaderScript) !== -1, 'content package loader must be loaded');
  assert.ok(index.indexOf(manifestScript) < index.indexOf(loaderScript), 'package manifest service must load before content package loader');
});

test('world map delegates navigation policy to a navigation service', () => {
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const navigation = fs.readFileSync(new URL('../world/navigation/NavigationService.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const navigationScript = 'world/navigation/NavigationService.js';
  const mapScript = 'world/map.js';

  assert.match(navigation, /createNavigationService/);
  assert.match(map, /getNavigationService\(\)\.findNearestWalkablePoint/);
  assert.match(map, /getNavigationService\(\)\.isWalkableTile/);
  assert.ok(
    index.indexOf(navigationScript) !== -1 && index.indexOf(mapScript) !== -1,
    'index.html must load navigation service and map scripts'
  );
  assert.ok(
    index.indexOf(navigationScript) < index.indexOf(mapScript),
    'navigation service must load before map'
  );
});

test('large prototype-era files delegate split responsibilities to focused modules', () => {
  const unit = fs.readFileSync(new URL('../entities/unit.js', import.meta.url), 'utf8');
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const renderer3d = fs.readFileSync(new URL('../world/renderer3d.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(unit, /OpenRTS\.entities\.unitState\.createInitialState/);
  assert.match(unit, /OpenRTS\.entities\.unitCommandTypes/);
  assert.match(unit, /OpenRTS\.entities\.unitCommandState/);
  assert.match(map, /OpenRTS\.world\.mapSprites\.createTileSprites/);
  assert.match(map, /OpenRTS\.rendering\.canvas\.terrainPainter/);
  assert.match(renderer3d, /OpenRTS\.rendering\.threeUnitAttachments\.createFactory/);
  assert.match(renderer3d, /OpenRTS\.rendering\.threeUnitModels\.createFactory/);
  assert.match(renderer3d, /OpenRTS\.rendering\.threeTerrainMeshes\.createFactory/);
  assert.match(renderer3d, /OpenRTS\.rendering\.threeBuildingModels\.createFactory/);
  assert.doesNotMatch(renderer3d, /function\s+addLongbow/);
  assert.doesNotMatch(renderer3d, /function\s+addCarriedObject/);
  assert.doesNotMatch(renderer3d, /function\s+addWorkerGatherTool/);
  assert.doesNotMatch(renderer3d, /function\s+getWorkerGatherAnimation/);
  assert.doesNotMatch(renderer3d, /function\s+terrainSample/);
  assert.doesNotMatch(renderer3d, /function\s+terrainColor/);
  assert.doesNotMatch(renderer3d, /function\s+addBattlements/);
  assert.doesNotMatch(renderer3d, /function\s+createProceduralCastle/);
  assert.doesNotMatch(renderer3d, /function\s+createProceduralDefenseTower/);

  for (const [dependency, consumer] of [
    ['entities/UnitCommandTypes.js', 'entities/unit.js'],
    ['entities/UnitStateFactory.js', 'entities/unit.js'],
    ['entities/UnitCommandStateService.js', 'entities/unit.js'],
    ['world/map/MapSpriteCatalog.js', 'world/map.js'],
    ['world/rendering/canvas/CanvasTerrainPainter.js', 'world/map.js'],
    ['world/rendering/three/ThreeTerrainMeshFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeBuildingModelFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeUnitAttachmentFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeUnitModelFactory.js', 'world/renderer3d.js']
  ]) {
    assert.ok(index.indexOf(dependency) !== -1, `${dependency} must be loaded`);
    assert.ok(index.indexOf(dependency) < index.indexOf(consumer), `${dependency} must load before ${consumer}`);
  }
});

test('new browser globals must be approved compatibility adapters', () => {
  const approved = new Set([
    'ABILITY_DEFINITIONS',
    'BUILDING_DEFINITIONS',
    'CONTENT_MANIFEST',
    'FACTION_DEFINITIONS',
    'GAME_MODES',
    'GLTFLoader',
    'TERRAIN_PRESETS',
    'THREE',
    'UNIT_DEFINITIONS',
    'UNIT_PACKS',
    'UnitComponents',
    'WEAPON_DEFINITIONS',
    'RULESET_DEFINITIONS',
    'cancelItemActionTargeting',
    'describeConfigDefinitions',
    'duckData',
    'gameDefinitionLoadState',
    'gameRuntime',
    'getAbilityDefinition',
    'getBuildingDefinition',
    'getFactionDefinition',
    'getDefaultModeSettings',
    'getEdgeScrollDirection',
    'getGameModeDefinition',
    'getItemActionTargetMode',
    'getTerrainPreset',
    'getUnitCatalog',
    'getUnitCatalogFacets',
    'getUnitDefinition',
    'getWeaponDefinition',
    'getRulesetDefinition',
    'goldMineData',
    'handleCameraGesture',
    'handleItemActionTarget',
    'horseData',
    'houseData',
    'buildingData',
    'initGameOverScreen',
    'initGameSetupScreen',
    'initGameScreens',
    'initReadyRoomScreen',
    'init3DRenderer',
    'initTitleScreen',
    'itemData',
    'loadGameDefinitions',
    'loadRTSModel',
    'mapConfig',
    'obstacleEntityData',
    'openConfigForMode',
    'processUnitCombat',
    'processUnitMovement',
    'processUnitRender',
    'refresh3DCameraMatrices',
    'render3DScene',
    'renderConfigPanel',
    'renderModeButtons',
    'renderWaitingRoom',
    'returnToModeSelection',
    'screenToWorld',
    'searchUnitCatalog',
    'sheepData',
    'showGameOverScreen',
    'startGameLoop',
    'syncUnitComponentsFromUnits',
    'threeReady',
    'toggleItemActionTargeting',
    'updateModeButtons',
    'use3DRenderer',
    'get3DWorldPoint',
    'is3DWorldPointVisible',
    'zoomAtScreenPoint',
    'zoomToFullMap'
  ]);
  const ignoredDirs = new Set(['engine', 'tests']);
  const assignments = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      const file = path.join(dir, entry.name);
      const source = fs.readFileSync(file, 'utf8');
      const pattern = /\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g;
      for (const match of source.matchAll(pattern)) {
        const name = match[1];
        if (name === 'OpenRTS') continue;
        assignments.push({ file: path.relative(root, file), name });
      }
    }
  }

  walk(root);
  const unapproved = assignments.filter(entry => !approved.has(entry.name));
  assert.deepEqual(unapproved, []);
});
