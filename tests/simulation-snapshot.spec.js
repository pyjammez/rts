import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('simulation checksums are stable across entity ordering and tiny float noise', () => {
  const context = loadOpenRTSScript('../../core/runtime/SimulationSnapshot.js');
  const diagnostics = context.OpenRTS.diagnostics.simulation;
  const red = { id: 10, unitType: 'soldier', team: 'red', x: 12.00001, y: 8, hp: 90, maxHp: 100 };
  const blue = { id: 2, unitType: 'archer', team: 'blue', x: 40, y: 18, hp: 70, maxHp: 70 };
  const first = diagnostics.capture({ frame: 60, seed: 42, modeId: 'versus', units: [red, blue] });
  const reordered = diagnostics.capture({
    frame: 60,
    seed: 42,
    modeId: 'versus',
    units: [{ ...blue }, { ...red, x: 12.00002 }]
  });

  assert.deepEqual(first.units.map(unit => unit.id), [2, 10]);
  assert.equal(diagnostics.checksum(first), diagnostics.checksum(reordered));
});

test('simulation checksums change when authoritative state changes', () => {
  const context = loadOpenRTSScript('../../core/runtime/SimulationSnapshot.js');
  const diagnostics = context.OpenRTS.diagnostics.simulation;
  diagnostics.bindStateProvider(() => ({
    frame: 120,
    seed: 99,
    units: [{ id: 1, team: 'red', x: 10, y: 10, hp: 100, maxHp: 100 }]
  }));
  const original = diagnostics.captureCurrent();
  const damaged = diagnostics.capture({
    frame: 120,
    seed: 99,
    units: [{ id: 1, team: 'red', x: 10, y: 10, hp: 99, maxHp: 100 }]
  });

  assert.match(original.checksum, /^[0-9a-f]{8}$/);
  assert.notEqual(original.checksum, diagnostics.checksum(damaged));
});
