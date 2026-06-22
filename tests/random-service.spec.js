import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('random streams replay the same sequence for the same seed', () => {
  const context = loadOpenRTSScript('../../core/random/randomService.js');
  context.OpenRTS.random.setSeed('replay-42');
  const first = Array.from({ length: 5 }, () => context.OpenRTS.random.stream('world').next());

  context.OpenRTS.random.setSeed('replay-42');
  const replay = Array.from({ length: 5 }, () => context.OpenRTS.random.stream('world').next());

  assert.deepEqual(first, replay);
});

test('named random streams do not disturb each other', () => {
  const context = loadOpenRTSScript('../../core/random/randomService.js');
  context.OpenRTS.random.setSeed(12345);
  const worldFirst = context.OpenRTS.random.stream('world').next();
  context.OpenRTS.random.stream('effects').next();
  context.OpenRTS.random.stream('effects').next();
  const worldSecond = context.OpenRTS.random.stream('world').next();

  context.OpenRTS.random.setSeed(12345);
  assert.equal(context.OpenRTS.random.stream('world').next(), worldFirst);
  assert.equal(context.OpenRTS.random.stream('world').next(), worldSecond);
});

test('stream helpers provide deterministic game-oriented operations', () => {
  const context = loadOpenRTSScript('../../core/random/randomService.js');
  const stream = context.OpenRTS.random.createStream('loot', 'match-a');
  const values = [1, 2, 3, 4, 5];

  assert.equal(Number.isInteger(stream.int(2, 7)), true);
  assert.equal(stream.range(10, 20) >= 10, true);
  assert.equal(stream.pick(['sword', 'bow']) !== undefined, true);
  assert.equal(stream.shuffle(values), values);
  assert.deepEqual([...values].sort(), [1, 2, 3, 4, 5]);
});
