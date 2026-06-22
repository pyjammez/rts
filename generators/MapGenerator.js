export function generateMap(width = 64, height = 32, options = {}) {
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const configuredWaterChance = Number(options.waterChance);
  const waterChance = Math.max(0, Math.min(1, Number.isFinite(configuredWaterChance) ? configuredWaterChance : 0.05));
  const tiles = new Array(height);
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array(width);
    for (let x = 0; x < width; x++) {
      tiles[y][x] = {
        x,
        y,
        type: random() < waterChance ? 'water' : 'grass',
      };
    }
  }
  return { width, height, tiles };
}
