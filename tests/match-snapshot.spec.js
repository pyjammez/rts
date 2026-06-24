import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('match snapshots package config, command log, world metadata, and entity registry state', () => {
  const services = new Map();
  const context = loadOpenRTSScript('../../core/runtime/MatchSnapshot.js', {
    mapConfig: {
      modeId: 'versus',
      playerSlots: [{ flag: 'red', controller: 'human' }]
    },
    playerResources: {
      red: { gold: 100, wood: 50 }
    },
    OpenRTS: {
      config: {
        definitions: {
          manifest: { contentVersion: '0.2.0' }
        }
      },
      runtime: {
        frame: 123,
        registerService: (id, service) => services.set(id, service)
      },
      random: {
        getSeed: () => 9876
      },
      commands: {
        exportCommandLog: metadata => ({
          schemaVersion: 1,
          commandCount: 2,
          metadata,
          commands: [{ type: 'unit.move' }]
        }),
        describe: () => ({ queued: 0, history: 2 })
      },
      world: {
        runtime: {
          generation: 3,
          seed: 9876,
          dimensions: () => ({ width: 1000, height: 800, rows: 25, columns: 30 }),
          describe: () => ({ collectionSizes: { terrain: 25, buildings: 2 } })
        }
      },
      entities: {
        registry: {
          snapshot: () => [{ key: 'unit:1', id: 1, category: 'unit', lifecycle: 'alive' }],
          describe: () => ({ entityCount: 1 })
        }
      },
      modes: {
        runtime: {
          describe: () => ({ activeModeId: 'versus' })
        }
      },
      diagnostics: {
        register() {}
      }
    }
  });

  const first = context.OpenRTS.runtime.matchSnapshots.captureCurrent();
  const second = context.OpenRTS.runtime.matchSnapshots.captureCurrent();

  assert.equal(services.has('match-snapshots'), true);
  assert.equal(first.snapshot.schemaVersion, 1);
  assert.equal(first.snapshot.modeId, 'versus');
  assert.equal(first.snapshot.contentVersion, '0.2.0');
  assert.equal(first.snapshot.seed, 9876);
  assert.equal(first.snapshot.commands.commandCount, 2);
  assert.equal(first.snapshot.entities.length, 1);
  assert.deepEqual(first.snapshot.world.collections, { terrain: 25, buildings: 2 });
  assert.equal(first.checksum, second.checksum);
});
