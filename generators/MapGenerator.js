export function generateMap(width = 64, height = 32, options = {}) {
  const tiles = new Array(height);
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array(width);
    for (let x = 0; x < width; x++) {
      tiles[y][x] = {
        x,
        y,
        type: Math.random() < 0.05 ? 'water' : 'grass',
      };
    }
  }
  return { width, height, tiles };
}
