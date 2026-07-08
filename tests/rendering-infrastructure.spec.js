import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('canvas render list service culls and sorts world drawables by depth', () => {
  const context = loadOpenRTSScript('../../world/rendering/canvas/CanvasRenderListService.js');
  const drawList = context.OpenRTS.rendering.canvas.renderLists.createWorldObjectDrawList({
    camera: { x: 0, y: 0, zoom: 1, viewportWidth: 320, viewportHeight: 240 },
    canvasWidth: 320,
    canvasHeight: 240,
    tileSize: 32,
    rows: 5,
    columns: 5,
    obstacleNone: 0,
    obstacleTree: 1,
    obstacleData: [
      [0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    sheep: [{ id: 'sheep', x: 40, y: 20 }],
    ducks: [{ id: 'duck-offscreen', x: 1000, y: 1000 }],
    buildings: [{ id: 'castle', type: 'home', x: 96, y: 96, width: 3, height: 3 }],
    units: [{ id: 'unit', x: 80, y: 80, size: 16 }, { id: 'hidden', hiddenInHouse: true, x: 60, y: 60, size: 16 }]
  });

  assert.ok(drawList.some(item => item.type === 'obstacle'));
  assert.ok(drawList.some(item => item.type === 'sheep'));
  assert.ok(drawList.some(item => item.type === 'building' && item.layer === 'base'));
  assert.ok(drawList.some(item => item.type === 'building' && item.layer === 'front'));
  assert.ok(drawList.some(item => item.type === 'unit' && item.unit.id === 'unit'));
  assert.equal(drawList.some(item => item.type === 'duck'), false);
  assert.equal(drawList.some(item => item.type === 'unit' && item.unit.id === 'hidden'), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify([...drawList].sort((a, b) => a.sortY - b.sortY).map(item => item.sortY))),
    JSON.parse(JSON.stringify(drawList.map(item => item.sortY)))
  );
});

test('geometry cache creates each geometry once and exposes diagnostics helpers', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/GeometryCache.js');
  const cache = context.OpenRTS.rendering.geometryCaches.createGeometryCache();
  let created = 0;

  const first = cache.get('box', () => ({ id: ++created }));
  const second = cache.get('box', () => ({ id: ++created }));

  assert.equal(first, second);
  assert.equal(created, 1);
  assert.equal(cache.has('box'), true);
  assert.equal(cache.size(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(cache.keys())), ['box']);
});

test('canvas minimap renderer draws terrain entities buildings and viewport', () => {
  const context = loadOpenRTSScript('../../world/rendering/canvas/CanvasMinimapRenderer.js');
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => calls.push([prop, ...args]);
    },
    set(target, prop, value) {
      calls.push(['set', prop, value]);
      target[prop] = value;
      return true;
    }
  });

  const rendered = context.OpenRTS.rendering.canvas.minimap.render(ctx, {
    canvas: { width: 100, height: 50 },
    terrainData: [[1, 2], [3, 4]],
    obstacleData: [[0, 1], [0, 0]],
    rows: 2,
    columns: 2,
    tileSize: 32,
    dimensions: { width: 64, height: 64 },
    terrain: { WATER: 1, SAND: 2, GRASS: 3 },
    obstacle: { NONE: 0, TREE: 1 },
    units: [{ x: 16, y: 16, team: 'red' }],
    sheep: [{ x: 24, y: 24 }],
    horses: [{ x: 28, y: 28 }],
    items: [{ x: 30, y: 30 }],
    goldMines: [{ x: 40, y: 40 }],
    houses: [{ x: 48, y: 40 }],
    buildings: [{ x: 50, y: 42, width: 2, height: 2, team: 'blue' }],
    camera: { x: 0, y: 0, zoom: 1, viewportWidth: 32, viewportHeight: 32 },
    teamColor: team => team === 'red' ? '#r' : '#b'
  });

  assert.equal(rendered, true);
  assert.ok(calls.some(call => call[0] === 'clearRect'));
  assert.ok(calls.filter(call => call[0] === 'fillRect').length >= 10);
  assert.ok(calls.some(call => call[0] === 'strokeRect'));
  assert.equal(context.OpenRTS.rendering.canvas.minimap.terrainColor(1, { WATER: 1 }), '#2f78b7');
});

test('canvas terrain painter owns tile accents transitions and water ripples', () => {
  const context = loadOpenRTSScript('../../world/rendering/canvas/CanvasTerrainPainter.js');
  const painter = context.OpenRTS.rendering.canvas.terrainPainter;
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => calls.push([prop, ...args]);
    },
    set(target, prop, value) {
      calls.push(['set', prop, value]);
      target[prop] = value;
      return true;
    }
  });
  const terrain = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3 };
  const tileSprites = {
    grass: { complete: false, naturalWidth: 0 },
    sand: { complete: false, naturalWidth: 0 },
    dirt: { complete: false, naturalWidth: 0 }
  };

  painter.drawTerrainTile(ctx, terrain.GRASS, 0, 0, {
    terrain,
    tileSize: 32,
    tileSprites
  });
  painter.drawTerrainAccents(ctx, terrain.WATER, 0, 0, 0, 0, {
    terrain,
    tileSize: 32,
    noise: () => 0.9
  });
  const callsBeforeWaterTransition = calls.length;
  painter.drawTransitions(ctx, 0, 0, terrain.WATER, 0, 0, {
    terrain,
    terrainData: [[terrain.WATER, terrain.SAND]],
    tileSize: 32,
    isInsideMap: (x, y) => x >= 0 && y >= 0 && x < 2 && y < 1,
    noise: () => 0.85
  });
  const waterTransitionCalls = calls.slice(callsBeforeWaterTransition);
  painter.drawTransitions(ctx, 1, 0, terrain.SAND, 32, 0, {
    terrain,
    terrainData: [[terrain.WATER, terrain.SAND]],
    tileSize: 32,
    isInsideMap: (x, y) => x >= 0 && y >= 0 && x < 2 && y < 1,
    noise: () => 0.9,
    volcanic: true
  });
  painter.renderWaterRipples(ctx, {
    camX: 0,
    camY: 0,
    viewWidth: 32,
    viewHeight: 32,
    terrainData: [[terrain.WATER]],
    rows: 1,
    columns: 1,
    terrain,
    tileSize: 32,
    timeSeconds: 1,
    noise: () => 0.95
  });

  assert.ok(calls.some(call => call[0] === 'fillRect'));
  assert.ok(calls.some(call => call[0] === 'quadraticCurveTo'));
  assert.ok(calls.some(call => call[0] === 'translate'));
  assert.ok(calls.filter(call => call[0] === 'lineTo').length >= 4);
  assert.ok(calls.some(call => call[0] === 'ellipse'));
  assert.ok(calls.some(call => call[0] === 'stroke'));
  assert.ok(waterTransitionCalls.some(call => call[0] === 'stroke'));
  assert.equal(waterTransitionCalls.some(call => call[0] === 'fill'), false);
});

