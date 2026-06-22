import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('game runtime updates registered systems in stable order with shared context', () => {
  const context = loadOpenRTSScript('../../core/runtime/GameRuntime.js');
  const runtime = context.OpenRTS.runtime;
  const calls = [];
  runtime.setContext({ score: 3 });

  runtime.registerSystem({
    id: 'late',
    order: 20,
    update: (dt, frame) => calls.push(`late:${dt}:${frame.score}`)
  });
  runtime.registerSystem({
    id: 'early',
    order: 10,
    update: (dt, frame) => calls.push(`early:${dt}:${frame.score}`)
  });
  runtime.update(0.25);

  assert.deepEqual(calls, ['early:0.25:3', 'late:0.25:3']);
  assert.equal(runtime.frame, 1);
  assert.equal(runtime.elapsed, 0.25);
  assert.throws(() => runtime.registerSystem({ id: 'early', update() {} }), /already registered/i);
});

test('world runtime owns replaceable collections and generation metadata', () => {
  const context = loadOpenRTSScript('../../world/runtime/WorldRuntime.js');
  const world = context.OpenRTS.world.runtime;
  world.configure({ tileSize: 32, rows: 34, columns: 60 });
  world.beginGeneration(8765);
  const terrain = world.replace('terrain', [[1, 2]]);
  const revision = world.touch('terrain');

  assert.equal(world.get('terrain'), terrain);
  assert.equal(world.seed, 8765);
  assert.equal(world.generation, 1);
  assert.equal(revision, 2);
  assert.equal(world.dimensions().width, 1920);
  assert.equal(world.describe().collections.terrain, 1);
});

test('renderer registry falls back when a preferred renderer declines a frame', () => {
  const context = loadOpenRTSScript('../../core/rendering/RendererRegistry.js');
  const rendering = context.OpenRTS.rendering;
  const calls = [];

  rendering.register({
    id: 'preferred',
    priority: 100,
    render: () => {
      calls.push('preferred');
      return false;
    }
  });
  rendering.register({
    id: 'fallback',
    render: () => calls.push('fallback')
  });

  assert.equal(rendering.render({}), 'fallback');
  assert.deepEqual(calls, ['preferred', 'fallback']);
  assert.equal(rendering.describe().activeId, 'fallback');
});

test('terrain generator produces repeatable maps without browser globals', () => {
  const context = loadOpenRTSScript('../../world/terrain/TerrainGenerator.js');
  const terrain = context.OpenRTS.world.terrain;
  const types = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3 };
  const options = { rows: 12, columns: 18, waterLevel: 20, seed: 4412 };
  const thresholds = terrain.computeThresholds(options);
  const first = terrain.generateGrid({ ...options, thresholds, types });
  const replay = terrain.generateGrid({ ...options, thresholds, types });

  assert.deepEqual(
    first.map(row => Array.from(row)),
    replay.map(row => Array.from(row))
  );
  assert.equal(first.length, 12);
  assert.equal(first[0].length, 18);
  assert.equal(first.flat().some(type => type === types.WATER), true);
  assert.equal(first.flat().some(type => type === types.GRASS), true);
});
