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
  const schemaService = fs.readFileSync(new URL('../game/config/ContentSchemaService.js', import.meta.url), 'utf8');
  const reportService = fs.readFileSync(new URL('../game/config/PackageReportService.js', import.meta.url), 'utf8');
  const manifestScript = 'game/config/PackageManifestService.js';
  const schemaScript = 'game/config/ContentSchemaService.js';
  const reportScript = 'game/config/PackageReportService.js';
  const loaderScript = 'game/config/ContentPackLoader.js';

  assert.match(service, /createPackageLock/);
  assert.match(service, /sortByDependencies/);
  assert.match(service, /satisfiesEngineVersion/);
  assert.match(schemaService, /validatePackageContent/);
  assert.match(schemaService, /describeSchema/);
  assert.match(reportService, /createPackageReport/);
  assert.match(reportService, /validateCrossReferences/);
  assert.ok(index.indexOf(manifestScript) !== -1, 'package manifest service must be loaded');
  assert.ok(index.indexOf(schemaScript) !== -1, 'content schema service must be loaded');
  assert.ok(index.indexOf(reportScript) !== -1, 'package report service must be loaded');
  assert.ok(index.indexOf(loaderScript) !== -1, 'content package loader must be loaded');
  assert.ok(index.indexOf(manifestScript) < index.indexOf(loaderScript), 'package manifest service must load before content package loader');
  assert.ok(index.indexOf(schemaScript) < index.indexOf(reportScript), 'content schema service must load before package report service');
  assert.ok(index.indexOf(reportScript) < index.indexOf(loaderScript), 'package report service must load before content package loader');
});

test('mode selection exposes static game package discovery without hardcoded package folders', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bootstrap = fs.readFileSync(new URL('../ui/screens/bootstrap.js', import.meta.url), 'utf8');
  const modeSelect = fs.readFileSync(new URL('../ui/screens/ModeSelectScreen.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../ui/style.css', import.meta.url), 'utf8');

  assert.match(index, /id="packageBrowser"/);
  assert.match(bootstrap, /loadGamePackageIndex/);
  assert.match(modeSelect, /renderPackageBrowser/);
  assert.match(modeSelect, /listAvailableGamePackages/);
  assert.match(modeSelect, /navigateToGamePackage/);
  assert.doesNotMatch(modeSelect, /packages available/);
  assert.doesNotMatch(modeSelect, /data-package-query|data-package-category|data-package-tag|packageFiltersFromPanel/);
  assert.doesNotMatch(modeSelect, /createElement\('select'\)/);
  assert.doesNotMatch(modeSelect, /spacesiege|battleforge|modern_warlord|ultimate_extinction|era_of_kingdoms/);
  assert.match(styles, /\.package-browser/);
  assert.match(styles, /\.package-card/);
  assert.doesNotMatch(styles, /\.package-filters/);
});

test('ready room exposes factions and spawn setup applies faction rosters', () => {
  const config = fs.readFileSync(new URL('../ui/config.js', import.meta.url), 'utf8');
  const readyRoom = fs.readFileSync(new URL('../ui/screens/ReadyRoomScreen.js', import.meta.url), 'utf8');
  const gameState = fs.readFileSync(new URL('../world/gameState.js', import.meta.url), 'utf8');

  assert.match(config, /getFactionCatalog/);
  assert.match(config, /setPlayerSlotFaction/);
  assert.match(config, /getAvailableUnitIds/);
  assert.match(readyRoom, /createFactionSelect/);
  assert.match(readyRoom, /setPlayerSlotFaction/);
  assert.match(gameState, /getConfiguredFactionForTeam/);
  assert.match(gameState, /getConfiguredUnitRosterForTeam/);
  assert.match(gameState, /filterRosterToFaction/);
});