test('three scene bootstrap creates renderer scene groups and ray helpers', () => {
  const added = [];
  class FakeRenderer {
    constructor(options) {
      this.options = options;
      this.shadowMap = {};
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    setSize(width, height) { this.size = { width, height }; }
  }
  class FakeScene {
    constructor() { this.children = []; }
    add(...items) { this.children.push(...items); added.push(...items); }
  }
  class FakeCamera {
    constructor() { this.up = { set: (...args) => { this.upValue = args; } }; }
  }
  class FakeLight {
    constructor() {
      this.position = { set: (...args) => { this.positionValue = args; } };
      this.shadow = { mapSize: { set: (...args) => { this.shadowSize = args; } }, camera: {} };
      this.target = { kind: 'target' };
    }
  }
  class FakeGroup {
    constructor() { this.children = []; this.name = ''; }
  }
  class FakeRaycaster {}
  class FakePlane {
    constructor(vector, constant) { this.vector = vector; this.constant = constant; }
  }
  class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeSceneBootstrap.js');
  const runtime = context.OpenRTS.rendering.threeSceneBootstrap.createSceneRuntime({
    canvas: { width: 640, height: 360, clientWidth: 640, clientHeight: 360 },
    devicePixelRatio: 3,
    THREE: {
      WebGLRenderer: FakeRenderer,
      Scene: FakeScene,
      Color: class { constructor(value) { this.value = value; } },
      FogExp2: class { constructor(color, density) { this.color = color; this.density = density; } },
      PerspectiveCamera: FakeCamera,
      HemisphereLight: FakeLight,
      DirectionalLight: FakeLight,
      Group: FakeGroup,
      Raycaster: FakeRaycaster,
      Plane: FakePlane,
      Vector3: FakeVector3,
      SRGBColorSpace: 'srgb',
      ACESFilmicToneMapping: 'aces',
      BasicShadowMap: 'basic',
      PCFShadowMap: 'pcf'
    }
  });

  assert.equal(runtime.renderer.options.antialias, true);
  assert.equal(runtime.renderer.pixelRatio, 1);
  assert.equal(runtime.renderer.shadowMap.type, 'basic');
  assert.deepEqual(runtime.renderer.size, { width: 640, height: 360 });
  assert.equal(runtime.staticGroup.name, 'static-world');
  assert.equal(runtime.dynamicGroup.name, 'dynamic-entities');
  assert.ok(runtime.raycaster instanceof FakeRaycaster);
  assert.ok(runtime.groundPlane instanceof FakePlane);
  assert.ok(added.includes(runtime.staticGroup));
  assert.ok(added.includes(runtime.dynamicGroup));
});

test('three coordinate service converts world scene and screen positions', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeCoordinateService.js');
  const coordinates = context.OpenRTS.rendering.threeCoordinates;
  const scene = coordinates.worldToScene(75, 25, { scale: 0.1, mapWidth: 100, mapHeight: 100 });
  const world = coordinates.sceneToWorld({ x: scene.x, z: scene.z }, { scale: 0.1, mapWidth: 100, mapHeight: 100 });

  assert.deepEqual(JSON.parse(JSON.stringify(scene)), { x: 2.5, z: -2.5 });
  assert.deepEqual(JSON.parse(JSON.stringify(world)), { x: 75, y: 25 });

  class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
  }
  class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    project() { this.x = 0.25; this.y = -0.5; this.z = 0; return this; }
  }
  const screen = coordinates.projectWorldToScreen(50, 50, 1, {
    THREE: { Vector3 },
    camera: {},
    canvas: { width: 200, height: 100 },
    scale: 1,
    mapWidth: 100,
    mapHeight: 100
  });
  const raycaster = {
    pointer: null,
    setFromCamera(pointer) { this.pointer = pointer; },
    ray: { intersectPlane(_plane, target) { target.x = 10; target.z = -10; return true; } }
  };
  const picked = coordinates.screenToWorld(100, 50, {
    THREE: { Vector2, Vector3 },
    raycaster,
    camera: {},
    canvas: { width: 200, height: 100 },
    groundPlane: {},
    scale: 0.1,
    mapWidth: 100,
    mapHeight: 100
  });

  assert.deepEqual(JSON.parse(JSON.stringify(screen)), { x: 125, y: 75 });
  assert.deepEqual(JSON.parse(JSON.stringify(picked)), { x: 150, y: -50 });
  assert.equal(raycaster.pointer.x, 0);
  assert.equal(raycaster.pointer.y, 0);
});

test('three terrain mesh factory owns terrain sampling color and geometry output', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeTerrainMeshFactory.js');
  class Color {
    constructor(r, g, b) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
    clone() {
      return new Color(this.r, this.g, this.b);
    }
    lerp(other, alpha) {
      this.r += (other.r - this.r) * alpha;
      this.g += (other.g - this.g) * alpha;
      this.b += (other.b - this.b) * alpha;
      return this;
    }
  }
  class BufferGeometry {
    constructor() {
      this.attributes = {};
      this.normalsComputed = false;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    computeVertexNormals() {
      this.normalsComputed = true;
    }
  }
  class Float32BufferAttribute {
    constructor(values, itemSize) {
      this.values = values;
      this.itemSize = itemSize;
    }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.userData = {};
    }
  }
  const factory = context.OpenRTS.rendering.threeTerrainMeshes.createFactory({
    THREE: { Color, BufferGeometry, Float32BufferAttribute, Mesh },
    materials: {
      ground: 'ground-material',
      terrainGrassClump: 'grass-clump-material',
      terrainDryPatch: 'dry-patch-material',
      terrainPebbles: 'pebble-material',
      terrainShrubPatch: 'shrub-material'
    },
    tileSize: 32,
    getRows: () => 2,
    getColumns: () => 3,
    getMapConfig: () => ({ terrain: { water: 0.2, sand: 0.3 } }),
    hashNoise: () => 0.5,
    smoothValueNoise: () => 0.5,
    fbmNoise: (x, y) => (x + y) / 8,
    getWorldElevation: () => 0.1
  });

  const meshes = factory.createTerrainMeshes({ subdivisions: 1 });
  const sample = factory.sampleTerrain(1, 1);
  const groundMesh = meshes.find(mesh => mesh.material === 'ground-material');

  assert.ok(groundMesh);
  assert.equal(groundMesh.receiveShadow, true);
  assert.equal(groundMesh.geometry.attributes.position.values.length, 3 * 2 * 6 * 3);
  assert.equal(groundMesh.geometry.attributes.color.values.length, 3 * 2 * 6 * 3);
  assert.equal(groundMesh.geometry.normalsComputed, true);
  assert.equal(Number.isFinite(sample.waterBlend), true);
  assert.equal(Number.isFinite(factory.terrainHeight(1, 1, sample)), true);
  assert.ok(factory.terrainColor(1, 1, sample) instanceof Color);
  assert.equal(Number.isFinite(factory.grassDetail(1, 1).lush), true);
  assert.equal(Array.isArray(factory.createTerrainDetailMeshesForRange({ startX: 0, startY: 0, endX: 3, endY: 2 })), true);

  const alienFactory = context.OpenRTS.rendering.threeTerrainMeshes.createFactory({
    THREE: { Color, BufferGeometry, Float32BufferAttribute, Mesh },
    materials: { ground: 'ground-material' },
    tileSize: 32,
    getRows: () => 2,
    getColumns: () => 3,
    getMapConfig: () => ({ visualStyle: 'alien_crystal', terrain: { water: 0.2, sand: 0.3 } }),
    hashNoise: () => 0.5,
    smoothValueNoise: () => 0.5,
    fbmNoise: (x, y) => (x + y) / 8,
    getWorldElevation: () => 0
  });
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(alienFactory.terrainColor(1, 1, alienFactory.sampleTerrain(1, 1)))),
    JSON.parse(JSON.stringify(factory.terrainColor(1, 1, sample)))
  );

  const chunked = factory.createTerrainMeshes({ subdivisions: 1, chunkTiles: 2 });
  const chunkGroundMeshes = chunked.filter(mesh => mesh.material === 'ground-material');
  assert.equal(chunkGroundMeshes.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(chunkGroundMeshes.map(mesh => mesh.userData.staticChunkId))), ['0:0', '1:0']);
  assert.equal(chunkGroundMeshes[0].userData.terrainChunk, true);
});

