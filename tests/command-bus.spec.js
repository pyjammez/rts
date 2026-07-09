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

test('command history exports as a versioned replay log with checksum verification', () => {
  const firstContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  firstContext.OpenRTS.version = 'test-game';
  firstContext.OpenRTS.config.definitions = {
    manifest: { contentVersion: 'test-content' }
  };
  const first = firstContext.OpenRTS.commands;
  first.bindFrameProvider(() => 99);
  first.register('test.move', () => true, null, {
    payloadSchema: {
      unitId: { type: 'integer', min: 1 },
      x: 'number'
    }
  });
  first.enqueue({
    type: 'test.move',
    playerId: 'red-player',
    executeFrame: 12,
    payload: { unitId: 3, x: 44 }
  });

  const log = first.exportCommandLog({ mapSeed: 1234 });
  assert.equal(log.schemaVersion, 1);
  assert.equal(log.gameVersion, 'test-game');
  assert.equal(log.contentVersion, 'test-content');
  assert.equal(log.exportedFrame, 99);
  assert.equal(log.commandCount, 1);
  assert.match(log.checksum, /^[0-9a-f]{8}$/);
  assert.equal(first.verifyCommandLog(log).accepted, true);

  const replayContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const replay = replayContext.OpenRTS.commands;
  const executed = [];
  replay.register('test.move', command => executed.push(command.payload), null, {
    payloadSchema: {
      unitId: { type: 'integer', min: 1 },
      x: 'number'
    }
  });
  assert.equal(replay.loadCommandLog(log), 1);
  replay.process(12, {});
  assert.deepEqual(JSON.parse(JSON.stringify(executed)), [{ unitId: 3, x: 44 }]);

  const tampered = {
    ...log,
    commands: [{ ...log.commands[0], payload: { unitId: 3, x: 45 } }]
  };
  assert.equal(first.verifyCommandLog(tampered).accepted, false);
  assert.throws(() => replay.loadCommandLog(tampered), /checksum mismatch/i);
});

test('loading command logs validates registered payload schemas before replay', () => {
  const producerContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const producer = producerContext.OpenRTS.commands;
  producer.register('test.schema-replay', () => true);
  producer.enqueue({
    type: 'test.schema-replay',
    executeFrame: 1,
    payload: { unitId: 0 }
  });
  const log = producer.exportCommandLog();
  assert.equal(producer.verifyCommandLog(log).accepted, true);

  const consumerContext = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const consumer = consumerContext.OpenRTS.commands;
  consumer.register('test.schema-replay', () => true, null, {
    payloadSchema: {
      unitId: { type: 'integer', min: 1 }
    }
  });
  assert.throws(() => consumer.loadCommandLog(log), /unitId.*at least 1/i);
});

test('command validators reject invalid orders without invoking their handlers', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const commands = context.OpenRTS.commands;
  let handled = false;
  commands.register('test.restricted', () => {
    handled = true;
  }, command => command.playerId === 'host' || 'Only the host can issue this command');
  commands.enqueue({ type: 'test.restricted', playerId: 'guest', executeFrame: 1 });

  const [result] = commands.process(1, {});
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'Only the host can issue this command');
  assert.equal(handled, false);
  assert.equal(commands.getRejections().length, 1);
});

test('command bus exposes a distinct attack-move command type', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  assert.equal(context.OpenRTS.commands.types.ATTACK_MOVE, 'unit.attack-move');
});

test('command bus exposes mobile building command types', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  assert.equal(context.OpenRTS.commands.types.BUILDING_LIFT_OFF, 'building.lift-off');
  assert.equal(context.OpenRTS.commands.types.BUILDING_RELOCATE, 'building.relocate');
  assert.equal(context.OpenRTS.commands.types.BUILDING_LAND, 'building.land');
});

test('command bus supports immutable public API with sanctioned command module extensions', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  loadOpenRTSScript('../../game/commands/GameplayCommandHandlers.js', context);

  assert.equal(typeof context.OpenRTS.commands.gameplayHandlers.createRegistrar, 'function');
  assert.equal(Object.isFrozen(context.OpenRTS.commands), true);
});

test('command bus validates payload schemas and reports registered command metadata', () => {
  const context = loadOpenRTSScript('../../game/commands/CommandBus.js');
  const commands = context.OpenRTS.commands;
  commands.register(
    'test.schema',
    () => true,
    null,
    {
      description: 'Schema validation test command',
      payloadSchema: {
        unitId: { type: 'integer', min: 1 },
        x: 'number',
        append: { type: 'boolean', required: false },
        mode: { type: 'string', values: ['move', 'attack'] }
      }
    }
  );

  assert.throws(
    () => commands.enqueue({ type: 'test.schema', payload: { unitId: 0, x: 12, mode: 'move' } }),
    /unitId.*at least 1/i
  );
  assert.throws(
    () => commands.enqueue({ type: 'test.schema', payload: { unitId: 1, x: 12, mode: 'wait' } }),
    /mode.*one of move, attack/i
  );

  commands.enqueue({ type: 'test.schema', payload: { unitId: 1, x: 12.5, mode: 'move' } });
  const description = commands.describe();

  assert.equal(description.registeredCount, 1);
  assert.equal(description.pendingCount, 1);
  assert.equal(description.historyCount, 1);
  assert.equal(description.registered['test.schema'].description, 'Schema validation test command');
  assert.deepEqual(
    JSON.parse(JSON.stringify(description.registered['test.schema'].payloadSchema.mode.values)),
    ['move', 'attack']
  );
});
