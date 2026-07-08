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

test('package manifest service normalizes and searches static package indexes', () => {
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js');
  const manifests = context.OpenRTS.config.packageManifests;
  const index = manifests.normalizePackageIndex({
    schemaVersion: 1,
    name: 'Sample Packages',
    packages: [
      {
        id: 'spacesiege',
        manifest: 'spacesiege/manifest.json',
        featured: true,
        category: 'sci_fi',
        style: 'mineral gas supply',
        tags: ['sci-fi', 'air']
      },
      {
        id: 'battleforge',
        manifest: 'battleforge/manifest.json',
        category: 'fantasy',
        tags: ['forest']
      }
    ]
  }, 'games/index.json');
  const validation = manifests.validatePackageIndex({
    schemaVersion: 1,
    packages: [
      { id: 'spacesiege', manifest: 'spacesiege/manifest.json' },
      { id: 'battleforge', manifest: 'battleforge/manifest.json' }
    ]
  }, {
    indexPath: 'games/index.json',
    knownPackages: ['spacesiege', 'battleforge']
  });

  assert.equal(index.fingerprint.length, 8);
  assert.equal(index.packages[0].manifestPath, 'games/spacesiege/manifest.json');
  assert.equal(validation.valid, true);
  assert.deepEqual(JSON.parse(JSON.stringify(manifests.getIndexFacets(index))).categories, ['fantasy', 'sci_fi']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(manifests.searchPackageIndex(index, { query: 'mineral' }))).map(entry => entry.id),
    ['spacesiege']
  );
});

test('content schema service validates mod catalog records without a build step', () => {
  const context = loadOpenRTSScript('../../game/config/ContentSchemaService.js');
  const schemas = context.OpenRTS.config.contentSchemas;
  const validUnitDiagnostics = schemas.validateRecord('units', 'hover_tank', {
    name: 'Hover Tank',
    hp: 180,
    speed: 88,
    size: 28,
    weapon: 'plasma_cannon',
    movementType: 'air',
    cost: { minerals: 125, vapor: 50 },
    tags: ['armored']
  });
  const invalidUnitDiagnostics = schemas.validateRecord('units', 'Bad Unit', {
    name: 'Bad Unit',
    hp: -10,
    speed: 'fast',
    size: 20,
    movementType: 'teleport'
  });

  assert.equal(schemas.describeSchema('units').required.includes('hp'), true);
  assert.equal(schemas.listSchemas().some(schema => schema.id === 'weapons'), true);
  assert.equal(validUnitDiagnostics.length, 0);
  assert.equal(invalidUnitDiagnostics.some(diagnostic => diagnostic.field === 'id'), true);
  assert.equal(invalidUnitDiagnostics.some(diagnostic => diagnostic.field === 'hp'), true);
  assert.equal(invalidUnitDiagnostics.some(diagnostic => diagnostic.field === 'speed'), true);
  assert.equal(invalidUnitDiagnostics.some(diagnostic => diagnostic.field === 'movementType'), true);
});

test('package report service summarizes package capabilities and diagnostics', () => {
  const context = loadOpenRTSScript('../../game/config/PackageReportService.js');
  const reports = context.OpenRTS.config.packageReports;
  const report = reports.createPackageReport({
    id: 'space_frontier',
    name: 'Space Frontier',
    version: '1.0.0',
    engineVersion: '0.2.0',
    mergeMode: 'merge',
    manifestPath: 'games/space_frontier/manifest.json',
    fingerprint: 'abc12345',
    files: {
      rulesets: 'rulesets.json',
      factions: 'factions.json',
      units: 'units.json',
      buildings: 'buildings.json',
      weapons: 'weapons.json',
      terrainPresets: 'terrain-presets.json',
      modes: 'game-modes.json'
    },
    content: {
      rulesets: {
        space_rules: {
          resources: { minerals: {}, vapor: {} },
          damageTypes: { plasma: {} },
          armorTags: { light: {}, air: {} },
          effectTypes: { cloak: {} }
        }
      },
      factions: {
        frontier: { units: ['probe', 'fighter'], buildings: ['nexus'] }
      },
      units: {
        probe: { role: 'Worker', weapon: 'laser', tags: ['worker'], movementType: 'ground', armorType: 'light' },
        fighter: { role: 'Air superiority', weapon: 'laser', tags: ['air'], movementType: 'air', armorType: 'air' }
      },
      buildings: {
        nexus: { produces: ['probe'], tags: ['resource-dropoff'] }
      },
      weapons: { laser: {} },
      terrainPresets: { asteroid: {} },
      modes: { duel: { allowedUnits: ['probe', 'fighter'] } }
    },
    errors: []
  });

  assert.equal(report.summary.units, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(report.capabilities.resources)), ['minerals', 'vapor']);
  assert.equal(report.capabilities.units.hasAirUnits, true);
  assert.equal(report.capabilities.units.hasWorkers, true);
  assert.equal(report.capabilities.buildings.hasProduction, true);
  assert.equal(report.diagnosticSummary.errors, 0);
});