test('three material factory gives terrain a generated grass detail texture', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/MaterialFactory.js');
  const calls = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    stroke: () => calls.push(['stroke']),
    arc: (...args) => calls.push(['arc', ...args]),
    ellipse: (...args) => calls.push(['ellipse', ...args]),
    fill: () => calls.push(['fill']),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
  const documentRef = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ctx
    })
  };
  class CanvasTexture {
    constructor(canvas) {
      this.canvas = canvas;
      this.wrapS = null;
      this.wrapT = null;
      this.repeat = { set: (x, y) => { this.repeatValue = { x, y }; } };
    }
  }
  class Material {
    constructor(options = {}) {
      Object.assign(this, options);
      this.color = { setHex: value => { this.hex = value; } };
    }
    clone() {
      return new Material({ ...this });
    }
  }
  const THREE = {
    CanvasTexture,
    MeshStandardMaterial: Material,
    MeshPhysicalMaterial: Material,
    MeshBasicMaterial: Material,
    TextureLoader: class { load() { return { colorSpace: null, anisotropy: 0 }; } },
    RepeatWrapping: 'repeat',
    SRGBColorSpace: 'srgb',
    DoubleSide: 'double'
  };

  const materials = context.OpenRTS.rendering.threeMaterials.create({
    THREE,
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
    documentRef,
    noise: (x, y) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1
  });

  assert.ok(materials.groundDetail instanceof CanvasTexture);
  assert.equal(materials.ground.map, materials.groundDetail);
  assert.equal(materials.ground.bumpMap, materials.groundDetail);
  assert.ok(materials.foliage.map instanceof CanvasTexture);
  assert.ok(materials.foliageDark.map instanceof CanvasTexture);
  assert.ok(materials.foliageWarm.map instanceof CanvasTexture);
  assert.ok(materials.terrainGrassClump.map instanceof CanvasTexture);
  assert.ok(materials.terrainDryPatch.map instanceof CanvasTexture);
  assert.ok(materials.terrainPebbles.map instanceof CanvasTexture);
  assert.ok(materials.terrainShrubPatch.map instanceof CanvasTexture);
  assert.equal(materials.terrainGrassClump.userData.terrainDecal, true);
  assert.equal(materials.foliage.alphaTest, 0.18);
  assert.deepEqual(materials.groundDetail.repeatValue, { x: 18, y: 18 });
  assert.ok(calls.some(([name]) => name === 'lineTo'));
});

test('three material grass detail clamps noisy inputs before creating gradients', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/MaterialFactory.js');
  const gradients = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    createRadialGradient: (_x0, _y0, _r0, _x1, _y1, r1) => {
      if (r1 < 0) throw new Error('negative radius');
      gradients.push(r1);
      return { addColorStop: () => {} };
    }
  };
  class CanvasTexture {
    constructor() {
      this.repeat = { set: () => {} };
    }
  }

  context.OpenRTS.rendering.threeMaterials.createGrassDetailTexture({
    THREE: { CanvasTexture, RepeatWrapping: 'repeat', SRGBColorSpace: 'srgb' },
    documentRef: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ctx
      })
    },
    renderer: { capabilities: { getMaxAnisotropy: () => 1 } },
    noise: () => -0.75
  });

  assert.equal(gradients.every(radius => radius >= 4), true);
});

test('static instance batcher creates instanced meshes with stable matrices', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/StaticInstanceBatcher.js');
  class InstancedMesh {
    constructor(geometry, material, count) {
      this.geometry = geometry;
      this.material = material;
      this.count = count;
      this.matrices = [];
      this.instanceMatrix = {};
      this.userData = {};
    }
    setMatrixAt(index, matrix) {
      this.matrices[index] = matrix;
    }
  }
  class Object3D {
    constructor() {
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.rotation = { set: (x, y, z) => { this.rotationValue = { x, y, z }; } };
      this.scale = { set: (x, y, z) => { this.scaleValue = { x, y, z }; } };
      this.matrix = {};
    }
    updateMatrix() {
      this.matrix = {
        position: this.positionValue,
        rotation: this.rotationValue,
        scale: this.scaleValue
      };
    }
  }

  const batch = context.OpenRTS.rendering.staticInstanceBatcher.createInstancedMeshBatch({
    THREE: { InstancedMesh, Object3D },
    geometry: 'geo',
    material: 'mat',
    instances: [
      { x: 1, y: 2, z: 3, rotationY: 0.5, scaleX: 2, scaleY: 3, scaleZ: 4 },
      { x: 4, y: 5, z: 6 }
    ],
    name: 'rocks',
    userData: { staticBatch: 'rocks' }
  });

  assert.equal(batch.count, 2);
  assert.equal(batch.name, 'rocks');
  assert.equal(batch.instanceMatrix.needsUpdate, true);
  assert.deepEqual(batch.matrices[0], {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0.5, z: 0 },
    scale: { x: 2, y: 3, z: 4 }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.OpenRTS.rendering.staticInstanceBatcher.describeBatch(batch))), {
    schemaVersion: 1,
    name: 'rocks',
    count: 2,
    userData: { staticBatch: 'rocks', instanceCount: 2 }
  });
});