test('bottom command bar exposes data-driven construction commands', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const hud = fs.readFileSync(new URL('../ui/hud.js', import.meta.url), 'utf8');
  const targeting = fs.readFileSync(new URL('../ui/CommandTargetingController.js', import.meta.url), 'utf8');
  const workerEconomy = fs.readFileSync(new URL('../game/systems/workerEconomySystem.js', import.meta.url), 'utf8');

  assert.match(index, /id="constructionPanel"/);
  assert.match(index, /id="constructionActions"/);
  assert.doesNotMatch(index, /id="buildTowerAction"/);
  assert.match(hud, /getBuildableBuildingsForUnit/);
  assert.match(hud, /getConfiguredFactionForTeam/);
  assert.match(hud, /data-building-type/);
  assert.match(hud, /toggleItemActionTargeting\(`build:/);
  assert.match(targeting, /isBuildMode/);
  assert.match(targeting, /startsWith\('build:'\)/);
  assert.match(targeting, /payload:\s*\{\s*unitId:\s*worker\.id,\s*buildingType/);
  assert.match(workerEconomy, /getBuildCost/);
  assert.match(workerEconomy, /getBuildingDefinition/);
  assert.doesNotMatch(workerEconomy, /buildingType\s*===\s*'tower'\s*\?\s*'tower'\s*:\s*null/);
});

test('modded worker units keep tags for builder and gatherer systems', () => {
  const gameState = fs.readFileSync(new URL('../world/gameState.js', import.meta.url), 'utf8');
  const workerEconomy = fs.readFileSync(new URL('../game/systems/workerEconomySystem.js', import.meta.url), 'utf8');
  const eokUnits = JSON.parse(fs.readFileSync(new URL('../games/era_of_kingdoms/units.json', import.meta.url), 'utf8'));
  const ultimateUnits = JSON.parse(fs.readFileSync(new URL('../games/ultimate_extinction/units.json', import.meta.url), 'utf8'));

  assert.deepEqual(eokUnits.eok_villager.tags, ['worker', 'villager']);
  assert.ok(ultimateUnits.ue_commander.tags.includes('builder'));
  assert.match(gameState, /unit\.tags\s*=\s*Array\.isArray\(definition\.tags\)/);
  assert.match(workerEconomy, /tags\.includes\('worker'\)/);
  assert.match(workerEconomy, /tags\.includes\('builder'\)/);
  assert.match(workerEconomy, /tags\.includes\('villager'\)/);
  assert.match(workerEconomy, /unit\.model\s*===\s*'worker'/);
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
  assert.match(renderer3d, /state\.buildingModels\.createCastle/);
  assert.match(renderer3d, /state\.buildingModels\.createDefenseTower/);
  assert.match(
    fs.readFileSync(new URL('../world/rendering/three/RenderAssetAuditService.js', import.meta.url), 'utf8'),
    /createAudit/
  );
  assert.match(
    fs.readFileSync(new URL('../world/rendering/three/RenderOptimizationServices.js', import.meta.url), 'utf8'),
    /createStaticChunkPlanner/
  );
  assert.match(
    fs.readFileSync(new URL('../world/rendering/three/StaticInstanceBatcher.js', import.meta.url), 'utf8'),
    /createInstancedMeshBatch/
  );
  assert.doesNotMatch(renderer3d, /function\s+addLongbow/);
  assert.doesNotMatch(renderer3d, /function\s+addCarriedObject/);
  assert.doesNotMatch(renderer3d, /function\s+addWorkerGatherTool/);
  assert.doesNotMatch(renderer3d, /function\s+getWorkerGatherAnimation/);
  assert.doesNotMatch(renderer3d, /function\s+terrainSample/);
  assert.doesNotMatch(renderer3d, /function\s+terrainColor/);
  assert.doesNotMatch(renderer3d, /function\s+addBattlements/);
  assert.doesNotMatch(renderer3d, /createProceduralCastle/);
  assert.doesNotMatch(renderer3d, /createProceduralDefenseTower/);

  for (const [dependency, consumer] of [
    ['entities/UnitCommandTypes.js', 'entities/unit.js'],
    ['entities/UnitStateFactory.js', 'entities/unit.js'],
    ['entities/UnitCommandStateService.js', 'entities/unit.js'],
    ['world/map/MapSpriteCatalog.js', 'world/map.js'],
    ['world/rendering/canvas/CanvasTerrainPainter.js', 'world/map.js'],
    ['world/rendering/three/ThreeTerrainMeshFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeBuildingModelFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeUnitAttachmentFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/ThreeUnitModelFactory.js', 'world/renderer3d.js'],
    ['world/rendering/three/RenderAssetAuditService.js', 'world/renderer3d.js'],
    ['world/rendering/three/RenderOptimizationServices.js', 'world/renderer3d.js'],
    ['world/rendering/three/StaticInstanceBatcher.js', 'world/renderer3d.js'],
    ['world/rendering/three/RenderOptimizationServices.js', 'world/rendering/three/MeshPrimitiveFactory.js']
  ]) {
    assert.ok(index.indexOf(dependency) !== -1, `${dependency} must be loaded`);
    assert.ok(index.indexOf(dependency) < index.indexOf(consumer), `${dependency} must load before ${consumer}`);
  }
});

test('browser 3D trees use detailed 2D sprites with flat shadows', () => {
  const renderer3d = fs.readFileSync(new URL('../world/renderer3d.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(renderer3d, /createTreeSpriteTexture/);
  assert.match(renderer3d, /getTreeSpriteMaterial/);
  assert.match(renderer3d, /addTreeSprite/);
  assert.match(renderer3d, /drawTreeBlob/);
  assert.match(renderer3d, /createRadialGradient/);
  assert.match(renderer3d, /new THREE\.Sprite/);
  assert.match(renderer3d, /new THREE\.SpriteMaterial/);
  assert.match(renderer3d, /CircleGeometry\(1,\s*12\)/);
  assert.doesNotMatch(renderer3d, /addCartoonTreeBubble/);
  assert.doesNotMatch(renderer3d, /addCartoonTreeSphere/);
  assert.doesNotMatch(renderer3d, /tree:cartoon-bubble-sphere/);
  assert.doesNotMatch(renderer3d, /const\s+cardCount\s*=\s*16/);
  assert.doesNotMatch(renderer3d, /const\s+frondCount\s*=\s*18/);
  assert.doesNotMatch(renderer3d, /const\s+layers\s*=\s*9/);
  assert.match(index, /world\/renderer3d\.js\?v=eokcastle1/);
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
