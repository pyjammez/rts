import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('game runtime supports init reset update dispose and describe lifecycle hooks', () => {
  const context = loadOpenRTSScript('../../core/runtime/GameRuntime.js');
  const runtime = context.OpenRTS.runtime;
  const calls = [];

  runtime.registerSystem({
    id: 'lifecycle',
    order: 1,
    init: () => calls.push('init'),
    reset: () => calls.push('reset'),
    update: () => calls.push('update'),
    dispose: () => calls.push('dispose'),
    describe: () => ({ ready: true })
  });

  runtime.resetSystems();
  runtime.update(0.1);
  runtime.update(0.1);
  runtime.dispose();

  assert.deepEqual(calls, ['reset', 'init', 'update', 'update', 'dispose']);
  const system = runtime.describe().systems.find(entry => entry.id === 'lifecycle');
  assert.equal(system.lifecycle.init, true);
  assert.deepEqual(system.details, { ready: true });
});

test('simulation context exposes stable runtime service accessors', () => {
  const context = loadOpenRTSScript('../../core/runtime/GameRuntime.js');
  context.mapConfig = { modeId: 'versus' };
  loadOpenRTSScript('../../core/runtime/SimulationContext.js', context);

  assert.equal(context.OpenRTS.simulation.context.config.modeId, 'versus');
  assert.equal(context.OpenRTS.simulation.context.clock.frame, 0);
  assert.equal(context.OpenRTS.simulation.context.snapshot().modeId, 'versus');
  assert.equal(context.OpenRTS.runtime.describe().services.includes('simulation-context'), true);
});

test('renderer factory registry registers and creates renderer objects by logical id', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/RendererFactoryRegistry.js');
  const registry = context.OpenRTS.rendering.factoryRegistry;

  registry.register('unit.worker', payload => ({ type: 'worker', payload }), { category: 'unit' });

  assert.equal(registry.has('unit.worker'), true);
  assert.deepEqual(registry.create('unit.worker', 3), { type: 'worker', payload: 3 });
  assert.equal(registry.describe().count, 1);
});

test('content pack loader loads optional content pack manifests', async () => {
  const context = loadOpenRTSScript('../../game/config/ContentPackLoader.js', {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        id: 'medieval',
        name: 'Medieval Pack',
        version: '1.0.0',
        dependencies: ['core'],
        files: { units: 'units.json' }
      })
    })
  });

  await context.OpenRTS.config.contentPacks.loadContentPacks(['assets/data/packs/medieval/content-pack.json']);

  assert.equal(context.OpenRTS.config.contentPacks.getPack('medieval').name, 'Medieval Pack');
  assert.equal(context.OpenRTS.config.contentPacks.describe().packs[0].dependencies[0], 'core');
});

test('package manifest service validates static game package contracts', () => {
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js');
  const manifests = context.OpenRTS.config.packageManifests;
  const manifest = manifests.normalizeManifest({
    schemaVersion: 1,
    id: 'space_frontier',
    name: 'Space Frontier',
    version: '1.2.3',
    engineVersion: '0.2.0',
    mergeMode: 'merge',
    dependencies: ['shared_fx'],
    provides: ['space_rts'],
    tags: ['sci-fi'],
    files: {
      units: 'units.json',
      buildings: 'buildings.json'
    }
  }, 'games/space_frontier/manifest.json');

  assert.equal(manifest.basePath, 'games/space_frontier/');
  assert.equal(manifest.fingerprint.length, 8);
  assert.equal(manifests.satisfiesEngineVersion('0.2.0', '0.2.5'), true);
  assert.equal(manifests.satisfiesEngineVersion('0.2.0', '1.0.0'), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(manifests.listFileEntries(manifest))).map(entry => entry.path),
    ['games/space_frontier/buildings.json', 'games/space_frontier/units.json']
  );

  const invalid = manifests.validateManifest({
    schemaVersion: 2,
    id: 'Bad Package',
    version: 'one',
    files: { units: '../units.json' },
    dependencies: ['missing_package']
  }, {
    manifestPath: 'games/bad/manifest.json',
    knownPackages: ['shared_fx']
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /lowercase package id/);
  assert.match(invalid.errors.join('\n'), /version must be semantic/);
  assert.match(invalid.errors.join('\n'), /unsafe path/);
  assert.match(invalid.errors.join('\n'), /dependency "missing_package" is not installed/);
});

test('package manifest service creates dependency ordered package locks', () => {
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js');
  const manifests = context.OpenRTS.config.packageManifests;
  const base = manifests.normalizeManifest({
    schemaVersion: 1,
    id: 'shared_fx',
    version: '1.0.0',
    files: { abilities: 'abilities.json' }
  }, 'games/shared_fx/manifest.json');
  const child = manifests.normalizeManifest({
    schemaVersion: 1,
    id: 'space_frontier',
    version: '1.0.0',
    dependencies: ['shared_fx'],
    files: { units: 'units.json' }
  }, 'games/space_frontier/manifest.json');
  const sorted = manifests.sortByDependencies([child, base]);
  const lock = manifests.createPackageLock([child, base]);

  assert.equal(sorted.valid, true);
  assert.deepEqual(JSON.parse(JSON.stringify(sorted.ordered)).map(manifest => manifest.id), ['shared_fx', 'space_frontier']);
  assert.equal(lock.packageCount, 2);
  assert.equal(lock.packages[0].id, 'shared_fx');
  assert.equal(lock.fingerprint.length, 8);
});

