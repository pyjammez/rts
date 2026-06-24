(function registerCastleCommandService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function issueRoute(unit, points, append = false) {
    const validPoints = points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y));
    let issued = 0;
    for (const point of validPoints) {
      if (Math.hypot(point.x - unit.x, point.y - unit.y) < Math.max(6, unit.size * 0.35)) continue;
      const accepted = unit.issueMoveCommand(point.x, point.y, { append: issued === 0 ? append : true });
      if (accepted) issued++;
    }
    return issued > 0;
  }

  function clearTopCommand(unit) {
    if (!unit) return;
    unit.castleTopBuildingId = null;
    unit.castleTopStairPoint = null;
    unit.castleTopReached = false;
    unit.castleRampBase = null;
    unit.castleRampTop = null;
    unit.castleRampClimbed = false;
  }

  function commandEnter(unit, building, destination, options = {}) {
    if (!unit || !building || !destination || unit.isDead || building.isDead) return false;
    const geometry = app.world.castleGeometry;
    const route = geometry.routeIntoCastle(unit, building, destination, options);
    if (route.length === 1) {
      unit.issueMoveCommand(destination.x, destination.y, { append: !!options.append });
      return true;
    }
    if (route.length === 0) return false;
    clearTopCommand(unit);
    return issueRoute(unit, route, !!options.append);
  }

  function commandExit(unit, building, destination, options = {}) {
    if (!unit || !building || !destination || unit.isDead || building.isDead) return false;
    const route = app.world.castleGeometry.routeOutOfCastle(building, destination, options);
    if (route.length === 0) return false;
    clearTopCommand(unit);
    return issueRoute(unit, route, !!options.append) ||
      unit.issueMoveCommand(destination.x, destination.y, { append: !!options.append });
  }

  function commandRampart(unit, building, options = {}) {
    if (!unit || !building || building.isDead || building.type !== (options.homeType || 'home')) return false;
    if (unit.isDead || unit.team !== building.team) return false;

    const geometry = app.world.castleGeometry;
    const wallSlots = geometry.getWallSlots(building, options);
    const ramp = geometry.getRampPoints(building, options);
    const stairPoint = geometry.getStairPoint(building, options.index || 0, options.total || 1, options);
    if (!stairPoint || !ramp || wallSlots.length === 0) return false;

    const destinationIndex = geometry.getNearestWallSlotIndex(wallSlots, stairPoint.x, stairPoint.y);
    const alreadyOnRamparts = unit.castleTopBuildingId === building.id && unit.castleRampClimbed;
    const startIndex = alreadyOnRamparts
      ? geometry.getNearestWallSlotIndex(wallSlots, unit.x, unit.y)
      : ramp.topSlotIndex;
    const wallRoute = geometry.getWallRoute(wallSlots, startIndex, destinationIndex);

    if (alreadyOnRamparts) {
      const route = wallRoute.length > 0 ? wallRoute : [wallSlots[destinationIndex]];
      route.forEach((point, routeIndex) => {
        unit.issueMoveCommand(point.x, point.y, { append: routeIndex === 0 ? !!options.append : true });
      });
    } else {
      unit.issueMoveCommand(ramp.base.x, ramp.base.y, { append: !!options.append });
      unit.issueMoveCommand(ramp.top.x, ramp.top.y, { append: true });
      wallRoute.forEach(point => unit.issueMoveCommand(point.x, point.y, { append: true }));
    }

    unit.castleTopBuildingId = building.id;
    unit.castleTopStairPoint = stairPoint;
    unit.castleTopReached = false;
    unit.castleRampBase = ramp.base;
    unit.castleRampTop = ramp.top;
    unit.castleRampClimbed = alreadyOnRamparts;
    return true;
  }

  function getTopDefender(building, units, options = {}) {
    if (!building || building.type !== (options.homeType || 'home')) return null;
    const tileSize = options.tileSize || 32;
    let defender = null;
    let closestDist = Infinity;
    for (const unit of units || []) {
      if (unit.isDead || unit.team !== building.team || unit.castleTopBuildingId !== building.id) continue;
      const stairPoint = unit.castleTopStairPoint || app.world.castleGeometry.getStairPoint(building, 0, 1, options);
      const dist = stairPoint ? Math.hypot(unit.x - stairPoint.x, unit.y - stairPoint.y) : Infinity;
      if (!unit.castleRampClimbed && unit.castleRampTop) {
        const rampTopDistance = Math.hypot(unit.x - unit.castleRampTop.x, unit.y - unit.castleRampTop.y);
        if (rampTopDistance < tileSize * 0.7) unit.castleRampClimbed = true;
      }
      if (dist < tileSize * 0.85) unit.castleTopReached = true;
      if (unit.castleTopReached && dist < closestDist) {
        defender = unit;
        closestDist = dist;
      }
    }
    return defender;
  }

  app.world.castleCommands = Object.freeze({
    issueRoute,
    clearTopCommand,
    commandEnter,
    commandExit,
    commandRampart,
    getTopDefender,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['commandEnter', 'commandExit', 'commandRampart', 'getTopDefender', 'clearTopCommand']
      };
    }
  });

  app.diagnostics?.register?.('castle-commands', () => app.world.castleCommands.describe());
})(globalThis);