test('package report service includes content schema diagnostics when schemas are loaded', () => {
  const context = loadOpenRTSScript('../../game/config/ContentSchemaService.js');
  loadOpenRTSScript('../../game/config/PackageReportService.js', context);
  const report = context.OpenRTS.config.packageReports.createPackageReport({
    id: 'broken_mod',
    name: 'Broken Mod',
    version: '1.0.0',
    files: {
      rulesets: 'rulesets.json',
      factions: 'factions.json',
      units: 'units.json',
      buildings: 'buildings.json',
      weapons: 'weapons.json',
      terrainPresets: 'terrain-presets.json',
      modes: 'game-modes.json'
    },
    content: {
      rulesets: { rules: { name: 'Rules' } },
      factions: { faction: { name: 'Faction', ruleset: 'rules' } },
      units: { 'Bad Unit': { name: 'Bad Unit', hp: -1, speed: 'fast', size: 20 } },
      buildings: {},
      weapons: {},
      terrainPresets: {},
      modes: {}
    },
    errors: []
  });

  assert.equal(report.diagnosticSummary.errors >= 2, true);
  assert.match(report.diagnostics.map(diagnostic => diagnostic.message).join('\n'), /units "Bad Unit"/);
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

test('game packages override platform modes without creating new game type buttons', async () => {
  const files = {
    'games/spacesiege/manifest.json': {
      schemaVersion: 1,
      id: 'spacesiege',
      name: 'StarSiege',
      version: '0.1.0',
      files: {
        modes: 'game-modes.json'
      }
    },
    'games/spacesiege/game-modes.json': {
      spacesiege_versus: {
        shortName: 'StarSiege',
        name: 'StarSiege Versus',
        allowedUnits: ['ss_probe', 'ss_marine'],
        defaults: {
          mapStyle: 'crystal_frontier',
          startingGold: 50,
          unitRoster: { ss_probe: 4 }
        }
      },
      spacesiege_campaign: {
        name: 'Should Not Become A Top-Level Button'
      }
    }
  };
  const context = loadOpenRTSScript('../../game/config/ContentPackLoader.js', {
    URLSearchParams,
    fetch: async path => ({
      ok: !!files[path],
      status: files[path] ? 200 : 404,
      json: async () => files[path]
    })
  });

  const gamePackage = await context.OpenRTS.config.gamePackages.loadGamePackage('spacesiege');
  const merged = context.OpenRTS.config.gamePackages.applyGamePackage({
    modes: {
      versus: {
        id: 'versus',
        shortName: 'Versus',
        name: 'Versus',
        summary: 'Player-versus-player battle with configurable teams and room settings.',
        allowedUnits: ['worker'],
        defaults: {
          mapStyle: 'coastal_grassland',
          startingGold: 140,
          unitRoster: { worker: 5 }
        }
      },
      tower_defense: { id: 'tower_defense', shortName: 'TD', defaults: { waveCount: 5 } },
      unit_comparison: { id: 'unit_comparison', shortName: 'Compare', defaults: {} },
      map_builder: { id: 'map_builder', shortName: 'Builder', defaults: {} }
    }
  }, gamePackage);

  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(merged.modes))), ['versus', 'tower_defense', 'unit_comparison', 'map_builder']);
  assert.equal(merged.modes.versus.id, 'versus');
  assert.equal(merged.modes.versus.shortName, 'Versus');
  assert.equal(merged.modes.versus.name, 'Versus');
  assert.match(merged.modes.versus.summary, /configurable teams and room settings/);
  assert.equal(merged.modes.versus.defaults.mapStyle, 'crystal_frontier');
  assert.equal(merged.modes.versus.defaults.startingGold, 50);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.versus.defaults.unitRoster)), { ss_probe: 4 });
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.unit_comparison.allowedUnits)), ['ss_probe', 'ss_marine']);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.unit_comparison.defaults.enabledUnits)), ['ss_probe', 'ss_marine']);
  assert.equal(merged.modes.unit_comparison.defaults.mapStyle, 'crystal_frontier');
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.unit_comparison.defaults.leftUnitRoster)), { ss_probe: 4, ss_marine: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.unit_comparison.defaults.rightUnitRoster)), { ss_probe: 4, ss_marine: 0 });
  assert.equal(merged.modes.tower_defense.shortName, 'TD');
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.tower_defense.allowedUnits)), ['ss_probe', 'ss_marine']);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.tower_defense.defaults.enabledUnits)), ['ss_probe', 'ss_marine']);
  assert.equal(merged.modes.tower_defense.defaults.mapStyle, 'crystal_frontier');
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.tower_defense.defaults.unitRoster)), { ss_probe: 4, ss_marine: 0 });
  assert.equal(merged.modes.map_builder.shortName, 'Builder');
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.map_builder.allowedUnits)), ['ss_probe', 'ss_marine']);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.modes.map_builder.defaults.enabledUnits)), ['ss_probe', 'ss_marine']);
  assert.equal(merged.modes.map_builder.defaults.mapStyle, 'crystal_frontier');
  assert.deepEqual(JSON.parse(JSON.stringify(merged.activeGamePackage.modeOverrides)), [{ source: 'spacesiege_versus', target: 'versus' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.activeGamePackage.modeDerivatives)), [
    {
      source: 'versus',
      target: 'unit_comparison',
      fields: ['allowedUnits', 'enabledUnits', 'leftUnitRoster', 'rightUnitRoster', 'map defaults']
    },
    {
      source: 'versus',
      target: 'tower_defense',
      fields: ['allowedUnits', 'enabledUnits', 'unitRoster', 'map defaults']
    },
    {
      source: 'versus',
      target: 'map_builder',
      fields: ['allowedUnits', 'enabledUnits', 'map defaults']
    }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.activeGamePackage.ignoredModeIds)), ['spacesiege_campaign']);
});

