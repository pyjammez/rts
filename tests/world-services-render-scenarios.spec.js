import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('world object services delegate object queries through one domain API', () => {
  const house = { id: 'house-1' };
  const mine = { id: 'goldmine-1' };
  const context = loadOpenRTSScript('../../world/objects/HitTestService.js', {
    OpenRTS: {
      world: {
        runtime: {
          get: name => {
            if (name === 'houses') return [{ ...house, x: 10, y: 10, size: 8 }];
            if (name === 'goldMines') return [{ ...mine, x: 25, y: 10, size: 8 }];
            if (name === 'buildings') return [{ id: 'building-1', x: 50, y: 50, width: 3, height: 3 }];
            return [];
          }
        }
      },
      diagnostics: { register() {} }
    }
  });
  loadOpenRTSScript('../../world/objects/WorldObjectServices.js', context);

  assert.equal(context.OpenRTS.world.objects.houses.atPoint(10, 10).id, house.id);
  assert.equal(context.OpenRTS.world.objects.resources.goldMineAtPoint(25, 10).id, mine.id);
  assert.equal(context.OpenRTS.world.objects.buildings.atPoint(50, 50).id, 'building-1');
  assert.equal(context.OpenRTS.world.objects.describe().counts.houses, 1);
  assert.equal(context.OpenRTS.world.objects.describe().counts.goldMines, 1);
});

test('hit test service centralizes nearest circle and box picking', () => {
  const context = loadOpenRTSScript('../../world/objects/HitTestService.js');
  const hitTests = context.OpenRTS.world.hitTests;
  const circles = [
    { id: 'far', x: 10, y: 10, size: 20 },
    { id: 'near', x: 15, y: 10, size: 20 },
    { id: 'dead', x: 14, y: 10, size: 20, isDead: true }
  ];
  const boxes = [
    { id: 'box-a', x: 100, y: 100, halfWidth: 5, halfHeight: 5 },
    { id: 'box-b', x: 102, y: 100, halfWidth: 5, halfHeight: 5 }
  ];

  assert.equal(hitTests.nearestCircleAtPoint(circles, 16, 10, {
    include: object => !object.isDead
  }).id, 'near');
  assert.equal(hitTests.nearestBoxAtPoint(boxes, 102, 100).id, 'box-b');
  assert.equal(hitTests.nearestCircleAtPoint(circles, 200, 200), null);
});

test('world selection service owns named selection channels', () => {
  const context = loadOpenRTSScript('../../world/objects/WorldSelectionService.js');
  const channel = context.OpenRTS.world.selection.channel('inspectables');
  const first = { id: 'tree-1' };
  const second = { id: 'rock-1' };

  assert.equal(channel.select(first), first);
  assert.equal(first.selected, true);
  channel.select(second);
  assert.equal(first.selected, false);
  assert.equal(second.selected, true);
  assert.equal(channel.get(), second);
  assert.equal(channel.clearIfSelected(second), true);
  assert.equal(second.selected, false);
  assert.equal(channel.get(), null);
});

test('carryable object service chooses nearest pickup and validates obstacle drops', () => {
  const context = loadOpenRTSScript('../../world/objects/CarryableObjectService.js');
  const carryables = context.OpenRTS.world.carryables;
  const nearest = carryables.findNearestCarryableObject(10, 10, {
    radius: 20,
    items: [{ id: 'kit', x: 16, y: 10, pickupable: true }],
    obstacles: [{ id: 'tree', x: 11, y: 10, size: 16, pickupable: true }]
  });

  assert.equal(nearest.id, 'tree');
  assert.equal(carryables.canDropObstacleAt(2, 2, {
    isInsideMap: () => true,
    isWaterTile: () => false,
    hasObstacle: () => false,
    isBlockedByBuilding: () => false,
    tileCenter: (x, y) => ({ x: x * 32 + 16, y: y * 32 + 16 }),
    tileSize: 32,
    units: [{ x: 1000, y: 1000, isDead: false }]
  }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(carryables.findObstacleDropTile(64, 64, {
    tileSize: 32,
    maxRadius: 2,
    canDrop: (x, y) => x === 3 && y === 2
  }))), { tileX: 3, tileY: 2 });
});