test('three building model factory owns castle and tower fallback models', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeBuildingModelFactory.js');
  class Group {
    constructor() {
      this.children = [];
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
    }
    add(item) { this.children.push(item); }
    traverse(callback) { this.children.forEach(callback); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.rotation = {};
      this.isMesh = true;
    }
  }
  const calls = [];
  const materials = {
    courtyard: 'courtyard',
    slit: 'slit',
    stone: 'stone',
    stoneDark: 'stone-dark',
    stoneLight: 'stone-light',
    plaster: 'plaster',
    roofTerracotta: 'roof-terracotta',
    roofSlate: 'roof-slate',
    roofThatch: 'roof-thatch',
    wood: 'wood'
  };
  const addPrimitive = (parent, item) => {
    item.rotation = item.rotation || {};
    item.isMesh = true;
    parent.add(item);
    calls.push(item);
    return item;
  };
  const factory = context.OpenRTS.rendering.threeBuildingModels.createFactory({
    THREE: {
      Group,
      Mesh,
      PlaneGeometry: class { constructor(width, height) { this.width = width; this.height = height; } }
    },
    geometry: (key, factoryFn) => ({ key, value: factoryFn() }),
    addBox(parent, x, y, z, width, height, depth, material) {
      return addPrimitive(parent, { kind: 'box', x, y, z, width, height, depth, material });
    },
    addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments) {
      return addPrimitive(parent, { kind: 'cylinder', x, y, z, radiusTop, radiusBottom, height, material, segments });
    },
    materials,
    worldToScene: (x, y) => ({ x: x / 32, z: y / 32 }),
    getTeamMaterial: team => `team:${team}`,
    wallHeight: 1.25
  });

  const castle = factory.createCastle({ x: 64, y: 96, width: 8, height: 8, team: 'red' });
  const townCenter = factory.createEraKingdomsTownCenter({
    x: 96,
    y: 128,
    width: 8,
    height: 8,
    team: 'gold',
    factionId: 'eok_highland_realm'
  });
  const tower = factory.createDefenseTower({ x: 32, y: 64, team: 'blue' });

  assert.deepEqual(castle.positionValue, { x: 2, y: 0, z: 3 });
  assert.deepEqual(townCenter.positionValue, { x: 3, y: 0, z: 4 });
  assert.deepEqual(tower.positionValue, { x: 1, y: 0, z: 2 });
  assert.ok(castle.children.length > tower.children.length);
  assert.ok(townCenter.children.length > tower.children.length);
  assert.ok(calls.some(call => call.material === 'team:red'));
  assert.ok(calls.some(call => call.material === 'team:gold'));
  assert.ok(calls.some(call => call.material === 'roof-slate'));
  assert.ok(calls.some(call => call.material === 'team:blue'));
  assert.ok([...castle.children, ...tower.children].some(child => child.material === 'slit'));
  assert.ok(calls.some(call => call.kind === 'cylinder' && call.segments === 20));
});

test('mesh primitive factory centralizes primitive creation and positioning', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/MeshPrimitiveFactory.js');
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.scale = { set: (x, y, z) => { this.scaleValue = { x, y, z }; } };
    }
  }
  const parent = { children: [], add(mesh) { this.children.push(mesh); } };
  const geometryCache = {
    values: new Map(),
    get(key, factory) {
      if (!this.values.has(key)) this.values.set(key, factory());
      return this.values.get(key);
    }
  };
  const primitives = context.OpenRTS.rendering.meshPrimitives.createFactory({
    geometryCache,
    THREE: {
      Mesh,
      BoxGeometry: class { constructor(width, height, depth) { this.kind = 'box'; this.width = width; this.height = height; this.depth = depth; } },
      CylinderGeometry: class { constructor() { this.kind = 'cylinder'; } },
      SphereGeometry: class { constructor() { this.kind = 'sphere'; } }
    }
  });

  const box = primitives.addBox(parent, 1, 2, 3, 4, 6, 8, 'mat');
  const sphere = primitives.addSphere(parent, 0, 1, 2, 3, 'mat2', { x: 1, y: 2, z: 3 });

  assert.equal(box.geometry.kind, 'box');
  assert.deepEqual(box.positionValue, { x: 1, y: 5, z: 3 });
  assert.deepEqual(sphere.scaleValue, { x: 1, y: 2, z: 3 });
  assert.equal(parent.children.length, 2);
});

test('three unit attachment factory owns weapon and carried item model pieces', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeUnitAttachmentFactory.js');
  class Group {
    constructor() {
      this.children = [];
      this.position = {};
    }
    add(item) { this.children.push(item); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.scale = { set: (x, y, z) => { this.scaleValue = { x, y, z }; } };
      this.rotation = { set: (x, y, z) => { this.rotationValue = { x, y, z }; } };
    }
  }
  class Vector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  const calls = [];
  const factory = context.OpenRTS.rendering.threeUnitAttachments.createFactory({
    THREE: {
      Group,
      Mesh,
      Vector3,
      CatmullRomCurve3: class { constructor(points) { this.points = points; } },
      TubeGeometry: class { constructor(curve) { this.curve = curve; } },
      DodecahedronGeometry: class {}
    },
    geometry: (key, factoryFn) => ({ key, value: factoryFn() }),
    addBox(parent, x, y, z, width, height, depth, material) {
      const item = { kind: 'box', x, y, z, width, height, depth, material, rotation: {} };
      parent.add(item);
      calls.push(item);
      return item;
    },
    addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material) {
      const item = { kind: 'cylinder', x, y, z, radiusTop, radiusBottom, height, material, rotation: {} };
      parent.add(item);
      calls.push(item);
      return item;
    },
    addSphere(parent, x, y, z, radius, material) {
      const item = { kind: 'sphere', x, y, z, radius, material };
      parent.add(item);
      calls.push(item);
      return item;
    },
    addMesh(parent, mesh, x, y, z) {
      mesh.positionValue = { x, y, z };
      parent.add(mesh);
      calls.push(mesh);
      return mesh;
    },
    materials: {
      wood: 'wood',
      bone: 'bone',
      leather: 'leather',
      iron: 'iron',
      steel: 'steel',
      grenade: 'grenade',
      trunk: 'trunk',
      foliage: 'foliage',
      foliageLight: 'foliage-light',
      rock: 'rock',
      supply: 'supply'
    },
    obstacleTypes: { TREE: 1, ROCK: 2 }
  });

  const parent = new Group();
  factory.addLongbow(parent);
  factory.addPistol(parent);
  factory.addCrossbow(parent);
  factory.addGrenadeWeapon(parent);
  factory.addCarriedObject(parent, { inventoryItem: { carryType: 'obstacle', obstacleType: 2 } });

  assert.ok(parent.children.length >= 5);
  assert.ok(calls.some(call => call.material === 'grenade'));
  assert.ok(parent.children.some(child => child.material === 'rock'));
});

