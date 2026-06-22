import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('command bus executes serializable commands in deterministic frame and sequence order', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const commands = context.OpenRTS.commands;
  const executed = [];
  commands.register('test.move', command => executed.push(command.payload.unitId));
  commands.bindFrameProvider(() => 10);

  commands.enqueue({ type: 'test.move', payload: { unitId: 2 } });
  commands.enqueue({ type: 'test.move', payload: { unitId: 1 } });

  assert.equal(commands.process(10, {}).length, 0);
  assert.deepEqual(Array.from(commands.process(11, {}), result => result.accepted), [true, true]);
  assert.deepEqual(executed, [2, 1]);
  assert.doesNotThrow(() => JSON.stringify(commands.getHistory()));
});

test('recorded command history can be loaded and replayed at its original frames', () => {
  const firstContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const first = firstContext.OpenRTS.commands;
  first.register('test.attack', () => true);
  first.enqueue({
    type: 'test.attack',
    playerId: 'red-player',
    executeFrame: 42,
    payload: { unitId: 7, targetId: 9 }
  });
  const recording = first.getHistory();

  const replayContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const replay = replayContext.OpenRTS.commands;
  const executed = [];
  replay.register('test.attack', command => executed.push(command.payload));
  replay.loadHistory(recording);

  assert.equal(replay.process(41, {}).length, 0);
  assert.equal(replay.process(42, {}).length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(executed)), [{ unitId: 7, targetId: 9 }]);
});

test('command validators reject invalid orders without invoking their handlers', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const commands = context.OpenRTS.commands;
  let handled = false;
  commands.register('test.restricted', () => {
    handled = true;
  }, command => command.playerId === 'host');
  commands.enqueue({ type: 'test.restricted', playerId: 'guest', executeFrame: 1 });

  const [result] = commands.process(1, {});
  assert.equal(result.accepted, false);
  assert.equal(handled, false);
});
