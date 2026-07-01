import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('home castles are solid building footprints, not walkable interiors', () => {
  const buildingDefinitions = JSON.parse(fs.readFileSync(new URL('../assets/data/buildings.json', import.meta.url), 'utf8'));
  assert.equal(buildingDefinitions.home.width, 9);
  assert.equal(buildingDefinitions.home.height, 9);

  const context = loadOpenRTSScript('../../world/objects/CastleGeometryService.js');
  const geometry = context.OpenRTS.world.castleGeometry;
  const castle = { type: 'home', tileX: 10, tileY: 20, width: 9, height: 9 };

  assert.equal(geometry.isPointInside(castle, 10 * 32 + 16, 20 * 32 + 16, { tileSize: 32 }), true);
  assert.equal(geometry.isPointInside(castle, 9 * 32 + 16, 20 * 32 + 16, { tileSize: 32 }), false);
  assert.equal(typeof geometry.getDoorPoints, 'undefined');
  assert.equal(typeof geometry.routeIntoCastle, 'undefined');
  assert.equal(typeof geometry.getWallSlots, 'undefined');
});