test('three unit model factory owns procedural unit body construction', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeUnitModelFactory.js');
  class Group {
    constructor() {
      this.children = [];
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.rotation = {};
    }
    add(item) { this.children.push(item); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.scale = { set: (x, y, z) => { this.scaleValue = { x, y, z }; } };
      this.rotation = {};
      this.castShadow = false;
      this.userData = {};
    }
  }
  const calls = [];
  const parentAdd = (parent, item) => {
    parent.add(item);
    calls.push(item);
    return item;
  };
  const materials = {
    bone: 'bone',
    gold: 'gold',
    horse: 'horse',
    iron: 'iron',
    leather: 'leather',
    sheep: 'sheep',
    sheepFace: 'sheep-face',
    skin: 'skin',
    steel: 'steel',
    unitShadow: 'unit-shadow',
    wood: 'wood'
  };
  const factory = context.OpenRTS.rendering.threeUnitModels.createFactory({
    THREE: {
      Group,
      Mesh,
      CircleGeometry: class { constructor(radius, segments) { this.radius = radius; this.segments = segments; } },
      ConeGeometry: class { constructor(radius, height, sides) { this.radius = radius; this.height = height; this.sides = sides; } }
    },
    geometry: (key, factoryFn) => ({ key, value: factoryFn() }),
    addBox(parent, x, y, z, width, height, depth, material) {
      return parentAdd(parent, { kind: 'box', x, y, z, width, height, depth, material, rotation: {} });
    },
    addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material) {
      return parentAdd(parent, { kind: 'cylinder', x, y, z, radiusTop, radiusBottom, height, material, rotation: {} });
    },
    addSphere(parent, x, y, z, radius, material) {
      return parentAdd(parent, { kind: 'sphere', x, y, z, radius, material });
    },
    materials,
    attachments: {
      addLongbow(parent, riderY) { parentAdd(parent, { kind: 'longbow', riderY }); },
      addPistol(parent, riderY) { parentAdd(parent, { kind: 'pistol', riderY }); },
      addCrossbow(parent, riderY) { parentAdd(parent, { kind: 'crossbow', riderY }); },
      addGrenadeWeapon(parent, riderY) { parentAdd(parent, { kind: 'grenade', riderY }); },
      addCarriedObject(parent, unit, riderY) { parentAdd(parent, { kind: 'carried', unitId: unit.id, riderY }); }
    },
    worldToScene: (x, y) => ({ x: x / 32, z: y / 32 }),
    getWorldElevation: () => 0.5,
    getTeamMaterial: team => `team:${team}`,
    addSelectionRing(parent, radius) { parentAdd(parent, { kind: 'selection-ring', radius }); },
    entityElevation: {
      unitElevation: ({ terrainElevation }) => terrainElevation
    },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    smoothStep: (_min, _max, value) => value
  });

  const model = factory.create({
    id: 'archer-1',
    x: 64,
    y: 96,
    team: 'red',
    unitType: 'archer',
    selected: true,
    hasActivePath: () => false
  });

  assert.deepEqual(model.positionValue, { x: 2, y: 0.5, z: 3 });
  assert.ok(model.children.some(child => child.material === 'unit-shadow' && child.userData?.contactShadow));
  assert.ok(calls.some(call => call.kind === 'selection-ring'));
  assert.ok(calls.some(call => call.kind === 'longbow'));
  assert.ok(calls.some(call => call.material === 'team:red'));
});

test('three camera sync owns renderer resize and camera placement', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeCoordinateService.js');
  loadOpenRTSScript('../../world/rendering/three/ThreeCameraSyncService.js', context);
  const sceneCamera = {
    position: { set: (x, y, z) => { sceneCamera.positionValue = { x, y, z }; } },
    lookAt(x, y, z) { this.lookAtValue = { x, y, z }; },
    updateProjectionMatrix() { this.projectionUpdated = true; },
    updateMatrixWorld() { this.matrixUpdated = true; }
  };
  const renderer = {
    getPixelRatio() { return 2; },
    setSize(width, height, updateStyle) { this.size = { width, height, updateStyle }; }
  };

  const synced = context.OpenRTS.rendering.threeCameraSync.syncCamera({
    sceneCamera,
    renderer,
    canvas: { width: 1, height: 1, clientWidth: 400, clientHeight: 200 },
    gameCamera: { x: 100, y: 50, zoom: 2, viewportWidth: 200, viewportHeight: 100, minZoom3D: 0.2 },
    scale: 0.1,
    mapWidth: 1000,
    mapHeight: 1000
  });

  assert.equal(synced, true);
  assert.deepEqual(renderer.size, { width: 400, height: 200, updateStyle: false });
  assert.equal(sceneCamera.aspect, 2);
  assert.equal(sceneCamera.positionValue.y, 12.5);
  assert.equal(sceneCamera.projectionUpdated, true);
  assert.equal(sceneCamera.matrixUpdated, true);
});

test('static world signatures centralize renderer rebuild invalidation', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/StaticWorldSignatureService.js');
  const signatures = context.OpenRTS.rendering.staticWorldSignatures;
  const base = signatures.createSignature({
    seed: 'abc',
    columns: 40,
    rows: 32,
    buildings: [{ id: 'castle-red', isDead: false, upgradeLevel: 1 }],
    obstacleRevision: 2,
    goldMineRevision: 3,
    houseRevision: 4,
    mapConfig: { terrainPreset: 'green', waterPercent: 20, rockCount: 8, treeCount: 12 }
  });
  const same = signatures.createSignature({
    seed: 'abc',
    columns: 40,
    rows: 32,
    buildings: [{ id: 'castle-red', isDead: false, upgradeLevel: 1 }],
    obstacleRevision: 2,
    goldMineRevision: 3,
    houseRevision: 4,
    mapConfig: { terrainPreset: 'green', waterPercent: 20, rockCount: 8, treeCount: 12 }
  });
  const changed = signatures.createSignature({
    seed: 'abc',
    columns: 40,
    rows: 32,
    buildings: [{ id: 'castle-red', isDead: false, upgradeLevel: 2 }],
    obstacleRevision: 2,
    goldMineRevision: 3,
    houseRevision: 4,
    mapConfig: { terrainPreset: 'green', waterPercent: 20, rockCount: 8, treeCount: 12 }
  });

  assert.equal(base, same);
  assert.notEqual(base, changed);
  assert.notEqual(
    base,
    signatures.createSignature({
      seed: 'abc',
      columns: 40,
      rows: 32,
      buildings: [{ id: 'castle-red', isDead: false, upgradeLevel: 1 }],
      obstacleRevision: 2,
      goldMineRevision: 3,
      houseRevision: 4,
      mapConfig: { terrainPreset: 'green', visualStyle: 'alien_crystal', waterPercent: 20, rockCount: 8, treeCount: 12 }
    })
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(signatures.summarizeMapConfig({ mapStyle: 'mustafar', terrain: { lava: true } }))),
    {
      terrainPreset: '',
      mapStyle: 'mustafar',
      visualStyle: '',
      terrain: { lava: true }
    }
  );
});

