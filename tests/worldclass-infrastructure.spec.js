import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('spatial hash grid supports reusable radius and box queries', () => {
  const context = loadOpenRTSScript('../../world/spatial/SpatialHashGrid.js');
  const grid = context.OpenRTS.world.spatial.createSpatialHashGrid({ cellSize: 50 });

  grid.insert({ id: 'worker', x: 10, y: 10, radius: 12, team: 'red' });
  grid.insert({ id: 'enemy', x: 80, y: 10, radius: 12, team: 'blue' });
  grid.insert({ id: 'tree', x: 500, y: 500, radius: 40, type: 'tree' });

  assert.deepEqual(JSON.parse(JSON.stringify(grid.queryRadius(0, 0, 40).map(record => record.id))), ['worker']);
  assert.deepEqual(JSON.parse(JSON.stringify(grid.queryAabb({ minX: 0, minY: 0, maxX: 100, maxY: 30 }).map(record => record.id).sort())), ['enemy', 'worker']);
  assert.equal(grid.remove('enemy'), true);
  assert.equal(grid.describe().recordCount, 2);
});

test('navigation planner wraps nearest reachable destinations and smoothed paths', () => {
  const context = loadOpenRTSScript('../../world/navigation/NavigationPlanner.js');
  const calls = [];
  const planner = context.OpenRTS.world.navigationPlanner.createNavigationPlanner({
    tileSize: 32,
    navigation: {
      findNearestWalkablePoint: (x, y, size, radius) => ({ x: x + 1, y: y + 2, size, radius, adjusted: true }),
      hasLineOfSight: () => false,
      smoothPath: path => {
        calls.push(path);
        return path;
      }
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(planner.worldToTile({ x: 70, y: 95 }))), { x: 2, y: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(planner.nearestReachableDestination({ x: 5, y: 6 }, 18, { maxRadius: 7 }))), {
    x: 6,
    y: 8,
    size: 18,
    radius: 7,
    adjusted: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(planner.planStraightPath({ x: 0, y: 0 }, { x: 64, y: 64 }))), [{ x: 16, y: 16 }, { x: 80, y: 80 }]);
  assert.equal(calls.length, 1);
});

test('formation planner creates stable slots and nearest assignments', () => {
  const context = loadOpenRTSScript('../../game/systems/FormationPlanner.js');
  const units = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }, { id: 'c', x: 0, y: 100 }, { id: 'd', x: 100, y: 100 }];
  const slots = context.OpenRTS.systems.formationPlanner.createFormationSlots(units, { x: 200, y: 200 }, { spacing: 20, columns: 2 });
  const assignments = context.OpenRTS.systems.formationPlanner.assignNearestSlots(units, slots);

  assert.equal(slots.length, 4);
  assert.deepEqual(slots.map(slot => [slot.row, slot.column]), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  assert.equal(new Set(assignments.map(assignment => assignment.slot)).size, 4);
});

test('asset metadata normalizes model import options for future pipelines', () => {
  const context = loadOpenRTSScript('../../game/config/AssetMetadataService.js', {
    OpenRTS: {
      config: {
        assets: {
          resolveModel: id => ({ id, kind: 'gltf', url: 'model.glb', scale: 2, animations: { idle: 'Idle' } })
        }
      }
    }
  });

  const metadata = context.OpenRTS.config.assetMetadata.resolveModelMetadata('unit.worker');

  assert.equal(metadata.kind, 'gltf');
  assert.equal(metadata.scale, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.rotation)), { x: 0, y: 0, z: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.animations)), { idle: 'Idle' });
});

test('replay verifier compares deterministic simulation checksums', () => {
  const context = loadOpenRTSScript('../../core/openRts.js');
  loadOpenRTSScript('../../core/diagnostics/DiagnosticsRegistry.js', context);
  loadOpenRTSScript('../../core/runtime/SimulationSnapshot.js', context);
  loadOpenRTSScript('../../core/runtime/ReplayVerifier.js', context);

  const snapshot = context.OpenRTS.diagnostics.simulation.capture({ frame: 5, units: [{ id: 'u1', x: 1, y: 2 }] });
  const checksum = context.OpenRTS.diagnostics.simulation.checksum(snapshot);
  const result = context.OpenRTS.runtime.replayVerifier.verifyChecksums({
    initialSnapshot: snapshot,
    finalSnapshot: snapshot,
    expectedChecksum: checksum
  });

  assert.equal(result.matched, true);
  assert.equal(result.finalChecksum, checksum);
});

test('scenario composer merges overrides without losing scenario defaults', () => {
  const context = loadOpenRTSScript('../../game/config/ScenarioComposer.js', {
    OpenRTS: {
      config: {
        scenarios: {
          getScenario: () => ({
            id: 'versus-default',
            modeId: 'versus',
            settings: {
              map: { size: 'large', trees: 30 },
              players: { count: 2 },
              resources: { gold: 200 }
            }
          })
        }
      }
    }
  });

  const composed = context.OpenRTS.config.scenarioComposer.composeScenario('versus-default', {
    settings: { map: { trees: 60 }, resources: { wood: 100 } }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(composed.settings.map)), { size: 'large', trees: 60 });
  assert.deepEqual(JSON.parse(JSON.stringify(composed.settings.resources)), { gold: 200, wood: 100 });
});

test('component schema registry documents component migration targets', () => {
  const context = loadOpenRTSScript('../../ecs/ComponentSchemaRegistry.js');
  const schemas = context.OpenRTS.entities.componentSchemas;

  assert.equal(schemas.get('combat').fields.hp, 'number');
  assert.ok(schemas.list().some(schema => schema.name === 'worker'));
  assert.equal(schemas.describe().count >= 7, true);
});

test('performance diagnostics records counters timings and measured work', () => {
  const context = loadOpenRTSScript('../../core/openRts.js', {
    performance: { now: (() => { let time = 0; return () => { time += 5; return time; }; })() }
  });
  loadOpenRTSScript('../../core/diagnostics/DiagnosticsRegistry.js', context);
  loadOpenRTSScript('../../core/diagnostics/PerformanceDiagnostics.js', context);

  context.OpenRTS.diagnostics.performance.increment('spatialQueries', 2);
  context.OpenRTS.diagnostics.performance.setGauge('render.drawCalls', 18);
  context.OpenRTS.diagnostics.performance.measure('ai', () => 42);
  const report = context.OpenRTS.diagnostics.performance.describe();

  assert.equal(report.counters.spatialQueries, 2);
  assert.equal(report.gauges['render.drawCalls'], 18);
  assert.equal(report.timings.ai.count, 1);
  assert.equal(report.timings.ai.total, 5);
});
