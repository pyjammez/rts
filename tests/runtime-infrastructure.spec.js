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
  const meta = world.registerCollection('terrain', {
    itemType: 'terrain tile rows',
    required: true
  });
  const terrain = world.replace('terrain', [[1, 2]]);
  const revision = world.touch('terrain');
  const appended = world.append('terrain', [3, 4]);
  const snapshot = world.snapshot('terrain');
  const collectionBeforeRemove = world.get('terrain');
  const removed = world.remove('terrain', row => row[0] === 3);
  const description = world.describe();

  assert.equal(meta.name, 'terrain');
  assert.equal(meta.required, true);
  assert.equal(collectionBeforeRemove, terrain);
  assert.notEqual(world.get('terrain'), terrain);
  assert.equal(world.seed, 8765);
  assert.equal(world.generation, 1);
  assert.equal(revision, 2);
  assert.deepEqual(appended, [3, 4]);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), [[1, 2], [3, 4]]);
  assert.deepEqual(JSON.parse(JSON.stringify(removed)), [[3, 4]]);
  assert.equal(world.revision('terrain'), 4);
  assert.equal(world.dimensions().width, 1920);
  assert.equal(description.collectionSizes.terrain, 1);
  assert.equal(description.collections.terrain.itemType, 'terrain tile rows');
  assert.equal(description.collections.terrain.revision, 4);
  assert.throws(() => world.touch('unknown'), /unknown world collection/i);
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

test('diagnostics registry aggregates serializable subsystem reports', () => {
  const context = loadOpenRTSScript('../../core/diagnostics/DiagnosticsRegistry.js');
  const diagnostics = context.OpenRTS.diagnostics;

  diagnostics.register('healthy', () => ({ status: 'ok', count: 2 }));
  diagnostics.register('throws', () => {
    throw new Error('report failed');
  });
  diagnostics.register('circular', () => {
    const value = { status: 'bad' };
    value.self = value;
    return value;
  });

  const report = diagnostics.report();
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.reporterCount, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(report.sections.healthy)), { status: 'ok', count: 2 });
  assert.equal(report.sections.throws.status, 'error');
  assert.match(report.sections.throws.error, /report failed/);
  assert.equal(report.sections.circular.status, 'error');
  assert.deepEqual(JSON.parse(JSON.stringify(diagnostics.listReporters())), ['circular', 'healthy', 'throws']);
  assert.doesNotThrow(() => JSON.stringify(report));
});

test('unit state factory centralizes unit initialization defaults', () => {
  const context = loadOpenRTSScript('../../entities/UnitCommandTypes.js');
  loadOpenRTSScript('../../entities/UnitStateFactory.js', context);

  const state = context.OpenRTS.entities.unitState.createInitialState({
    id: 7,
    x: 10,
    y: 20,
    team: 'red',
    hp: 100,
    speed: 90
  });

  assert.equal(context.OpenRTS.entities.unitCommandTypes.MAX_COMMAND_QUEUE, 16);
  assert.equal(state.maxHp, 100);
  assert.equal(state.fireStance, 'attack_at_will');
  assert.equal(state.movementType, 'ground');
  assert.equal(Array.isArray(state.commandQueue), true);
  assert.equal(state.canTargetGround, true);
});

test('unit command state service centralizes reset and command queue policy', () => {
  const context = loadOpenRTSScript('../../entities/UnitCommandStateService.js');
  const service = context.OpenRTS.entities.unitCommandState;
  const unit = {
    commandQueue: [{ type: 'old' }],
    target: { x: 10, y: 20 },
    attackOrderTarget: { id: 'enemy' },
    currentEnemy: { id: 'enemy' },
    autoEngageTarget: { id: 'enemy' },
    castleTopBuildingId: 'castle',
    castleTopStairPoint: { x: 1, y: 1 },
    castleTopReached: true,
    castleRampBase: { x: 0, y: 0 },
    castleRampTop: { x: 1, y: 1 },
    castleRampClimbed: true,
    clearMovementState() { this.target = null; this.movementCleared = true; },
    clearPendingItemAction() { this.itemActionCleared = true; },
    clearMountTarget() { this.mountCleared = true; },
    hasActivePath() { return false; },
    executeCommand(command) { this.executedCommand = command; return true; }
  };

  service.resetForImmediateCommand(unit);

  assert.deepEqual(JSON.parse(JSON.stringify(unit.commandQueue)), []);
  assert.equal(unit.movementCleared, true);
  assert.equal(unit.itemActionCleared, true);
  assert.equal(unit.mountCleared, true);
  assert.equal(unit.attackOrderTarget, null);
  assert.equal(unit.currentEnemy, null);
  assert.equal(unit.autoEngageTarget, null);
  assert.equal(unit.castleTopBuildingId, null);
  assert.equal(unit.castleRampClimbed, false);

  const queueUnit = {
    commandQueue: [],
    target: { x: 1, y: 1 },
    hasActivePath() { return false; },
    executeCommand(command) { this.executedCommand = command; return true; }
  };
  const command = { type: 'move', x: 3, y: 4 };

  assert.equal(service.executeOrQueue(queueUnit, command, { append: true, maxQueue: 1 }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(queueUnit.commandQueue)), [command]);
  assert.equal(queueUnit.executedCommand, undefined);
  assert.equal(service.executeOrQueue(queueUnit, { type: 'attack' }, { append: true, maxQueue: 1 }), false);
});