test('map builder brush service applies terrain, obstacle, height, and house edits', () => {
  const context = loadOpenRTSScript('../../world/objects/MapBuilderBrushService.js');
  const terrain = { WATER: 1, SAND: 2, GRASS: 3, DIRT: 4 };
  const obstacle = { NONE: 0, TREE: 1, ROCK: 2 };
  const decor = { NONE: 0, HILL: 1, DITCH: 2, RAMP: 3, CLIFF: 4, HUT: 5, WELL: 6 };
  const height = { LOW: -1, GROUND: 0, HIGH: 1, RAMP: 2 };
  const data = {
    terrainData: Array.from({ length: 4 }, () => Array(4).fill(terrain.GRASS)),
    obstacleData: Array.from({ length: 4 }, () => Array(4).fill(obstacle.NONE)),
    decorationData: Array.from({ length: 4 }, () => Array(4).fill(decor.NONE)),
    heightData: Array.from({ length: 4 }, () => Array(4).fill(height.GROUND))
  };

  context.OpenRTS.world.mapBuilderBrushes.applyBrush({
    ...data,
    tileX: 1,
    tileY: 1,
    tool: 'water',
    terrain,
    obstacle,
    decor,
    height,
    houses: []
  });
  const houseResult = context.OpenRTS.world.mapBuilderBrushes.applyBrush({
    ...data,
    tileX: 2,
    tileY: 2,
    tool: 'house',
    terrain,
    obstacle,
    decor,
    height,
    houses: [],
    columns: 4,
    rows: 4,
    createHouse: (tileX, tileY) => ({ id: 'house', tileX, tileY, width: 2, height: 2 })
  });

  assert.equal(data.terrainData[1][1], terrain.WATER);
  assert.equal(data.heightData[1][1], height.LOW);
  assert.equal(houseResult.houses.length, 1);
  assert.equal(houseResult.houses[0].tileX, 2);
});

test('house interaction service controls enter exit and burning lifecycle', () => {
  const context = loadOpenRTSScript('../../world/objects/HouseInteractionService.js');
  const service = context.OpenRTS.world.houseInteractions;
  const house = { id: 'house-1', x: 64, y: 64, width: 2, height: 2, hp: 100, maxHp: 100, occupants: [], burnDuration: 10 };
  const moves = [];
  let dirtyCount = 0;
  const unit = {
    id: 'unit-1',
    x: 64,
    y: service.doorPoint(house, 32).y,
    size: 16,
    maxHp: 80,
    commandQueue: [{ x: 1 }],
    issueMoveCommand(x, y) { moves.push({ x, y }); return true; },
    clearMovementState() { this.cleared = true; },
    takeDamage(amount) { this.damage = (this.damage || 0) + amount; }
  };

  assert.equal(service.commandEnter(unit, house, { tileSize: 32 }), true);
  service.updateUnitInteractions({ units: [unit], tileSize: 32, markDirty: () => dirtyCount++ });
  assert.equal(unit.hiddenInHouse, true);
  assert.equal(house.occupants[0], 'unit-1');

  service.startBurning(house, { markDirty: () => dirtyCount++ });
  service.updateBurning(11, {
    houses: [house],
    units: [unit],
    tileSize: 32,
    getHouseById: () => house,
    findNearestWalkablePoint: (x, y) => ({ x, y }),
    markDirty: () => dirtyCount++
  });

  assert.equal(house.isWreck, true);
  assert.equal(unit.hiddenInHouse, false);
  assert.ok(unit.damage >= 20);
  assert.ok(moves.length >= 2);
  assert.ok(dirtyCount >= 2);
});

