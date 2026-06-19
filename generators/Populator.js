export function populate(world, map, config = {}) {
  // Place simple objects based on config counts
  const { trees = 10, rocks = 6, sheep = 4, units = [] } = config;
  const placed = { trees: [], rocks: [], sheep: [], units: [] };
  function randTile() {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    return map.tiles[y][x];
  }
  for (let i = 0; i < trees; i++) placed.trees.push(randTile());
  for (let i = 0; i < rocks; i++) placed.rocks.push(randTile());
  for (let i = 0; i < sheep; i++) placed.sheep.push(randTile());
  for (const u of units) placed.units.push({ def: u, pos: randTile() });
  return placed;
}