test('static world composer owns static scene assembly and lifecycle filters', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/StaticWorldComposer.js');
  const group = {
    cleared: false,
    children: [],
    clear() { this.cleared = true; this.children = []; },
    add(item) { this.children.push(item); }
  };
  let reset = false;
  const item = id => ({ id });

  const composed = context.OpenRTS.rendering.staticWorldComposer.compose({
    group,
    onReset: () => { reset = true; },
    createTerrainMeshes: () => [item('terrain-a'), item('terrain-b')],
    createObstacleBatches: () => ({ items: [item('rock-batch')], handledObstacleTypes: [2] }),
    obstacleData: [[1, 2], [0, 0]],
    decorationData: [[0, 0], [0, 9]],
    obstacle: { TREE: 1, ROCK: 2 },
    rows: 2,
    columns: 2,
    createTree: (x, y) => item(`tree:${x}:${y}`),
    createRock: (x, y) => item(`rock:${x}:${y}`),
    createMapDecoration: (x, y, value) => value ? item(`decor:${x}:${y}`) : null,
    buildings: [
      { id: 'castle', type: 'home', isDead: false },
      { id: 'tower', type: 'tower', isDead: false },
      { id: 'dead-tower', type: 'tower', isDead: true }
    ],
    homeType: 'home',
    createCastle: building => item(`castle:${building.id}`),
    createDefenseTower: building => item(`tower:${building.id}`),
    goldMines: [{ id: 'gold', isDead: false }, { id: 'dead-gold', isDead: true }],
    createGoldMine: mine => item(`gold:${mine.id}`),
    houses: [{ id: 'house', isDead: false }, { id: 'wreck', isDead: true, isWreck: true }, { id: 'gone', isDead: true }],
    createNeutralHouse: house => item(`house:${house.id}`)
  });

  assert.equal(composed, true);
  assert.equal(group.cleared, true);
  assert.equal(reset, true);
  assert.deepEqual(group.children.map(child => child.id), [
    'terrain-a',
    'terrain-b',
    'rock-batch',
    'tree:0:0',
    'decor:1:1',
    'castle:castle',
    'tower:tower',
    'gold:gold',
    'house:house',
    'house:wreck'
  ]);
});

test('tree wind animator keeps ambient tree movement out of renderer state', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/TreeWindAnimator.js');
  const crown = {
    rotation: { x: 1, z: 2 },
    userData: {
      windPhase: 0.5,
      windStrength: 0.2,
      baseRotationX: 0.1,
      baseRotationZ: -0.3
    }
  };

  context.OpenRTS.rendering.treeWind.updateCrowns([crown, null], 3);

  assert.equal(Number.isFinite(crown.rotation.x), true);
  assert.equal(Number.isFinite(crown.rotation.z), true);
  assert.notEqual(crown.rotation.x, 1);
  assert.notEqual(crown.rotation.z, 2);
});

test('entity elevation service combines terrain and flight height', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/EntityElevationService.js');
  const elevation = context.OpenRTS.rendering.entityElevation;

  assert.equal(elevation.unitElevation({
    unit: { movementType: 'ground' },
    terrainElevation: 0.4
  }), 0.4);
  assert.equal(elevation.unitElevation({
    unit: { movementType: 'air', flightHeight: 3.5 },
    terrainElevation: 0.4
  }), 3.9);
});

test('projectile visual factory creates projectile and impact renderables', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ProjectileVisualFactory.js');
  class Group {
    constructor() {
      this.children = [];
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.rotation = {};
    }
    add(item) { this.children.push(item); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { set: (x, y, z) => { this.positionValue = { x, y, z }; } };
      this.rotation = {};
      this.scale = { setScalar: value => { this.scaleValue = value; } };
    }
  }
  const deps = {
    THREE: {
      Group,
      Mesh,
      RingGeometry: class { constructor(inner, outer) { this.inner = inner; this.outer = outer; } }
    },
    worldToScene: (x, y) => ({ x: x / 10, z: y / -10 }),
    addSphere(parent, x, y, z, radius, material) { parent.add({ kind: 'sphere', x, y, z, radius, material }); },
    addBox(parent, x, y, z, width, height, depth, material) { parent.add({ kind: 'box', x, y, z, width, height, depth, material }); },
    geometry: (key, factory) => ({ key, value: factory() }),
    materials: {
      grenade: 'grenade',
      bolt: 'bolt',
      pistolRound: 'bullet',
      projectile: 'arrow',
      explosion: 'explosion'
    },
    scale: 0.1
  };

  const grenade = context.OpenRTS.rendering.projectileVisuals.createProjectileVisual({
    projectileType: 'grenade',
    x: 40,
    y: 20,
    distanceTraveled: 5,
    targetDistance: 10
  }, deps);
  const bolt = context.OpenRTS.rendering.projectileVisuals.createProjectileVisual({
    projectileType: 'bolt',
    x: 10,
    y: 10,
    dirX: 1,
    dirY: 0
  }, deps);
  const ring = context.OpenRTS.rendering.projectileVisuals.createImpactEffectVisual({
    type: 'explosion',
    x: 20,
    y: 30,
    age: 0.5,
    duration: 1,
    radius: 12
  }, deps);

  assert.equal(grenade.children[0].material, 'grenade');
  assert.equal(grenade.positionValue.y > 1, true);
  assert.equal(bolt.children[0].material, 'bolt');
  assert.equal(ring.material, 'explosion');
  assert.equal(ring.scaleValue, 0.6000000000000001);
});

test('dynamic world composer owns dynamic scene filters and assembly counts', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/DynamicWorldComposer.js');
  const group = {
    cleared: false,
    children: [],
    clear() { this.cleared = true; this.children = []; },
    add(item) { this.children.push(item); }
  };
  const item = id => ({ id });

  const counts = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    sources: {
      units: [{ id: 'u1' }, { id: 'hidden', hiddenInHouse: true }],
      sheep: [{ id: 's1' }, { id: 'mounted', isMounted: true }],
      ducks: [{ id: 'd1' }],
      horses: [{ id: 'h1' }, { id: 'dead-horse', isDead: true }],
      items: [{ id: 'i1' }, { id: 'picked', isPickedUp: true }],
      projectiles: [{ id: 'p1' }, { id: 'dead-projectile', dead: true }]
    },
    roasts: [{ id: 'r1' }],
    impactEffects: [{ id: 'e1' }],
    selectedObject: { objectType: 'obstacle', id: 'tree' },
    factories: {
      createUnit: value => item(`unit:${value.id}`),
      createSheep: value => item(`sheep:${value.id}`),
      createRoast: value => item(`roast:${value.id}`),
      createDuck: value => item(`duck:${value.id}`),
      createHorse: value => item(`horse:${value.id}`),
      createWorldItem: value => item(`item:${value.id}`),
      createProjectile: value => item(`projectile:${value.id}`),
      createImpactEffect: value => item(`effect:${value.id}`),
      createSelectedObjectMarker: value => value ? item(`selected:${value.id}`) : null
    }
  });

  assert.equal(group.cleared, true);
  assert.deepEqual(group.children.map(child => child.id), [
    'unit:u1',
    'sheep:s1',
    'roast:r1',
    'duck:d1',
    'horse:h1',
    'item:i1',
    'projectile:p1',
    'effect:e1',
    'selected:tree'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(counts)), {
    units: 1,
    sheep: 1,
    roasts: 1,
    ducks: 1,
    horses: 1,
    items: 1,
    selectionMarkers: 1,
    projectiles: 1,
    impactEffects: 1
  });
});

