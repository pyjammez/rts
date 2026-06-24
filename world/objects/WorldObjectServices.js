(function registerWorldObjectServices(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.objects = app.world.objects || {};

  function call(name, ...args) {
    const fn = root[name];
    return typeof fn === 'function' ? fn(...args) : null;
  }

  function collection(name) {
    return app.world?.runtime?.get ? app.world.runtime.get(name) : [];
  }

  function hitTests() {
    return app.world?.hitTests || null;
  }

  const houses = Object.freeze({
    all: () => collection('houses'),
    atPoint: (x, y) => hitTests()?.nearestCircleAtPoint(collection('houses'), x, y, {
      include: house => !house.isDead || house.isWreck
    }) || call('getHouseAtPoint', x, y),
    doorPoint: house => app.world.houseInteractions?.doorPoint(house, root.tileSize || 32) || null,
    isPointInside: (house, x, y) => !!app.world.houseInteractions?.isPointInside(house, x, y, root.tileSize || 32),
    startBurning: house => app.world.houseInteractions?.startBurning(house, { markDirty: call.bind(null, 'markHousesDirty') }) || call('startBurningHouse', house),
    burnNow: house => call('burnHouseNow', house)
  });

  const resources = Object.freeze({
    goldMines: () => collection('goldMines'),
    goldMineAtPoint: (x, y) => hitTests()?.nearestCircleAtPoint(collection('goldMines'), x, y, {
      include: mine => !mine.isDead
    }) || call('getGoldMineAtPoint', x, y)
  });

  const obstacles = Object.freeze({
    all: () => collection('obstacleEntities'),
    atPoint: (x, y) => hitTests()?.nearestCircleAtPoint(collection('obstacleEntities'), x, y, {
      include: obstacle => !obstacle.isDead && !obstacle.isPickedUp
    }) || call('getObstacleAtPoint', x, y),
    rebuild: () => call('rebuildObstacleEntities')
  });

  const items = Object.freeze({
    all: () => collection('items'),
    atPoint: (x, y) => hitTests()?.nearestCircleAtPoint(collection('items'), x, y, {
      include: item => !item.isDead && !item.isPickedUp
    }) || call('getWorldItemAtPoint', x, y),
    create: (item, x, y) => call('createWorldItem', item, x, y)
  });

  const buildings = Object.freeze({
    all: () => call('getBuildings') || collection('buildings'),
    atPoint: (x, y) => app.world.buildingQueries?.atWorldPoint(buildings.all(), x, y, {
      tileSize: root.tileSize || 32
    }) || hitTests()?.nearestBoxAtPoint(buildings.all(), x, y, {
      include: building => !building.isDead,
      halfWidth: building => building.width * (root.tileSize || 32) * 0.72,
      halfHeight: building => building.height * (root.tileSize || 32) * 0.78
    }) || call('getBuildingAtPoint', x, y),
    selected: () => call('getSelectedBuilding'),
    placeTeams: config => call('placeTeamBuildings', config),
    homeForTeam: team => app.world.buildingQueries?.teamHome(buildings.all(), team, app.world.buildingTypes?.HOME || 'home') || call('getTeamHome', team)
  });

  const castleNavigation = Object.freeze({
    enter: (unit, building, destination, append, laneIndex) => app.world.castleCommands?.commandEnter(unit, building, destination, {
      homeType: app.world.buildingTypes?.HOME || 'home',
      tileSize: root.tileSize || 32,
      laneIndex,
      append
    }) || call('commandUnitIntoCastle', unit, building, destination, append, laneIndex),
    exit: (unit, building, destination, append, laneIndex) => app.world.castleCommands?.commandExit(unit, building, destination, {
      homeType: app.world.buildingTypes?.HOME || 'home',
      tileSize: root.tileSize || 32,
      laneIndex,
      append
    }) || call('commandUnitOutOfCastle', unit, building, destination, append, laneIndex),
    rampart: (unit, building, index, total, append, targetWorldX, targetWorldY) =>
      call('commandUnitToCastleTop', unit, building, index, total, append, targetWorldX, targetWorldY),
    isCourtyardPoint: (building, x, y) => !!call('isCastleCourtyardPoint', building, x, y),
    passageTile: (building, x, y) => !!call('isCastlePassageTile', building, x, y)
  });

  const mapBuilder = Object.freeze({
    paintTile: (x, y, tool) => call('paintMapBuilderTile', x, y, tool),
    exportMap: name => call('exportCurrentMapData', name),
    exportFromData: options => app.world.mapBuilderRuntime?.exportMap(options)
  });

  app.world.objects = Object.freeze({
    houses,
    resources,
    obstacles,
    items,
    buildings,
    castleNavigation,
    mapBuilder,
    describe: () => ({
      schemaVersion: 1,
      services: ['houses', 'resources', 'obstacles', 'items', 'buildings', 'castleNavigation', 'mapBuilder'],
      counts: {
        houses: houses.all().length,
        goldMines: resources.goldMines().length,
        obstacles: obstacles.all().length,
        items: items.all().length,
        buildings: buildings.all().length
      }
    })
  });

  app.diagnostics?.register?.('world-objects', () => app.world.objects.describe());
})(globalThis);