test('castle command service treats castles as solid non-enterable buildings', () => {
  const context = loadOpenRTSScript('../../world/objects/CastleGeometryService.js');
  loadOpenRTSScript('../../world/objects/CastleCommandService.js', context);
  const castleCommands = context.OpenRTS.world.castleCommands;
  const building = { id: 'castle', type: 'home', team: 'red', tileX: 10, tileY: 10, width: 9, height: 9, x: 464, y: 464 };
  const unit = {
    id: 'u1',
    team: 'red',
    x: 200,
    y: 650,
    size: 16,
    commands: [],
    issueMoveCommand(x, y, options) { this.commands.push({ x, y, append: !!options?.append }); return true; }
  };

  assert.equal(castleCommands.commandEnter(unit, building, { x: 464, y: 464 }, { tileSize: 32, homeType: 'home' }), false);
  assert.equal(castleCommands.commandRampart(unit, building, { tileSize: 32, homeType: 'home' }), false);
  assert.equal(castleCommands.getTopDefender(building, [unit], { tileSize: 32, homeType: 'home' }), null);
  assert.equal(unit.commands.length, 0);
  assert.equal(castleCommands.issueRoute(unit, [{ x: 240, y: 650 }]), true);
  assert.equal(unit.commands.length, 1);
});

test('map builder runtime orchestrates brush paint and export without owning globals', () => {
  const context = loadOpenRTSScript('../../world/objects/MapBuilderBrushService.js');
  loadOpenRTSScript('../../world/objects/MapBuilderRuntimeService.js', context);
  const terrain = { WATER: 1, SAND: 2, GRASS: 3, DIRT: 4 };
  const obstacle = { NONE: 0, TREE: 1, ROCK: 2 };
  const decor = { NONE: 0 };
  const height = { LOW: -1, GROUND: 0, HIGH: 1, RAMP: 2 };
  const terrainData = Array.from({ length: 2 }, () => Array(2).fill(terrain.GRASS));
  const obstacleData = Array.from({ length: 2 }, () => Array(2).fill(obstacle.NONE));
  const decorationData = Array.from({ length: 2 }, () => Array(2).fill(decor.NONE));
  const heightData = Array.from({ length: 2 }, () => Array(2).fill(height.GROUND));
  let touched = 0;

  const result = context.OpenRTS.world.mapBuilderRuntime.paintTile(16, 16, {
    tileSize: 32,
    tool: 'water',
    terrain,
    obstacle,
    decor,
    height,
    terrainData,
    obstacleData,
    decorationData,
    heightData,
    houses: [],
    isInsideMap: () => true,
    rebuildObstacles: () => touched++,
    touchEditedMap: () => touched++
  });
  const exported = context.OpenRTS.world.mapBuilderRuntime.exportMap({
    name: 'Arena',
    rows: 2,
    columns: 2,
    tileSize: 32,
    terrainData,
    obstacleData,
    decorationData,
    heightData,
    houses: [{ tileX: 0, tileY: 0 }, { tileX: 1, tileY: 1, isWreck: true }]
  });

  assert.equal(result.changed, true);
  assert.equal(terrainData[0][0], terrain.WATER);
  assert.equal(touched, 2);
  assert.equal(exported.name, 'Arena');
  assert.deepEqual(JSON.parse(JSON.stringify(exported.houses)), [{ tileX: 0, tileY: 0 }]);
});

test('world object factories create damageable houses and resource nodes', () => {
  let destroyedHouse = null;
  let changedMine = null;
  const context = loadOpenRTSScript('../../world/objects/HouseService.js');
  loadOpenRTSScript('../../world/objects/ResourceNodeService.js', context);

  const house = context.OpenRTS.world.objectFactories.houses.createNeutralHouse({
    id: 'house-test',
    tileX: 2,
    tileY: 3,
    x: 64,
    y: 96,
    maxHp: 30,
    onDestroyed: object => { destroyedHouse = object; }
  });
  const mine = context.OpenRTS.world.objectFactories.resources.createGoldMine({
    id: 'gold-test',
    amount: 20,
    onChanged: object => { changedMine = object; }
  });

  house.takeDamage(40);
  mine.takeDamage(7);
  mine.takeDamage(99);

  assert.equal(house.hp, 0);
  assert.equal(destroyedHouse, house);
  assert.equal(mine.amount, 0);
  assert.equal(mine.isDead, true);
  assert.equal(changedMine, mine);
});