test('dynamic world composer reuses pooled entity visuals between frames', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/DynamicWorldComposer.js');
  const group = {
    children: [],
    add(item) { this.children.push(item); },
    remove(item) {
      const index = this.children.indexOf(item);
      if (index >= 0) this.children.splice(index, 1);
    },
    clear() { this.children = []; }
  };
  const pool = context.OpenRTS.rendering.dynamicWorldComposer.createDynamicPool();
  let created = 0;
  const make = value => ({
    id: `unit:${value.id}:${++created}`,
    position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; }, y: 0 },
    rotation: {}
  });
  const factories = { createUnit: make };
  const worldToScene = (x, y) => ({ x: x / 10, y: 0, z: y / 10 });

  const first = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    worldToScene,
    sources: { units: [{ id: 'u1', x: 10, y: 20, heading: 0 }] },
    factories
  });
  const firstVisual = group.children[0];
  const second = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    worldToScene,
    sources: { units: [{ id: 'u1', x: 30, y: 40, heading: 1 }] },
    factories
  });

  assert.equal(first.created, 1);
  assert.equal(second.reused, 1);
  assert.equal(group.children[0], firstVisual);
  assert.deepEqual(
    JSON.parse(JSON.stringify({ x: firstVisual.position.x, z: firstVisual.position.z, rotation: firstVisual.rotation.y })),
    { x: 3, z: 4, rotation: -1 }
  );
});

test('dynamic world composer rebuilds pooled units for attack animation state', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/DynamicWorldComposer.js');
  const group = {
    children: [],
    add(item) { this.children.push(item); },
    remove(item) {
      const index = this.children.indexOf(item);
      if (index >= 0) this.children.splice(index, 1);
    },
    clear() { this.children = []; }
  };
  const pool = context.OpenRTS.rendering.dynamicWorldComposer.createDynamicPool();
  let created = 0;
  const factories = {
    createUnit: unit => ({ id: `unit:${unit.id}:${++created}`, animation: unit.attackAnimationTime || 0, position: { set() {} }, rotation: {} })
  };

  context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    sources: { units: [{ id: 'swordsman', unitType: 'soldier', attackAnimationTime: 0, attackAnimationDuration: 0.24 }] },
    factories
  });
  const idleVisual = group.children[0];
  const attacking = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    sources: { units: [{ id: 'swordsman', unitType: 'soldier', attackAnimationTime: 0.2, attackAnimationDuration: 0.24 }] },
    factories
  });

  assert.equal(attacking.created, 1);
  assert.notEqual(group.children[0], idleVisual);
  assert.equal(group.children[0].animation, 0.2);
});

test('dynamic world composer culls offscreen pooled visuals before factory creation', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/DynamicWorldComposer.js');
  const group = {
    children: [],
    add(item) { this.children.push(item); },
    remove(item) {
      const index = this.children.indexOf(item);
      if (index >= 0) this.children.splice(index, 1);
    },
    clear() { this.children = []; }
  };
  const pool = context.OpenRTS.rendering.dynamicWorldComposer.createDynamicPool();
  let created = 0;
  const factories = {
    createUnit: unit => ({ id: `unit:${unit.id}:${++created}`, position: { set() {} }, rotation: {} })
  };

  const first = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    isVisible: source => source.x < 100,
    sources: {
      units: [
        { id: 'near', x: 10, y: 10 },
        { id: 'far', x: 1000, y: 1000 }
      ]
    },
    factories
  });
  const second = context.OpenRTS.rendering.dynamicWorldComposer.compose({
    group,
    pool,
    isVisible: source => source.x < 100,
    sources: {
      units: [
        { id: 'near', x: 1000, y: 1000 },
        { id: 'far', x: 1000, y: 1000 }
      ]
    },
    factories
  });

  assert.equal(first.units, 1);
  assert.equal(first.unitsCulled, 1);
  assert.equal(first.created, 1);
  assert.equal(created, 1);
  assert.equal(second.culled, 2);
  assert.equal(second.removed, 1);
  assert.equal(group.children.length, 0);
  assert.equal(pool.entries.size, 0);
});

test('render optimization services plan LOD shadows chunks and instancing batches', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/RenderOptimizationServices.js');
  const optimization = context.OpenRTS.rendering.optimization;
  const lod = optimization.chooseLod({
    id: 'unit.hover',
    url: 'high.glb',
    lods: [
      { distance: 20, url: 'mid.glb' },
      { distance: 60, url: 'low.glb' }
    ]
  }, 65);
  const shadowPolicy = optimization.createShadowPolicy({ maxCasterDistance: 10, minCasterSize: 0.5 });
  const chunks = optimization.createStaticChunkPlanner({ tileSize: 32, chunkTiles: 2 }).collectChunks({
    rows: 3,
    columns: 3,
    signatureForTile: (x, y) => `${x}:${y}`
  });
  const visible = optimization.createStaticChunkPlanner({ tileSize: 32, chunkTiles: 2 }).visibleChunks(chunks, {
    x: 0,
    y: 0,
    viewportWidth: 31,
    viewportHeight: 31,
    zoom: 1
  }, 0);
  const batches = optimization.planInstancedBatches([
    { model: 'tree' },
    { model: 'rock' },
    { model: 'tree' }
  ]);
  const culler = optimization.createWorldViewCuller({
    camera: { x: 100, y: 200, zoom: 2 },
    viewportWidth: 400,
    viewportHeight: 200,
    overscan: 20
  });

  assert.equal(lod.source, 'low.glb');
  assert.equal(shadowPolicy.shouldCast({ category: 'projectile', size: 2, distance: 1 }), false);
  assert.equal(shadowPolicy.shouldCast({ size: 2, distance: 1 }), false);
  assert.equal(shadowPolicy.shouldCast({ category: 'unit', size: 1, distance: 100 }), true);
  assert.equal(chunks.length, 4);
  assert.equal(visible.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(batches.map(batch => [batch.id, batch.count]))), [['tree', 2], ['rock', 1]]);
  assert.equal(culler.isVisible({ x: 120, y: 220 }), true);
  assert.equal(culler.isVisible({ x: 1000, y: 1000 }), false);
  assert.equal(culler.isVisible({ selected: true, x: 1000, y: 1000 }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(culler.bounds)), {
    left: 80,
    top: 180,
    right: 320,
    bottom: 320,
    width: 200,
    height: 100,
    overscan: 20
  });
});

