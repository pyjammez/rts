(function registerTerrainGenerator(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before TerrainGenerator.js');

  function hashNoise(x, y, seed) {
    let hash = (x * 374761393 + y * 668265263 + seed * 1597334677) >>> 0;
    hash ^= hash >>> 13;
    hash = (hash * 1274126177) >>> 0;
    hash ^= hash >>> 16;
    return hash / 4294967295;
  }

  function smoothValueNoise(x, y, scale, seed) {
    const nx = x / scale;
    const ny = y / scale;
    const x0 = Math.floor(nx);
    const y0 = Math.floor(ny);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = nx - x0;
    const fy = ny - y0;
    const n00 = hashNoise(x0, y0, seed);
    const n10 = hashNoise(x1, y0, seed);
    const n01 = hashNoise(x0, y1, seed);
    const n11 = hashNoise(x1, y1, seed);
    const ix0 = n00 + (n10 - n00) * fx;
    const ix1 = n01 + (n11 - n01) * fx;
    return ix0 + (ix1 - ix0) * fy;
  }

  function fbmNoise(x, y, seed) {
    const first = smoothValueNoise(x, y, 7, seed);
    const second = smoothValueNoise(x + 31, y + 17, 13, seed);
    const third = smoothValueNoise(x + 59, y + 41, 23, seed);
    return first * 0.55 + second * 0.3 + third * 0.15;
  }

  function computeThresholds({ rows, columns, waterLevel, seed }) {
    const values = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) values.push(fbmNoise(x, y, seed));
    }
    values.sort((left, right) => left - right);

    const waterPercent = Math.max(0, Math.min(1, waterLevel / 100));
    const sandPercent = waterPercent > 0 ? Math.min(waterPercent + 0.07, 1) : 0;
    const percentile = percent => {
      if (percent <= 0) return -Infinity;
      if (percent >= 1) return Infinity;
      return values[Math.min(Math.floor(percent * values.length), values.length - 1)];
    };

    return Object.freeze({
      water: percentile(waterPercent),
      sand: percentile(sandPercent),
      grass: Infinity
    });
  }

  function typeAt(x, y, { seed, thresholds, types }) {
    const height = fbmNoise(x, y, seed);
    if (height < thresholds.water) return types.WATER;
    if (height < thresholds.sand) return types.SAND;
    if (height < thresholds.grass) return types.GRASS;
    return types.DIRT;
  }

  function generateGrid({ rows, columns, seed, thresholds, types }) {
    return Array.from({ length: rows }, (_, y) =>
      Array.from({ length: columns }, (_, x) =>
        typeAt(x + 0.5, y + 0.5, { seed, thresholds, types })
      )
    );
  }

  app.world.terrain = Object.freeze({
    hashNoise,
    smoothValueNoise,
    fbmNoise,
    computeThresholds,
    typeAt,
    generateGrid
  });
})(globalThis);
