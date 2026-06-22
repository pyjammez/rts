(function registerCookingSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before cookingSystem.js');

  const DEFAULT_DURATION = 10;
  const DEFAULT_MAX_UNITS = 20;
  const DEFAULT_RADIUS_TILES = 5;
  let roasts = [];
  let nextRoastId = 1;

  function reset() {
    roasts = [];
    nextRoastId = 1;
  }

  function start({ sheep, team, removeSheep, tileSize }) {
    if (!sheep || sheep.isDead || sheep.isMounted || sheep.reservedByUnitId) return null;
    if (typeof removeSheep !== 'function' || !removeSheep(sheep)) return null;

    const roast = {
      id: `roast-${nextRoastId++}`,
      x: sheep.x,
      y: sheep.y,
      team,
      age: 0,
      duration: DEFAULT_DURATION,
      rotation: 0,
      healRadius: tileSize * DEFAULT_RADIUS_TILES,
      maxUnits: DEFAULT_MAX_UNITS
    };
    roasts.push(roast);
    app.events?.emit(app.events.types.COOKING_STARTED, { roast });
    return roast;
  }

  function update(dt, units) {
    if (roasts.length === 0) return [];
    const completions = [];

    for (let index = roasts.length - 1; index >= 0; index--) {
      const roast = roasts[index];
      roast.age += dt;
      roast.rotation += dt * 4.2;
      if (roast.age < roast.duration) continue;

      const healedUnits = (Array.isArray(units) ? units : [])
        .filter(unit =>
          !unit.isDead &&
          unit.team === roast.team &&
          Math.hypot(unit.x - roast.x, unit.y - roast.y) <= roast.healRadius
        )
        .sort((a, b) =>
          Math.hypot(a.x - roast.x, a.y - roast.y) -
          Math.hypot(b.x - roast.x, b.y - roast.y)
        )
        .slice(0, roast.maxUnits);

      healedUnits.forEach(unit => {
        unit.hp = unit.maxHp;
      });
      const completion = { roast, healedUnits };
      completions.push(completion);
      app.events?.emit(app.events.types.COOKING_COMPLETED, completion);
      roasts.splice(index, 1);
    }

    return completions;
  }

  function getRoasts() {
    return roasts;
  }

  app.systems.cooking = Object.freeze({
    reset,
    start,
    update,
    getRoasts,
    defaults: Object.freeze({
      duration: DEFAULT_DURATION,
      maxUnits: DEFAULT_MAX_UNITS,
      radiusTiles: DEFAULT_RADIUS_TILES
    })
  });
})(globalThis);
