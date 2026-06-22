import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('the larger castle keeps three ordered lanes through its open archway', () => {
  const buildingDefinitions = JSON.parse(fs.readFileSync(new URL('../assets/data/buildings.json', import.meta.url), 'utf8'));
  assert.equal(buildingDefinitions.home.width, 9);
  assert.equal(buildingDefinitions.home.height, 9);

  const source = fs.readFileSync(new URL('../world/map.js', import.meta.url), 'utf8');
  const start = source.indexOf('function getCastleDoorPoints');
  const end = source.indexOf('function issueUnitRoute', start);
  const context = {
    BUILDING_TYPES: { HOME: 'home' },
    tileSize: 32,
    tileCenter: (x, y) => ({ x: x * 32 + 16, y: y * 32 + 16 })
  };
  context.globalThis = context;
  vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.getDoor = getCastleDoorPoints;`, context);

  const castle = { type: 'home', tileX: 10, tileY: 20, width: 9, height: 9 };
  const lanes = [0, 1, 2].map(index => context.getDoor(castle, index));
  assert.equal(new Set(lanes.map(lane => lane.threshold.x)).size, 3);
  for (const lane of lanes) {
    assert.ok(lane.inside.y < lane.threshold.y);
    assert.ok(lane.threshold.y < lane.outside.y);
  }
});