test('world object factories create carryable items and obstacles with lifecycle hooks', () => {
  let destroyedItem = null;
  let destroyedObstacle = null;
  const context = loadOpenRTSScript('../../world/objects/ItemService.js');
  loadOpenRTSScript('../../world/objects/ObstacleService.js', context);

  const item = context.OpenRTS.world.objectFactories.items.createWorldItem({
    id: 'kit-1',
    item: { id: 'field_kit', name: 'Field Kit' },
    onDestroyed: object => { destroyedItem = object; }
  });
  const obstacle = context.OpenRTS.world.objectFactories.obstacles.createObstacle({
    id: 'tree-1',
    isTree: true,
    onDestroyed: object => { destroyedObstacle = object; }
  });

  item.takeDamage(12);
  obstacle.takeDamage(500);

  assert.equal(item.isDead, true);
  assert.equal(destroyedItem, item);
  assert.equal(obstacle.material, 'Wood');
  assert.equal(obstacle.isDead, true);
  assert.equal(destroyedObstacle, obstacle);
});

test('object factory registry describes and creates registered object categories', () => {
  const context = loadOpenRTSScript('../../world/objects/HouseService.js');
  loadOpenRTSScript('../../world/objects/ItemService.js', context);
  loadOpenRTSScript('../../world/objects/ObjectFactoryRegistry.js', context);

  const registry = context.OpenRTS.world.objectFactories.registry;
  const item = registry.create('items', 'createWorldItem', {
    id: 'registry-item',
    item: { id: 'kit', name: 'Kit' }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(registry.categories())), ['houses', 'items']);
  assert.equal(item.displayName, 'Kit');
  assert.ok(registry.describe().categories.some(category => category.category === 'items'));
});

test('building services create damageable buildings and expose reusable queries', () => {
  const context = loadOpenRTSScript('../../world/objects/HitTestService.js');
  loadOpenRTSScript('../../world/objects/BuildingService.js', context);
  loadOpenRTSScript('../../world/objects/BuildingQueryService.js', context);

  const building = context.OpenRTS.world.objectFactories.buildings.createBuilding({
    id: 'castle-red',
    type: 'home',
    team: 'red',
    tileX: 4,
    tileY: 5,
    tileSize: 32,
    stats: { width: 9, height: 9, hp: 500, size: 288, name: 'Castle' }
  });
  const tower = context.OpenRTS.world.objectFactories.buildings.createBuilding({
    id: 'tower-blue',
    type: 'tower',
    team: 'blue',
    tileX: 20,
    tileY: 5,
    tileSize: 32,
    stats: { width: 2, height: 2, hp: 100, size: 64, name: 'Tower' }
  });

  building.takeDamage(125);

  assert.equal(building.hp, 375);
  assert.equal(context.OpenRTS.world.buildingQueries.teamHome([building, tower], 'red').id, 'castle-red');
  assert.equal(context.OpenRTS.world.buildingQueries.atWorldPoint([building, tower], building.x, building.y, { tileSize: 32 }).id, 'castle-red');
  assert.equal(context.OpenRTS.world.buildingQueries.nearPoint([building, tower], building.x, building.y, 10, { tileSize: 32 }).length, 1);
});

test('unit comparison roster fallback uses allowed package units instead of hardcoded soldier', () => {
  const context = loadOpenRTSScript('../../world/gameState.js', {
    mapConfig: {
      modeId: 'unit_comparison',
      enabledUnits: ['ue_constructor', 'ue_raider']
    },
    UNIT_DEFINITIONS: {
      ue_constructor: { id: 'ue_constructor', name: 'Constructor Bot' },
      ue_raider: { id: 'ue_raider', name: 'Raider Bot' }
    },
    getGameModeDefinition: () => ({
      allowedUnits: ['ue_constructor', 'ue_raider']
    }),
    getUnitDefinition: unitType => ({
      id: unitType,
      maxPerTeam: 80
    })
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getComparisonUnitList({ soldier: 5 }, null, context.mapConfig))),
    ['ue_constructor']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getComparisonUnitList({ ue_raider: 2 }, null, context.mapConfig))),
    ['ue_raider', 'ue_raider']
  );
});

