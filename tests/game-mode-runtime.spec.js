import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('game mode runtime exposes a consistent lifecycle contract', () => {
  const context = loadOpenRTSScript('../../game/modes/GameModeRuntime.js');
  const runtime = context.OpenRTS.modes.runtime;
  const calls = [];

  runtime.register('versus', {
    createMatch(config) {
      calls.push(['create', config.modeId]);
      return { modeId: config.modeId, created: true };
    },
    spawnInitialWorld(match) {
      calls.push(['spawn', match.modeId]);
    },
    update(dt, match) {
      calls.push(['update', dt, match.modeId]);
      return null;
    },
    checkVictory(match) {
      calls.push(['victory', match.modeId]);
      return { winner: 'red' };
    },
    describeSetup() {
      return { sections: ['map', 'forces'] };
    }
  });

  const active = runtime.activate('versus', { modeId: 'versus' }, { frame: 12 });
  runtime.spawnInitialWorld();
  runtime.update(0.25);
  const result = runtime.checkVictory();
  const description = runtime.describe();

  assert.equal(active.match.created, true);
  assert.deepEqual(calls, [
    ['create', 'versus'],
    ['spawn', 'versus'],
    ['update', 0.25, 'versus'],
    ['victory', 'versus']
  ]);
  assert.deepEqual(result, { winner: 'red' });
  assert.equal(description.activeModeId, 'versus');
  assert.equal(description.modes.versus.hooks.includes('update'), true);
});