test('render optimization services evaluate budgets dirty chunks LOD plans and health', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/RenderOptimizationServices.js');
  const optimization = context.OpenRTS.rendering.optimization;
  const frameBudget = optimization.createFrameBudget({
    targetFps: 60,
    drawCalls: 10,
    triangles: 100,
    dynamicPool: 5,
    culledRatioWarning: 0.5
  });
  const budgetResult = frameBudget.evaluate({
    frameMs: 20,
    drawCalls: 12,
    triangles: 80,
    dynamicPool: 6,
    culledRatio: 0.75
  });
  const planner = optimization.createStaticChunkPlanner({ tileSize: 16, chunkTiles: 2 });
  const previous = planner.collectChunks({
    rows: 2,
    columns: 2,
    signatureForTile: () => 'same'
  });
  const next = planner.collectChunks({
    rows: 2,
    columns: 2,
    signatureForTile: (x, y) => x === 1 && y === 1 ? 'changed' : 'same'
  });
  const diff = planner.diffChunks(previous, next);
  const instancing = optimization.summarizeInstancingPlan([
    { model: 'tree' },
    { model: 'tree' },
    { model: 'tree' },
    { model: 'rock' }
  ], { minBatchSize: 3 });
  const lodPlan = optimization.planLodForItems([
    { id: 'near', x: 0, y: 0, model: { url: 'high.glb', lods: [{ distance: 10, url: 'low.glb' }] } },
    { id: 'far', x: 30, y: 40, model: { url: 'high.glb', lods: [{ distance: 10, url: 'low.glb' }] } }
  ], {
    camera: { x: 0, y: 0 },
    modelFor: item => item.model
  });
  const culler = optimization.createWorldViewCuller({ camera: { x: 0, y: 0 }, viewportWidth: 100, viewportHeight: 100, overscan: 0 });
  const viewport = optimization.summarizeViewport({
    culler,
    visibleChunks: next,
    dynamicCounts: { units: 2, sheep: 1, culled: 4, created: 1, reused: 2, removed: 0 },
    staticCounts: { rockInstances: 12 }
  });
  const health = optimization.createRenderHealthReport({
    performance: {
      describe: () => ({
        gauges: {
          'render.three.drawCalls': 12,
          'render.three.triangles': 80,
          'render.dynamic.poolSize': 6,
          'render.dynamic.lastCulled': 18
        },
        timings: {
          'render.three.frame': { average: 20, max: 22 }
        }
      })
    },
    frameBudget
  });

  assert.deepEqual(JSON.parse(JSON.stringify(budgetResult.warnings)), ['frame_time', 'draw_calls', 'dynamic_pool', 'culling_pressure']);
  assert.equal(budgetResult.ok, false);
  assert.equal(budgetResult.quality.id, 'high');
  assert.deepEqual(JSON.parse(JSON.stringify(diff.summary)), { added: 0, removed: 0, changed: 1, unchanged: 0, dirty: 1 });
  assert.equal(instancing.instancedCount, 3);
  assert.equal(instancing.fallbackCount, 1);
  assert.equal(lodPlan[0].lod.source, 'high.glb');
  assert.equal(lodPlan[1].lod.source, 'low.glb');
  assert.deepEqual(JSON.parse(JSON.stringify(viewport.dynamic)), {
    rendered: 3,
    culled: 4,
    created: 1,
    reused: 2,
    removed: 0
  });
  assert.equal(viewport.visibleChunks, 1);
  assert.equal(health.ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(health.warnings)), ['frame_time', 'draw_calls', 'dynamic_pool', 'culling_pressure']);
});

test('model factory resolver bridges logical model assets to registered render factories', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/ThreeRenderDomains.js', {
    OpenRTS: {
      config: {
        assets: {
          resolveModel: id => id === 'unit.worker'
            ? { id, kind: 'procedural', factory: 'worker' }
            : null
        }
      }
    }
  });
  loadOpenRTSScript('../../world/rendering/three/RendererFactoryRegistry.js', context);
  loadOpenRTSScript('../../world/rendering/three/ModelFactoryResolver.js', context);

  context.OpenRTS.rendering.factoryRegistry.register(
    'unit.worker',
    (source, resolved, extra) => ({ id: resolved.id, unitType: source.unitType, extra }),
    { category: 'unit' }
  );

  const created = context.OpenRTS.rendering.modelFactoryResolver.create(
    { unitType: 'worker' },
    { category: 'unit' },
    'payload'
  );
  const fallback = context.OpenRTS.rendering.modelFactoryResolver.create(
    { unitType: 'unknown' },
    {
      category: 'unit',
      fallback: (_source, resolved) => ({ fallbackId: resolved.id })
    }
  );

  assert.deepEqual(created, { id: 'unit.worker', unitType: 'worker', extra: 'payload' });
  assert.deepEqual(fallback, { fallbackId: 'unit.unknown' });
  assert.equal(context.OpenRTS.rendering.modelFactoryResolver.resolve({ displayName: 'Sheep' }, { category: 'wildlife' }).id, 'wildlife.sheep');
});

test('render asset audit reports 3D model contract readiness for moddable packages', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/RendererFactoryRegistry.js');
  loadOpenRTSScript('../../world/rendering/three/RenderAssetAuditService.js', context);
  const registry = context.OpenRTS.rendering.factoryRegistry;
  registry.register('unit.worker', () => ({ kind: 'worker' }), { renderer: 'three', kind: 'procedural', category: 'unit' });
  registry.register('building.castle', () => ({ kind: 'castle' }), { renderer: 'three', kind: 'procedural', category: 'building' });

  const audit = context.OpenRTS.rendering.renderAssetAudit.createAudit({
    definitions: {
      units: {
        worker: { name: 'Worker', model: 'worker' },
        hover_tank: { name: 'Hover Tank', model: 'hover_tank' }
      },
      buildings: {
        home: { name: 'Castle', model: 'castle' }
      }
    },
    assetManifest: {
      models: {
        'unit.worker': { kind: 'procedural', renderer: 'three', factory: 'worker' },
        'unit.hover_tank': {
          kind: 'gltf',
          renderer: 'three',
          url: 'assets/models/hover_tank.glb',
          fallback: 'unit.worker',
          scale: 1.1,
          lods: [{ distance: 20, url: 'assets/models/hover_tank_lod1.glb' }],
          animations: { idle: 'Idle' }
        },
        'building.castle': { kind: 'procedural', renderer: 'three', factory: 'castle' }
      }
    },
    factoryRegistry: registry
  });

  assert.equal(audit.summary.errors, 0);
  assert.equal(audit.summary.missingModelContracts, 0);
  assert.equal(audit.summary.importedModels, 1);
  assert.equal(audit.summary.lodReadyModels, 1);
  assert.equal(audit.summary.animationReadyModels, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(audit.facets.categories)), ['building', 'unit']);
});

test('render asset audit catches invalid imported models and missing model contracts', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/RenderAssetAuditService.js');
  const audit = context.OpenRTS.rendering.renderAssetAudit.createAudit({
    definitions: {
      units: {
        walker: { name: 'Walker', model: 'walker' }
      },
      buildings: {}
    },
    assetManifest: {
      models: {
        'unit.bad_import': {
          kind: 'gltf',
          scale: 0,
          lods: [{ distance: 50 }, { distance: 10 }]
        }
      }
    },
    factoryRegistry: { list: () => [] }
  });
  const codes = audit.diagnostics.map(diagnostic => diagnostic.code);

  assert.equal(codes.includes('missing_model_contract'), true);
  assert.equal(codes.includes('missing_model_url'), true);
  assert.equal(codes.includes('missing_import_fallback'), true);
  assert.equal(codes.includes('invalid_model_scale'), true);
  assert.equal(codes.includes('unsorted_lods'), true);
});
