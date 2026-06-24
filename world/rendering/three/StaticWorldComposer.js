(function registerStaticWorldComposer(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function addOne(group, item) {
    if (group && item) group.add(item);
  }

  function addMany(group, items) {
    for (const item of items || []) addOne(group, item);
  }

  function compose({
    group,
    clear = true,
    onReset,
    createTerrainMeshes,
    obstacleData = [],
    decorationData = [],
    obstacle = {},
    decor = {},
    rows = 0,
    columns = 0,
    createTree,
    createRock,
    createMapDecoration,
    buildings = [],
    homeType,
    createCastle,
    createDefenseTower,
    goldMines = [],
    createGoldMine,
    houses = [],
    createNeutralHouse
  } = {}) {
    if (!group) return false;
    if (clear && typeof group.clear === 'function') group.clear();
    if (typeof onReset === 'function') onReset();

    addMany(group, typeof createTerrainMeshes === 'function' ? createTerrainMeshes() : []);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const obstacleType = obstacleData[y]?.[x];
        if (obstacleType === obstacle.TREE) addOne(group, createTree?.(x, y));
        if (obstacleType === obstacle.ROCK) addOne(group, createRock?.(x, y));
        addOne(group, createMapDecoration?.(x, y, decorationData[y]?.[x], decor));
      }
    }

    for (const building of buildings) {
      if (building.isDead) continue;
      addOne(group, building.type === homeType ? createCastle?.(building) : createDefenseTower?.(building));
    }

    for (const mine of goldMines) {
      if (!mine.isDead) addOne(group, createGoldMine?.(mine));
    }

    for (const house of houses) {
      if (!house.isDead || house.isWreck) addOne(group, createNeutralHouse?.(house));
    }

    return true;
  }

  app.rendering.staticWorldComposer = Object.freeze({
    compose
  });
})(globalThis);
