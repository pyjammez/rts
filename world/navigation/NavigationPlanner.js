(function registerNavigationPlanner(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function createNavigationPlanner({ navigation, tileSize = 32 } = {}) {
    function worldToTile(point) {
      return {
        x: Math.floor((Number(point?.x) || 0) / tileSize),
        y: Math.floor((Number(point?.y) || 0) / tileSize)
      };
    }

    function tileCenter(tile) {
      return {
        x: tile.x * tileSize + tileSize * 0.5,
        y: tile.y * tileSize + tileSize * 0.5
      };
    }

    function nearestReachableDestination(point, unitSize = 20, options = {}) {
      if (!navigation?.findNearestWalkablePoint) return null;
      return navigation.findNearestWalkablePoint(point.x, point.y, unitSize, options.maxRadius || 18, options);
    }

    function planStraightPath(start, destination, options = {}) {
      if (!start || !destination) return [];
      const startTile = worldToTile(start);
      const endTile = worldToTile(destination);
      if (navigation?.hasLineOfSight?.(startTile, endTile, options)) return [destination];
      return navigation?.smoothPath?.([startTile, endTile], options).map(tileCenter) || [destination];
    }

    function describe() {
      return {
        schemaVersion: 1,
        hasNavigation: !!navigation,
        tileSize
      };
    }

    return Object.freeze({
      worldToTile,
      tileCenter,
      nearestReachableDestination,
      planStraightPath,
      describe
    });
  }

  app.world.navigationPlanner = Object.freeze({ createNavigationPlanner });
})(globalThis);
