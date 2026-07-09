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

test('player input routes selected flying buildings through relocate commands', () => {
  const input = fs.readFileSync(new URL('../systems/input.js', import.meta.url), 'utf8');

  assert.match(input, /getSelectedBuilding/);
  assert.match(input, /OpenRTS\.systems\.buildingMobility\?\.isFlying\?\.\(selectedBuilding\)/);
  assert.match(input, /type:\s*OpenRTS\.commands\.types\.BUILDING_RELOCATE/);
  assert.match(input, /payload:\s*{\s*buildingId:\s*selectedBuilding\.id,\s*x:\s*world\.x,\s*y:\s*world\.y\s*}/);
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
  const hud = fs.readFileSync(new URL('../ui/hud.js', import.meta.url), 'utf8');
  const input = fs.readFileSync(new URL('../systems/input.js', import.meta.url), 'utf8');
  const cameraScript = 'core/camera/CameraController.js';
  const mainScript = 'core/main.js';

  assert.match(cameraController, /createCameraController/);
  assert.match(cameraController, /zoomAtScreenPoint/);
  assert.match(cameraController, /getEdgeScrollDirection/);
  assert.match(main, /OpenRTS\.camera\.controller\.createCameraController/);
  assert.doesNotMatch(main, /querySelector\('\\.command-bar'\)/);
  assert.doesNotMatch(main, /const\s+bottomScrollMargin/);
  assert.match(index, /id="gameBottomEdgeScrollZone"/);
  assert.match(hud, /syncGameBottomEdgeScrollZone/);
  assert.match(input, /#bottomEdgeScrollZone,\s*#gameBottomEdgeScrollZone/);
  assert.ok(index.indexOf(cameraScript) !== -1, 'camera controller must be loaded');
  assert.ok(index.indexOf(cameraScript) < index.indexOf(mainScript), 'camera controller must load before main');
});

test('active gameplay rendering is canvas 2D while 3D remains dormant', () => {
  const main = fs.readFileSync(new URL('../core/main.js', import.meta.url), 'utf8');
  const renderer3d = fs.readFileSync(new URL('../world/renderer3d.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(main, /id:\s*'canvas-2d'/);
  assert.doesNotMatch(main, /id:\s*'three'/);
  assert.match(main, /use3DRenderer:\s*\(\)\s*=>\s*false/);
  assert.match(renderer3d, /function\s+use3DRenderer\(\)\s*{\s*return false;/);
  assert.match(index, /<canvas id="gameCanvas3d" hidden aria-hidden="true"><\/canvas>/);
  assert.match(index, /core\/main\.js\?v=dozerbuild1/);
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

  assert.doesNotMatch(index, /id="titleScreen"/);
  assert.doesNotMatch(index, /TitleScreen\.js/);
  assert.doesNotMatch(bootstrap, /initTitleScreen/);
  assert.match(index, /<div id="modePanel" class="config-panel mode-panel">/);
  assert.match(index, /id="packageBrowser"/);
  assert.match(bootstrap, /loadGamePackageIndex/);
  assert.match(modeSelect, /renderPackageBrowser/);
  assert.match(modeSelect, /listAvailableGamePackages/);
  assert.match(modeSelect, /selectThemePackage/);
  assert.match(modeSelect, /loadGameDefinitions\(\{ packageId: nextPackageId \}\)/);
  assert.match(modeSelect, /setSelectedModeId\(''\)/);
  assert.doesNotMatch(modeSelect, /mergeModeDefaults\(DEFAULT_MODE_ID\)/);
  assert.doesNotMatch(bootstrap, /mergeModeDefaults\(DEFAULT_MODE_ID\)|renderConfigPanel\(DEFAULT_MODE_ID\)/);
  assert.doesNotMatch(modeSelect, /window\.location\.href/);
  assert.doesNotMatch(modeSelect, /Default medieval sandbox package/);
  assert.doesNotMatch(modeSelect, /entry\.style|entry\.description|entry\.category|entry\.tags/);
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

test('pregame setup is map-only and player loadouts stay in theme configs', () => {
  const setup = fs.readFileSync(new URL('../ui/screens/GameSetupScreen.js', import.meta.url), 'utf8');
  const config = fs.readFileSync(new URL('../ui/config.js', import.meta.url), 'utf8');
  const readyRoom = fs.readFileSync(new URL('../ui/screens/ReadyRoomScreen.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(setup, /getModeMapSetupSections/);
  assert.match(setup, /generate one from size, landscape, and terrain criteria/);
  assert.match(setup, /Resources, wildlife, map objects, units, rosters, buildings, and rules come from the selected theme config files/);
  assert.match(setup, /if \(!modeHasMapSetup\(mode\)\)/);
  assert.doesNotMatch(setup, /Next: Player Settings/);
  assert.doesNotMatch(setup, /Player Settings/);
  assert.doesNotMatch(setup, /appendForcesSetup/);
  assert.doesNotMatch(setup, /unitLoadout/);
  assert.match(config, /key:\s*'savedMapId'/);
  assert.match(config, /key:\s*'generatedMapSize'/);
  assert.match(config, /key:\s*'generatedLandscape'/);
  assert.match(config, /key:\s*'generatedTerrain'/);
  assert.match(config, /getGeneratedMapSizeOptions/);
  assert.match(config, /getGeneratedLandscapeOptions/);
  assert.match(config, /getGeneratedTerrainOptions/);
  assert.doesNotMatch(config, /label:\s*'Water\/Lava Coverage'|label:\s*'Rocks'|label:\s*'Trees'|label:\s*'Gold Mounds'|label:\s*'Neutral Houses'|label:\s*'Sheep'|label:\s*'Ducks'/);
  assert.match(readyRoom, /selectedModeHasMapSetup/);
  assert.match(readyRoom, /Back to Map Setup/);
  assert.match(index, /GameSetupScreen\.js\?v=mapsetuponly1/);
  assert.match(index, /ReadyRoomScreen\.js\?v=themeflow1/);
});

test('ready room summarizes starting buildings from faction definitions', () => {
  const readyRoom = fs.readFileSync(new URL('../ui/screens/ReadyRoomScreen.js', import.meta.url), 'utf8');
  const modernFactions = JSON.parse(fs.readFileSync(new URL('../games/modern_warlord/factions.json', import.meta.url), 'utf8'));

  assert.equal(modernFactions.mw_united_coalition.startingBuildings.mw_command_center, 1);
  assert.match(readyRoom, /function getStartingBuildingSummary/);
  assert.match(readyRoom, /function getStartingUnitSummary/);
  assert.match(readyRoom, /faction\.startingUnits/);
  assert.match(readyRoom, /faction\.startingBuildings/);
  assert.match(readyRoom, /formatBuildingRoster\(roster\)/);
  assert.doesNotMatch(readyRoom, /castleCount/);
});

test('era of kingdoms uses a dedicated 2D town center renderer', () => {
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const buildings = JSON.parse(fs.readFileSync(new URL('../games/era_of_kingdoms/buildings.json', import.meta.url), 'utf8'));

  assert.equal(buildings.eok_town_center.model, 'eok_town_center');
  assert.match(map, /function isEraKingdomsTownCenter/);
  assert.match(map, /building\.definitionType === 'eok_town_center'/);
  assert.match(map, /function drawEraKingdomsTownCenter/);
  assert.match(map, /drawEraTileRoof/);
  assert.match(map, /drawEraBanners/);
  assert.match(map, /drawEraKingdomsTownCenter\(building, layer\)/);
  assert.match(index, /world\/map\.js\?v=starsiege1/);
});

test('battleforge uses a dedicated 2D fantasy town hall renderer', () => {
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const buildings = JSON.parse(fs.readFileSync(new URL('../games/battleforge/buildings.json', import.meta.url), 'utf8'));

  assert.equal(buildings.bf_town_hall.model, 'castle');
  assert.match(map, /function isBattleForgeTownHall/);
  assert.match(map, /building\.definitionType === 'bf_town_hall'/);
  assert.match(map, /function drawBattleForgeTownHall/);
  assert.match(map, /drawFantasyRoof/);
  assert.match(map, /drawBattleForgeBanners/);
  assert.match(map, /drawBattleForgeTownHall\(building, layer\)/);
});

test('modern warlord uses a dedicated 2D desert barracks command center renderer', () => {
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const buildings = JSON.parse(fs.readFileSync(new URL('../games/modern_warlord/buildings.json', import.meta.url), 'utf8'));

  assert.equal(buildings.mw_command_center.model, 'modern_command_center');
  assert.match(map, /function isModernWarlordCommandCenter/);
  assert.match(map, /building\.definitionType === 'mw_command_center'/);
  assert.match(map, /function drawModernWarlordCommandCenter/);
  assert.match(map, /drawHescoWall/);
  assert.match(map, /drawSandbagStack/);
  assert.match(map, /drawModernBarracksBlock/);
  assert.match(map, /drawModernWarlordCommandCenter\(building, layer\)/);
});

test('bottom command bar exposes data-driven construction commands', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const hud = fs.readFileSync(new URL('../ui/hud.js', import.meta.url), 'utf8');
  const targeting = fs.readFileSync(new URL('../ui/CommandTargetingController.js', import.meta.url), 'utf8');
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../core/main.js', import.meta.url), 'utf8');
  const workerEconomy = fs.readFileSync(new URL('../game/systems/workerEconomySystem.js', import.meta.url), 'utf8');
  const resourceSystem = fs.readFileSync(new URL('../game/systems/resourceSystem.js', import.meta.url), 'utf8');

  assert.match(index, /id="constructionPanel"/);
  assert.match(index, /id="constructionActions"/);
  assert.doesNotMatch(index, /id="buildTowerAction"/);
  assert.match(hud, /getBuildableBuildingsForUnit/);
  assert.match(hud, /getConfiguredFactionForTeam/);
  assert.match(hud, /return definition \? \{ \.\.\.definition, id \} : null/);
  assert.match(hud, /data-building-type/);
  assert.match(hud, /toggleItemActionTargeting\(`build:/);
  assert.match(targeting, /isBuildMode/);
  assert.match(targeting, /startsWith\('build:'\)/);
  assert.match(targeting, /getBuildPlacementType/);
  assert.match(targeting, /getBuildPlacementPreview/);
  assert.match(targeting, /tileX:\s*placement\?\.tileX/);
  assert.match(targeting, /payload:\s*\{\s*unitId:\s*worker\.id,\s*buildingType/);
  assert.match(map, /function getBuildPlacementPreview/);
  assert.match(map, /findNearestBuildableSite\(buildingType/);
  assert.match(map, /function buildBuildingAtTile\(type,\s*team,\s*tileX,\s*tileY,\s*options = \{\}\)/);
  assert.match(map, /createBuilding\(type,\s*team,\s*tileX,\s*tileY,\s*\{ stats,\s*definitionType:\s*type \}\)/);
  assert.match(map, /function renderBuildPlacementPreview/);
  assert.match(map, /function selectBuilding\(building\)\s*\{\s*clearBuildingSelection\(\);\s*if \(building\) building\.selected = true;/);
  assert.match(map, /drawBuilding\(building,\s*'full'\)/);
  assert.match(map, /window\.renderBuildPlacementPreview\s*=\s*renderBuildPlacementPreview/);
  assert.match(main, /window\.renderBuildPlacementPreview\(ctx\)/);
  assert.match(main, /function configureMatchResources/);
  assert.match(main, /faction\.startingResources/);
  assert.match(hud, /OpenRTS\.systems\.resources\.describe/);
  assert.match(workerEconomy, /getBuildCost/);
  assert.match(workerEconomy, /getBuildingDefinition/);
  assert.match(workerEconomy, /startBuild\(unit,\s*buildingType,\s*worldX,\s*worldY,\s*options = \{\}\)/);
  assert.match(workerEconomy, /canPlaceBuildingAt\(type,\s*requestedTileX,\s*requestedTileY,\s*\{ stats \}\)/);
  assert.match(workerEconomy, /buildBuildingAtTile\(job\.buildingType,\s*unit\.team,\s*job\.tileX,\s*job\.tileY,\s*\{ stats:\s*job\.stats \}\)/);
  assert.match(resourceSystem, /function set\(team/);
  assert.doesNotMatch(workerEconomy, /buildingType\s*===\s*'tower'\s*\?\s*'tower'\s*:\s*null/);
});

test('modded worker units keep tags for builder and gatherer systems', () => {
  const gameState = fs.readFileSync(new URL('../world/gameState.js', import.meta.url), 'utf8');
  const unitRenderer = fs.readFileSync(new URL('../systems/processors/unitRenderProcessor.js', import.meta.url), 'utf8');
  const workerEconomy = fs.readFileSync(new URL('../game/systems/workerEconomySystem.js', import.meta.url), 'utf8');
  const eokUnits = JSON.parse(fs.readFileSync(new URL('../games/era_of_kingdoms/units.json', import.meta.url), 'utf8'));
  const modernUnits = JSON.parse(fs.readFileSync(new URL('../games/modern_warlord/units.json', import.meta.url), 'utf8'));
  const ultimateUnits = JSON.parse(fs.readFileSync(new URL('../games/ultimate_extinction/units.json', import.meta.url), 'utf8'));

  assert.deepEqual(eokUnits.eok_villager.tags, ['worker', 'villager']);
  assert.equal(modernUnits.mw_dozer.model, 'construction_dozer');
  assert.ok(ultimateUnits.ue_commander.tags.includes('builder'));
  assert.match(gameState, /unit\.tags\s*=\s*Array\.isArray\(definition\.tags\)/);
  assert.match(unitRenderer, /function drawConstructionDozer/);
  assert.match(unitRenderer, /unit\.model === 'construction_dozer'/);
  assert.match(unitRenderer, /function drawGenericRangedWeapon/);
  assert.match(unitRenderer, /function drawVehicleAttackAnimation/);
  assert.match(unitRenderer, /function drawAirAttackAnimation/);
  assert.match(unitRenderer, /drawVehicleAttackAnimation\(unit,\s*ctx/);
  assert.match(unitRenderer, /drawAirAttackAnimation\(unit,\s*ctx,\s*facing\)/);
  assert.match(unitRenderer, /drawGenericRangedWeapon\(unit,\s*ctx,\s*facing,\s*baseX,\s*baseY\)/);
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

test('world map smooths generated water bodies before object placement', () => {
  const map = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');

  assert.match(map, /const paintOvalLake =/);
  assert.match(map, /function smoothWaterBodies/);
  assert.match(map, /smoothWaterBodies\(\);\s*\n\s*\/\/ Step 3: Collect candidate tiles/);
  assert.match(map, /waterNeighbors >= 6/);
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
    ['world/rendering/canvas/CanvasTerrainPainter.js', 'world/map.js']
  ]) {
    assert.ok(index.indexOf(dependency) !== -1, `${dependency} must be loaded`);
    assert.ok(index.indexOf(dependency) < index.indexOf(consumer), `${dependency} must load before ${consumer}`);
  }
});

test('dormant 3D renderer keeps sprite experiments out of the active 2D browser bundle', () => {
  const renderer3d = fs.readFileSync(new URL('../world/renderer3d.js', import.meta.url), 'utf8');
  const unitFactory = fs.readFileSync(new URL('../world/rendering/three/ThreeUnitModelFactory.js', import.meta.url), 'utf8');
  const projectileFactory = fs.readFileSync(new URL('../world/rendering/three/ProjectileVisualFactory.js', import.meta.url), 'utf8');
  const materialFactory = fs.readFileSync(new URL('../world/rendering/three/MaterialFactory.js', import.meta.url), 'utf8');
  const terrainFactory = fs.readFileSync(new URL('../world/rendering/three/ThreeTerrainMeshFactory.js', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(renderer3d, /createTreeSpriteTexture/);
  assert.match(renderer3d, /getTreeSpriteMaterial/);
  assert.match(renderer3d, /addTreeSprite/);
  assert.match(renderer3d, /drawTreeBlob/);
  assert.match(renderer3d, /drawPaintedOakSprite/);
  assert.match(renderer3d, /drawPaintedPineSprite/);
  assert.match(renderer3d, /drawPaintedPalmSprite/);
  assert.match(renderer3d, /drawIrregularCanopy/);
  assert.match(renderer3d, /createRockSpriteTexture/);
  assert.match(renderer3d, /getRockSpriteMaterial/);
  assert.match(renderer3d, /drawRockPolygon/);
  assert.match(renderer3d, /rockArtProfile/);
  assert.match(renderer3d, /getEntitySpriteMaterial/);
  assert.match(renderer3d, /createBillboardEntity/);
  assert.match(renderer3d, /drawSheepSprite/);
  assert.match(renderer3d, /drawDuckSprite/);
  assert.match(renderer3d, /drawHorseSprite/);
  assert.match(renderer3d, /drawWorldItemSprite/);
  assert.match(unitFactory, /createUnitBillboard/);
  assert.match(unitFactory, /getSpriteMaterial/);
  assert.match(unitFactory, /drawUnitSprite/);
  assert.match(unitFactory, /new THREE\.Sprite/);
  assert.match(unitFactory, /new THREE\.SpriteMaterial/);
  assert.match(projectileFactory, /createProjectileSprite/);
  assert.match(projectileFactory, /drawProjectileSprite/);
  assert.match(projectileFactory, /drawImpactSprite/);
  assert.match(projectileFactory, /new THREE\.Sprite/);
  assert.match(projectileFactory, /new THREE\.SpriteMaterial/);
  assert.match(materialFactory, /createTerrainDecalTexture/);
  assert.match(materialFactory, /terrainGrassClump/);
  assert.match(materialFactory, /terrainDryPatch/);
  assert.match(materialFactory, /terrainPebbles/);
  assert.match(materialFactory, /terrainShrubPatch/);
  assert.match(terrainFactory, /createTerrainDetailMeshesForRange/);
  assert.match(terrainFactory, /appendTerrainDecal/);
  assert.match(terrainFactory, /terrainDetailKind/);
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
  assert.doesNotMatch(index, /engine\/three-runtime/);
  assert.doesNotMatch(index, /world\/threeBootstrap\.js/);
  assert.doesNotMatch(index, /world\/rendering\/three\//);
  assert.doesNotMatch(index, /world\/renderer3d\.js/);
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
    'getBuildPlacementPreview',
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
    'renderBuildPlacementPreview',
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
