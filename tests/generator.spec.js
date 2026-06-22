import assert from 'node:assert/strict';
import test from 'node:test';
import { generateMap } from '../generators/MapGenerator.js';
import { populate } from '../generators/Populator.js';

test('map generation and population accept deterministic random sources', () => {
  const values = [0.01, 0.8, 0.02, 0.9];
  let index = 0;
  const map = generateMap(2, 2, {
    waterChance: 0.5,
    random: () => values[index++ % values.length]
  });
  assert.equal(map.width, 2);
  assert.equal(map.height, 2);
  assert.deepEqual(map.tiles.map(row => row.map(tile => tile.type)), [
    ['water', 'grass'],
    ['water', 'grass']
  ]);

  const placed = populate({}, map, {
    trees: 2,
    rocks: 1,
    sheep: 1,
    units: ['soldier'],
    random: () => 0.25
  });
  assert.equal(placed.trees.length, 2);
  assert.equal(placed.rocks.length, 1);
  assert.equal(placed.sheep.length, 1);
  assert.equal(placed.units.length, 1);
  assert.equal(placed.units[0].def, 'soldier');
});
