import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('entity query facade supports picking and box selection from registry records', () => {
  const context = loadOpenRTSScript('../../ecs/entityManager.js');
  loadOpenRTSScript('../../ecs/EntityQueries.js', context);
  const red = { id: 1, unitType: 'worker', team: 'red', x: 100, y: 100, size: 20, hp: 50, maxHp: 50 };
  const blue = { id: 2, unitType: 'soldier', team: 'blue', x: 180, y: 100, size: 20, hp: 90, maxHp: 90 };
  const sheep = { id: 'wildlife-1', displayName: 'Sheep', objectType: 'wildlife', team: 'neutral', x: 110, y: 100, size: 34, hp: 24, maxHp: 24 };

  context.entityManager.syncAll({
    units: [red, blue],
    collections: { sheep: [sheep] }
  });

  assert.equal(context.OpenRTS.entities.query.aliveUnits({ team: 'red' })[0], red);
  assert.equal(context.OpenRTS.entities.picker.pickAtPoint(100, 100).source, red);
  assert.equal(context.OpenRTS.entities.picker.pickAllAtPoint(110, 100).sheep.source, sheep);
  assert.deepEqual(
    plain(context.OpenRTS.entities.query.entitiesInBox({ minX: 90, maxX: 120, minY: 90, maxY: 120 }, { category: 'unit' }).map(entity => entity.id)),
    [1]
  );
});

test('vision service tracks which enemy entities are visible by team', () => {
  const context = loadOpenRTSScript('../../ecs/entityManager.js');
  loadOpenRTSScript('../../game/systems/visionSystem.js', context);
  const red = { id: 1, unitType: 'scout', team: 'red', x: 0, y: 0, size: 20, hp: 50, maxHp: 50, visionRadius: 120 };
  const closeBlue = { id: 2, unitType: 'soldier', team: 'blue', x: 80, y: 0, size: 20, hp: 50, maxHp: 50 };
  const farBlue = { id: 3, unitType: 'soldier', team: 'blue', x: 400, y: 0, size: 20, hp: 50, maxHp: 50 };

  context.entityManager.syncAll({ units: [red, closeBlue, farBlue] });
  context.OpenRTS.systems.vision.update(0.16, { registry: context.entityManager });

  assert.equal(context.OpenRTS.systems.vision.isVisibleTo('red', context.entityManager.get('unit', 2)), true);
  assert.equal(context.OpenRTS.systems.vision.isVisibleTo('red', context.entityManager.get('unit', 3)), false);
  assert.equal(context.OpenRTS.systems.vision.describe().teams.red, 2);
});

test('asset registry loads logical model and texture references', async () => {
  const context = loadOpenRTSScript('../../game/config/AssetRegistry.js', {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        models: { 'unit.worker': { kind: 'procedural', factory: 'worker' } },
        textures: { 'terrain.grass': { url: 'assets/grass.png' } },
        sounds: {}
      })
    })
  });

  await context.OpenRTS.config.assets.loadAssetManifest();

  assert.equal(context.OpenRTS.config.assets.resolveModel('unit.worker').factory, 'worker');
  assert.equal(context.OpenRTS.config.assets.resolveTexture('terrain.grass').url, 'assets/grass.png');
  assert.equal(context.OpenRTS.config.assets.describe().counts.models, 1);
});
