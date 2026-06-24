(function registerHitTestService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};
  app.world.hitTests = app.world.hitTests || {};

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nearestCircleAtPoint(collection, worldX, worldY, options = {}) {
    if (!Array.isArray(collection)) return null;
    const x = finiteNumber(worldX, NaN);
    const y = finiteNumber(worldY, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const include = typeof options.include === 'function' ? options.include : () => true;
    const radiusFor = typeof options.radius === 'function'
      ? options.radius
      : object => finiteNumber(object?.size, 0);
    const centerXFor = typeof options.centerX === 'function'
      ? options.centerX
      : object => finiteNumber(object?.x, NaN);
    const centerYFor = typeof options.centerY === 'function'
      ? options.centerY
      : object => finiteNumber(object?.y, NaN);

    let closest = null;
    let closestDistance = Infinity;
    for (const object of collection) {
      if (!include(object)) continue;
      const centerX = centerXFor(object);
      const centerY = centerYFor(object);
      const radius = Math.max(0, finiteNumber(radiusFor(object), 0));
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || radius <= 0) continue;
      const distance = Math.hypot(centerX - x, centerY - y);
      if (distance <= radius && distance < closestDistance) {
        closest = object;
        closestDistance = distance;
      }
    }
    return closest;
  }

  function nearestBoxAtPoint(collection, worldX, worldY, options = {}) {
    if (!Array.isArray(collection)) return null;
    const x = finiteNumber(worldX, NaN);
    const y = finiteNumber(worldY, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const include = typeof options.include === 'function' ? options.include : () => true;
    const centerXFor = typeof options.centerX === 'function'
      ? options.centerX
      : object => finiteNumber(object?.x, NaN);
    const centerYFor = typeof options.centerY === 'function'
      ? options.centerY
      : object => finiteNumber(object?.y, NaN);
    const halfWidthFor = typeof options.halfWidth === 'function'
      ? options.halfWidth
      : object => finiteNumber(object?.halfWidth, 0);
    const halfHeightFor = typeof options.halfHeight === 'function'
      ? options.halfHeight
      : object => finiteNumber(object?.halfHeight, 0);

    let closest = null;
    let closestDistance = Infinity;
    for (const object of collection) {
      if (!include(object)) continue;
      const centerX = centerXFor(object);
      const centerY = centerYFor(object);
      const halfWidth = Math.max(0, finiteNumber(halfWidthFor(object), 0));
      const halfHeight = Math.max(0, finiteNumber(halfHeightFor(object), 0));
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || halfWidth <= 0 || halfHeight <= 0) continue;
      if (x < centerX - halfWidth || x > centerX + halfWidth || y < centerY - halfHeight || y > centerY + halfHeight) continue;
      const distance = Math.hypot(centerX - x, centerY - y);
      if (distance < closestDistance) {
        closest = object;
        closestDistance = distance;
      }
    }
    return closest;
  }

  app.world.hitTests = Object.freeze({
    nearestCircleAtPoint,
    nearestBoxAtPoint,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['nearestCircleAtPoint', 'nearestBoxAtPoint']
      };
    }
  });

  app.diagnostics?.register?.('world-hit-tests', () => app.world.hitTests.describe());
})(globalThis);