test('map sprite catalog owns tile sprite asset construction', () => {
  const context = loadOpenRTSScript('../../world/map/MapSpriteCatalog.js');
  class ImageStub {
    constructor() { this.src = ''; }
  }

  const sprites = context.OpenRTS.world.mapSprites.createTileSprites({ ImageCtor: ImageStub });

  assert.equal(sprites.grass.src, 'assets/grass.png');
  assert.equal(sprites.transitions['stone-sand'].src, 'assets/stone-sand.png');
  assert.equal(sprites.unit.src, 'assets/unit_sprites.svg');
});

test('camera controller owns edge scroll zoom and world projection policy', () => {
  const context = loadOpenRTSScript('../../core/camera/CameraController.js', {
    document: {
      querySelector: () => ({
        getBoundingClientRect: () => ({ width: 600, height: 120, top: 420 })
      })
    },
    getComputedStyle: () => ({ display: 'block' })
  });
  const camera = {
    x: 10,
    y: 20,
    speed: 100,
    edgeScrollMargin: 24,
    zoom: 1,
    minZoom3D: 0.22,
    maxZoom: 4,
    viewportWidth: 640,
    viewportHeight: 480
  };
  const inputState = {
    mouseInside: true,
    mouseX: 638,
    mouseY: 410,
    southEdgeActive: false,
    right: false,
    left: false,
    up: false,
    down: false
  };
  const controller = context.OpenRTS.camera.controller.createCameraController({
    camera,
    inputState,
    canvas: { width: 640, height: 480 },
    tileSize: 32,
    getMapWidthPx: () => 2000,
    getMapHeightPx: () => 1000,
    use3DRenderer: () => false
  });

  assert.deepEqual(JSON.parse(JSON.stringify(controller.getEdgeScrollDirection())), { x: 1, y: 1 });
  assert.equal(controller.getMinZoomToFitMap(), 0.32);

  const before = controller.screenToWorld(320, 240);
  controller.zoomAtScreenPoint(320, 240, 2);
  const after = controller.screenToWorld(320, 240);

  assert.equal(camera.zoom, 2);
  assert.equal(Math.round(after.x), Math.round(before.x));
  assert.equal(Math.round(after.y), Math.round(before.y));

  inputState.mouseInside = false;
  inputState.right = true;
  controller.update(0.5);
  assert.ok(camera.x > -200, 'camera remains clamped after keyboard movement');

  controller.zoomToFullMap();
  assert.equal(camera.zoom, 0.32);
});

test('camera controller uses 3D picking when a scene point is available', () => {
  const context = loadOpenRTSScript('../../core/camera/CameraController.js');
  const camera = {
    x: 0,
    y: 0,
    speed: 100,
    edgeScrollMargin: 24,
    zoom: 1,
    minZoom3D: 0.22,
    maxZoom: 4,
    viewportWidth: 640,
    viewportHeight: 480
  };
  let refreshCount = 0;
  const controller = context.OpenRTS.camera.controller.createCameraController({
    camera,
    inputState: {},
    canvas: { width: 640, height: 480 },
    getMapWidthPx: () => 3000,
    getMapHeightPx: () => 3000,
    use3DRenderer: () => true,
    refresh3DCameraMatrices: () => { refreshCount += 1; },
    get3DWorldPoint: () => ({ x: 500, y: 700 })
  });

  assert.deepEqual(JSON.parse(JSON.stringify(controller.screenToWorld(10, 20))), { x: 500, y: 700 });
  controller.zoomAtScreenPoint(10, 20, 1.2);
  assert.ok(refreshCount >= 3);
});
