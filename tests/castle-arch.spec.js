import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('the larger castle keeps three ordered lanes through its open archway', () => {
  const buildingDefinitions = JSON.parse(fs.readFileSync(new URL('../assets/data/buildings.json', import.meta.url), 'utf8'));
  assert.equal(buildingDefinitions.home.width, 9);
  assert.equal(buildingDefinitions.home.height, 9);

  const context = loadOpenRTSScript('../../world/objects/CastleGeometryService.js');

  const castle = { type: 'home', tileX: 10, tileY: 20, width: 9, height: 9 };
  const lanes = [0, 1, 2].map(index => context.OpenRTS.world.castleGeometry.getDoorPoints(castle, index, { tileSize: 32 }));
  assert.equal(new Set(lanes.map(lane => lane.threshold.x)).size, 3);
  for (const lane of lanes) {
    assert.ok(lane.inside.y < lane.threshold.y);
    assert.ok(lane.threshold.y < lane.outside.y);
  }
});

test('castle geometry returns deterministic door and rampart routes', () => {
  const context = loadOpenRTSScript('../../world/objects/CastleGeometryService.js');
  const geometry = context.OpenRTS.world.castleGeometry;
  const castle = { id: 'home-red', type: 'home', tileX: 10, tileY: 20, width: 9, height: 9, x: 464, y: 784 };
  const outsideUnit = { x: 200, y: 960 };
  const destination = { x: 464, y: 784 };

  const route = geometry.routeIntoCastle(outsideUnit, castle, destination, { tileSize: 32 });
  const slots = geometry.getWallSlots(castle, { tileSize: 32 });
  const ramp = geometry.getRampPoints(castle, { tileSize: 32 });
  const wallRoute = geometry.getWallRoute(slots, ramp.topSlotIndex, 4);

  assert.equal(route.at(-1), destination);
  assert.ok(route.length >= 4);
  assert.equal(slots.length, 32);
  assert.ok(ramp.base.x < ramp.top.x);
  assert.ok(wallRoute.length > 0);
});