test('game package loader fetches package files and merges them over core definitions', async () => {
  const files = {
    'games/desert_command/manifest.json': {
      schemaVersion: 1,
      id: 'desert_command',
      name: 'Desert Command',
      version: '0.1.0',
      files: {
        units: 'units.json',
        factions: 'factions.json',
        rulesets: 'rulesets.json'
      }
    },
    'games/desert_command/units.json': {
      dc_builder: { name: 'Builder Vehicle', hp: 160, speed: 92, size: 24, weapon: 'rifle' }
    },
    'games/desert_command/factions.json': {
      coalition: { name: 'Coalition', ruleset: 'desert', units: ['dc_builder'], buildings: ['home'] }
    },
    'games/desert_command/rulesets.json': {
      desert: { name: 'Desert Rules', resources: { supplies: { name: 'Supplies' } } }
    }
  };
  const context = loadOpenRTSScript('../../game/config/ContentPackLoader.js', {
    URLSearchParams,
    location: { search: '?game=desert_command' },
    fetch: async path => ({
      ok: !!files[path],
      status: files[path] ? 200 : 404,
      json: async () => files[path]
    })
  });

  const gamePackage = await context.OpenRTS.config.gamePackages.loadSelectedGamePackage(context.location);
  const merged = context.OpenRTS.config.gamePackages.applyGamePackage({
    units: { soldier: { name: 'Soldier' } },
    factions: {},
    rulesets: {}
  }, gamePackage);

  assert.equal(gamePackage.id, 'desert_command');
  assert.equal(merged.units.soldier.name, 'Soldier');
  assert.equal(merged.units.dc_builder.hp, 160);
  assert.equal(merged.factions.coalition.name, 'Coalition');
  assert.equal(merged.rulesets.desert.resources.supplies.name, 'Supplies');
  assert.equal(merged.activeGamePackage.id, 'desert_command');
  assert.equal(context.OpenRTS.config.gamePackages.describe().gamePackageCount, 1);
  assert.equal(context.OpenRTS.config.gamePackages.describe().gamePackages[0].id, 'desert_command');
});

test('game package loader exposes fingerprints metadata and package lock when manifest service is loaded', async () => {
  const files = {
    'games/desert_command/manifest.json': {
      schemaVersion: 1,
      id: 'desert_command',
      name: 'Desert Command',
      version: '0.1.0',
      engineVersion: '0.2.0',
      author: 'Open RTS',
      license: 'CC0-1.0',
      provides: ['modern_desert_rts'],
      tags: ['modern'],
      files: {
        units: 'units.json'
      }
    },
    'games/desert_command/units.json': {
      dc_builder: { name: 'Builder Vehicle', hp: 160, speed: 92, size: 24, weapon: 'rifle' }
    }
  };
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js', {
    URLSearchParams,
    location: { search: '?game=desert_command' },
    fetch: async path => ({
      ok: !!files[path],
      status: files[path] ? 200 : 404,
      json: async () => files[path]
    })
  });
  loadOpenRTSScript('../../game/config/ContentPackLoader.js', context);

  await context.OpenRTS.config.gamePackages.loadSelectedGamePackage(context.location);
  const description = context.OpenRTS.config.gamePackages.describe();

  assert.equal(description.activeGamePackage.id, 'desert_command');
  assert.equal(description.activeGamePackage.fingerprint.length, 8);
  assert.equal(description.gamePackages[0].provides[0], 'modern_desert_rts');
  assert.equal(description.gamePackages[0].fileCount, 1);
  assert.equal(description.packageLock.packageCount, 1);
  assert.equal(description.packageLock.packages[0].fingerprint.length, 8);
});

test('headless simulation harness can run fixed frames without DOM or canvas', () => {
  const context = loadOpenRTSScript('../../core/runtime/GameRuntime.js');
  loadOpenRTSScript('../../core/runtime/SimulationContext.js', context);
  loadOpenRTSScript('../../core/runtime/HeadlessSimulationHarness.js', context);
  let ticks = 0;
  context.OpenRTS.runtime.registerSystem({
    id: 'counter',
    update: () => { ticks++; }
  });

  const harness = context.OpenRTS.testing.createHeadlessSimulationHarness({ fixedDt: 0.2 });
  harness.runFrames(5);

  assert.equal(ticks, 5);
  assert.equal(harness.describe().frame, 5);
  assert.equal(harness.describe().resultCount, 5);
});
