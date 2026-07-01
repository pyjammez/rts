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

  app.world.castleCommands = Object.freeze({
    issueRoute,
    commandEnter: () => false,
    commandExit: () => false,
    commandRampart: () => false,
    getTopDefender: () => null,
    describe() {
      return {
        schemaVersion: 2,
        navigationModel: 'solid-footprint',
        methods: ['issueRoute']
      };
    }
  });

  app.diagnostics?.register?.('castle-commands', () => app.world.castleCommands.describe());
})(globalThis);