test('game package loader attaches package reports when report service is loaded', async () => {
  const files = {
    'games/spacesiege/manifest.json': {
      schemaVersion: 1,
      id: 'spacesiege',
      name: 'StarSiege',
      version: '0.1.0',
      files: {
        rulesets: 'rulesets.json',
        factions: 'factions.json',
        units: 'units.json',
        buildings: 'buildings.json',
        weapons: 'weapons.json',
        terrainPresets: 'terrain-presets.json',
        modes: 'game-modes.json'
      }
    },
    'games/spacesiege/rulesets.json': {
      sci: { resources: { minerals: {}, vapor: {} } }
    },
    'games/spacesiege/factions.json': {
      frontier: { units: ['probe'], buildings: ['nexus'] }
    },
    'games/spacesiege/units.json': {
      probe: { role: 'Worker', weapon: 'laser', tags: ['worker'] }
    },
    'games/spacesiege/buildings.json': {
      nexus: { produces: ['probe'] }
    },
    'games/spacesiege/weapons.json': {
      laser: {}
    },
    'games/spacesiege/terrain-presets.json': {
      asteroid: {}
    },
    'games/spacesiege/game-modes.json': {
      duel: { allowedUnits: ['probe'] }
    }
  };
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js', {
    URLSearchParams,
    fetch: async path => ({
      ok: !!files[path],
      status: files[path] ? 200 : 404,
      json: async () => files[path]
    })
  });
  loadOpenRTSScript('../../game/config/PackageReportService.js', context);
  loadOpenRTSScript('../../game/config/ContentPackLoader.js', context);

  const gamePackage = await context.OpenRTS.config.gamePackages.loadGamePackage('spacesiege');
  const description = context.OpenRTS.config.gamePackages.describe();

  assert.equal(gamePackage.report.summary.units, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(gamePackage.report.capabilities.resources)), ['minerals', 'vapor']);
  assert.equal(description.activeGamePackage.report.summary.units, 1);
  assert.equal(description.gamePackages[0].report.diagnosticSummary.errors, 0);
});

test('game package loader loads a static package index and loads indexed packages', async () => {
  const files = {
    'games/index.json': {
      schemaVersion: 1,
      name: 'Sample Packages',
      packages: [
        {
          id: 'spacesiege',
          manifest: 'spacesiege/manifest.json',
          featured: true,
          category: 'sci_fi',
          style: 'mineral gas supply',
          tags: ['sci-fi']
        }
      ]
    },
    'games/spacesiege/manifest.json': {
      schemaVersion: 1,
      id: 'spacesiege',
      name: 'StarSiege',
      version: '0.1.0',
      files: { units: 'units.json' }
    },
    'games/spacesiege/units.json': {
      ss_probe: { name: 'Field Probe', hp: 70, speed: 118, size: 18, weapon: 'rifle' }
    }
  };
  const context = loadOpenRTSScript('../../game/config/PackageManifestService.js', {
    URLSearchParams,
    fetch: async path => ({
      ok: !!files[path],
      status: files[path] ? 200 : 404,
      json: async () => files[path]
    })
  });
  loadOpenRTSScript('../../game/config/ContentPackLoader.js', context);

  await context.OpenRTS.config.gamePackages.loadGamePackageIndex();
  const available = context.OpenRTS.config.gamePackages.listAvailableGamePackages({ query: 'mineral' });
  const gamePackage = await context.OpenRTS.config.gamePackages.loadIndexedGamePackage('spacesiege');
  const description = context.OpenRTS.config.gamePackages.describe();

  assert.equal(available[0].id, 'spacesiege');
  assert.equal(gamePackage.manifestPath, 'games/spacesiege/manifest.json');
  assert.equal(description.availableGamePackageCount, 1);
  assert.equal(description.packageIndex.packageCount, 1);
  assert.equal(description.packageIndex.facets.categories[0], 'sci_fi');
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
