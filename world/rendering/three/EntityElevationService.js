(function registerEntityElevationService(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function unitElevation({
    unit,
    terrainElevation = 0,
    defaultFlightHeight = 2.2
  } = {}) {
    const flightElevation = unit?.movementType === 'air'
      ? Number(unit.flightHeight || defaultFlightHeight)
      : 0;
    return terrainElevation + flightElevation;
  }

  app.rendering.entityElevation = Object.freeze({
    unitElevation
  });
})(globalThis);