test('unit comparison mode allows temporary player micro control', () => {
  const context = loadOpenRTSScript('../../world/gameState.js', {
    mapConfig: { modeId: 'unit_comparison' }
  });
  const attacker = {
    id: 1,
    team: 'red',
    x: 0,
    y: 0,
    isDead: false,
    hiddenInHouse: false,
    comparisonManualControlTime: 0,
    issueAttackCommand(target) {
      this.attackOrderTarget = target;
      this.attackOrders = (this.attackOrders || 0) + 1;
    },
    isEnemyValid(other) {
      return !!other && !other.isDead && other.team !== this.team;
    }
  };
  const defender = {
    id: 2,
    team: 'blue',
    x: 30,
    y: 0,
    isDead: false,
    hiddenInHouse: false,
    issueAttackCommand(target) {
      this.attackOrderTarget = target;
    },
    isEnemyValid(other) {
      return !!other && !other.isDead && other.team !== this.team;
    }
  };

  context.markComparisonUnitManualControl(attacker, 1);
  context.updateActiveGameMode(0.25, [attacker, defender]);

  assert.equal(attacker.attackOrderTarget, undefined);
  assert.equal(attacker.comparisonManualControlTime, 0.75);

  context.updateActiveGameMode(0.8, [attacker, defender]);

  assert.equal(attacker.attackOrderTarget, defender);
  assert.equal(attacker.attackOrders, 1);
});

test('building placement service validates footprints, castle aprons, and nearest sites', () => {
  const context = loadOpenRTSScript('../../world/objects/BuildingPlacementService.js');
  const placement = context.OpenRTS.world.buildingPlacement;
  const blocked = new Set(['3,3', '5,8']);
  const options = {
    stats: { width: 3, height: 3 },
    tileSize: 32,
    homeType: 'home',
    isInsideMap: (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12,
    isWaterTile: () => false,
    hasObstacle: (x, y) => blocked.has(`${x},${y}`),
    hasGoldMine: () => false,
    hasHouse: () => false,
    isBlockedByBuilding: () => false
  };

  assert.equal(placement.canPlaceAt('tower', 2, 2, options), false);
  assert.equal(placement.canPlaceAt('tower', 6, 2, options), true);
  assert.equal(placement.canPlaceAt('home', 4, 4, options), false);
  assert.ok(placement.padTiles('home', 4, 4, options).some(tile => tile.y === 8));

  const nearest = placement.findNearestBuildableSite('tower', 8 * 32, 3 * 32, {
    ...options,
    canPlace: (type, x, y) => placement.canPlaceAt(type, x, y, options)
  });
  assert.deepEqual(JSON.parse(JSON.stringify(nearest)), { x: 6, y: 1 });
});

test('three render domains provide registry-backed dynamic render sources', () => {
  const unit = { id: 1 };
  const sheep = { id: 'wildlife-1', displayName: 'Sheep' };
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeRenderDomains.js', {
    OpenRTS: {
      entities: {
        query: {
          query: () => [],
          sources: filter => {
            if (filter.category === 'unit') return [unit];
            if (filter.category === 'wildlife' && filter.predicate({ source: sheep })) return [sheep];
            return [];
          }
        }
      },
      systems: { projectiles: { getProjectiles: () => [] } },
      config: { assets: { loadState: { loaded: true }, resolveModel: id => ({ id }) } },
      diagnostics: { register() {} },
      rendering: {}
    }
  });

  const sources = context.OpenRTS.rendering.threeDomains.getDynamicRenderSources([]);
  assert.deepEqual(JSON.parse(JSON.stringify(sources.units)), [unit]);
  assert.deepEqual(JSON.parse(JSON.stringify(sources.sheep)), [sheep]);
  assert.equal(context.OpenRTS.rendering.threeDomains.resolveModelAsset({ unitType: 'worker' }, 'unit').id, 'unit.worker');
});

test('scenario registry loads data-driven match definitions', async () => {
  const context = loadOpenRTSScript('../../game/config/ScenarioRegistry.js', {
    fetch: async path => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        id: path.includes('tower') ? 'tower-defense-basic' : 'versus-default',
        modeId: path.includes('tower') ? 'tower_defense' : 'versus',
        name: path
      })
    })
  });

  await context.OpenRTS.config.scenarios.loadScenarios();

  assert.equal(context.OpenRTS.config.scenarios.listScenarios().length, 2);
  assert.equal(context.OpenRTS.config.scenarios.listScenarios({ modeId: 'versus' })[0].id, 'versus-default');
  assert.equal(context.OpenRTS.config.scenarios.describe().byMode.tower_defense, 1);
});
