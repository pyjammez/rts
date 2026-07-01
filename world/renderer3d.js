const RTS3D = (() => {
  const SCALE = 1 / tileSize;
  const RAMPART_HEIGHT = 1.25;
  const state = {
    renderer: null,
    scene: null,
    camera: null,
    staticGroup: null,
    dynamicGroup: null,
    materials: null,
    raycaster: null,
    groundPlane: null,
    treeCrowns: [],
    teamMaterials: new Map(),
    staticSignature: '',
    initialized: false,
    threeUnavailableWarned: false,
    geometryCache: null,
    primitives: null,
    shadowPolicy: null,
    frameBudget: null,
    staticChunkPlanner: null,
    staticChunks: [],
    staticInstancingCounts: {},
    unitAttachments: null,
    unitModels: null,
    terrainMeshes: null,
    buildingModels: null,
    dynamicPool: null,
    lastDynamicCounts: {},
    proceduralFactoriesRegistered: false,
    treeWindFrame: 0,
    treeSpriteMaterials: null
  };

  function use3DRenderer() {
    return true;
  }

  function getTeamMaterial(team) {
    if (!state.materials) return null;
    if (team === 'red') return state.materials.red;
    if (team === 'blue') return state.materials.blue;

    const color = typeof getTeamColor === 'function' ? getTeamColor(team) : '#2c5fb5';
    if (!state.teamMaterials.has(color)) {
      state.teamMaterials.set(color, new window.THREE.MeshStandardMaterial({
        color,
        roughness: 0.72
      }));
    }
    return state.teamMaterials.get(color);
  }

  function init3DRenderer() {
    if (state.initialized) return true;
    const THREE = window.THREE;
    if (!THREE || !canvas3d) {
      if (!state.threeUnavailableWarned) {
        console.warn('Three.js is still loading; using the 2D renderer for this frame.');
        state.threeUnavailableWarned = true;
      }
      return false;
    }

    const runtime = OpenRTS.rendering.threeSceneBootstrap.createSceneRuntime({
      THREE,
      canvas: canvas3d,
      devicePixelRatio: window.devicePixelRatio || 1,
      maxPixelRatio: 1,
      shadowMapSize: 512,
      shadowType: THREE.BasicShadowMap,
      antialias: false
    });
    if (!runtime) return false;

    state.renderer = runtime.renderer;
    state.scene = runtime.scene;
    state.camera = runtime.camera;
    state.staticGroup = runtime.staticGroup;
    state.dynamicGroup = runtime.dynamicGroup;
    state.materials = createMaterials();
    state.raycaster = runtime.raycaster;
    state.groundPlane = runtime.groundPlane;
    state.geometryCache = OpenRTS.rendering.geometryCaches.createGeometryCache();
    state.shadowPolicy = OpenRTS.rendering.optimization.createShadowPolicy({
      maxCasterDistance: 24,
      minCasterSize: 0.28,
      alwaysCastCategories: ['unit', 'building'],
      neverCastCategories: ['projectile', 'impact', 'selection', 'tree', 'rock', 'terrain']
    });
    state.frameBudget = OpenRTS.rendering.optimization.createFrameBudget({
      targetFps: 60,
      drawCalls: 650,
      triangles: 450000,
      dynamicPool: 1800
    });
    state.staticChunkPlanner = OpenRTS.rendering.optimization.createStaticChunkPlanner({
      tileSize,
      chunkTiles: 12
    });
    state.primitives = OpenRTS.rendering.meshPrimitives.createFactory({
      THREE,
      geometryCache: state.geometryCache,
      shadowPolicy: state.shadowPolicy
    });
    state.terrainMeshes = OpenRTS.rendering.threeTerrainMeshes.createFactory({
      THREE,
      materials: state.materials,
      tileSize,
      getRows: () => MAP_ROWS,
      getColumns: () => MAP_COLS,
      getMapConfig: () => window.mapConfig || mapConfig || {},
      hashNoise,
      smoothValueNoise,
      fbmNoise,
      getWorldElevation: typeof getWorldElevation === 'function' ? getWorldElevation : null
    });
    state.buildingModels = OpenRTS.rendering.threeBuildingModels.createFactory({
      THREE,
      geometry,
      addBox,
      addCylinder,
      materials: state.materials,
      worldToScene,
      getTeamMaterial,
      wallHeight: RAMPART_HEIGHT
    });
    state.unitAttachments = OpenRTS.rendering.threeUnitAttachments.createFactory({
      THREE,
      geometry,
      addBox,
      addCylinder,
      addSphere,
      addMesh,
      materials: state.materials,
      obstacleTypes: OBSTACLE
    });
    state.unitModels = OpenRTS.rendering.threeUnitModels.createFactory({
      THREE,
      geometry,
      addBox,
      addCylinder,
      addSphere,
      materials: state.materials,
      attachments: state.unitAttachments,
      worldToScene,
      getWorldElevation: typeof getWorldElevation === 'function' ? getWorldElevation : null,
      getTeamMaterial,
      addSelectionRing,
      entityElevation: OpenRTS.rendering.entityElevation,
      clamp,
      smoothStep
    });
    state.dynamicPool = OpenRTS.rendering.dynamicWorldComposer.createDynamicPool();
    registerProceduralModelFactories();
    state.initialized = true;
    return true;
  }

  function createMaterials() {
    return OpenRTS.rendering.threeMaterials.create({
      THREE: window.THREE,
      renderer: state.renderer,
      documentRef: document,
      noise: hashNoise
    });
  }

  function geometry(key, factory) {
    if (!state.geometryCache) state.geometryCache = OpenRTS.rendering.geometryCaches.createGeometryCache();
    return state.geometryCache.get(key, factory);
  }

  function addMesh(parent, mesh, x, y, z, castShadow = true, receiveShadow = true) {
    return state.primitives.addMesh(parent, mesh, x, y, z, castShadow, receiveShadow);
  }

  function addBox(parent, x, y, z, width, height, depth, material) {
    return state.primitives.addBox(parent, x, y, z, width, height, depth, material);
  }

  function addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments = 16) {
    return state.primitives.addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments);
  }

  function addSphere(parent, x, y, z, radius, material, scale = null) {
    return state.primitives.addSphere(parent, x, y, z, radius, material, scale);
  }

  function worldToScene(worldX, worldY) {
    return OpenRTS.rendering.threeCoordinates.worldToScene(worldX, worldY, {
      scale: SCALE,
      mapWidth: getMapWidthPx(),
      mapHeight: getMapHeightPx()
    });
  }

  function sceneToWorld(point) {
    return OpenRTS.rendering.threeCoordinates.sceneToWorld(point, {
      scale: SCALE,
      mapWidth: getMapWidthPx(),
      mapHeight: getMapHeightPx()
    });
  }

  function smoothStep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
    return t * t * (3 - 2 * t);
  }

  function createTerrainMeshes() {
    return state.terrainMeshes.createTerrainMeshes({
      chunkTiles: state.staticChunkPlanner?.chunkSize || 0
    });
  }

  function visualStyle() {
    const config = window.mapConfig || mapConfig || {};
    return String(config.visualStyle || config.mapStyle || '').toLowerCase();
  }

  function createCastle(building) {
    return OpenRTS.rendering.modelFactoryResolver.create(building, {
      category: 'building',
      fallbackId: 'building.castle',
      fallback: state.buildingModels.createCastle
    });
  }

  function createDefenseTower(building) {
    return OpenRTS.rendering.modelFactoryResolver.create(building, {
      category: 'building',
      fallbackId: 'building.arrow_tower',
      fallback: state.buildingModels.createDefenseTower
    });
  }

  function addBranchBetween(parent, start, end, radius, material = state.materials.trunk, segments = 8) {
    const THREE = window.THREE;
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const length = direction.length();
    if (length <= 0.001) return null;
    const mesh = new THREE.Mesh(
      geometry(`tree-branch:${radius.toFixed(3)}:${length.toFixed(3)}:${segments}`, () =>
        new THREE.CylinderGeometry(radius * 0.72, radius, length, segments)
      ),
      material
    );
    mesh.position.set(
      (start.x + end.x) * 0.5,
      (start.y + end.y) * 0.5,
      (start.z + end.z) * 0.5
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addTreeGroundShadow(parent, radiusX, radiusZ) {
    const THREE = window.THREE;
    const shadow = new THREE.Mesh(
      geometry('tree-ground-shadow', () => new THREE.CircleGeometry(1, 12)),
      state.materials.treeShadow
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.018;
    shadow.scale.set(radiusX, radiusZ, 1);
    shadow.renderOrder = 1;
    parent.add(shadow);
  }

  function drawTreeBlob(context, x, y, radiusX, radiusY, colors) {
    const gradient = context.createRadialGradient(
      x - radiusX * 0.34,
      y - radiusY * 0.42,
      Math.max(2, radiusX * 0.08),
      x,
      y,
      Math.max(radiusX, radiusY)
    );
    gradient.addColorStop(0, colors.highlight);
    gradient.addColorStop(0.42, colors.mid);
    gradient.addColorStop(0.82, colors.shadow);
    gradient.addColorStop(1, colors.edge);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
  }

  function createTreeSpriteTexture(kind = 'oak') {
    const THREE = window.THREE;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 160;
    textureCanvas.height = 220;
    const context = textureCanvas.getContext('2d');

    const foliage = kind === 'palm'
      ? { highlight: '#cde878', mid: '#5fa345', shadow: '#276a3c', edge: 'rgba(31, 73, 36, 0)' }
      : kind === 'pine'
        ? { highlight: '#b6d96b', mid: '#477f42', shadow: '#1f4f34', edge: 'rgba(20, 48, 31, 0)' }
        : { highlight: '#d4e987', mid: '#659c43', shadow: '#2e6539', edge: 'rgba(31, 66, 32, 0)' };

    context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const trunkGradient = context.createLinearGradient(68, 112, 96, 210);
    trunkGradient.addColorStop(0, '#916440');
    trunkGradient.addColorStop(0.5, '#6b4428');
    trunkGradient.addColorStop(1, '#3f281b');
    context.strokeStyle = trunkGradient;
    context.lineWidth = kind === 'palm' ? 15 : 19;
    context.beginPath();
    if (kind === 'palm') {
      context.moveTo(77, 202);
      context.bezierCurveTo(84, 163, 71, 128, 87, 84);
    } else {
      context.moveTo(80, 204);
      context.bezierCurveTo(80, 166, 78, 139, 81, 104);
    }
    context.stroke();

    context.strokeStyle = 'rgba(45, 29, 18, 0.28)';
    context.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      context.beginPath();
      context.moveTo(72 + i * 3, 190 - i * 18);
      context.lineTo(88 + i * 2, 183 - i * 18);
      context.stroke();
    }

    if (kind === 'pine') {
      drawTreeBlob(context, 80, 68, 42, 42, foliage);
      drawTreeBlob(context, 80, 100, 57, 46, foliage);
      drawTreeBlob(context, 80, 132, 66, 48, foliage);
    } else if (kind === 'palm') {
      drawTreeBlob(context, 80, 63, 42, 32, foliage);
      drawTreeBlob(context, 46, 75, 38, 25, foliage);
      drawTreeBlob(context, 114, 75, 38, 25, foliage);
      drawTreeBlob(context, 80, 91, 48, 25, foliage);
      drawTreeBlob(context, 80, 48, 30, 25, foliage);
    } else {
      drawTreeBlob(context, 80, 73, 56, 50, foliage);
      drawTreeBlob(context, 48, 98, 45, 39, foliage);
      drawTreeBlob(context, 112, 98, 45, 39, foliage);
      drawTreeBlob(context, 78, 113, 56, 42, foliage);
      drawTreeBlob(context, 80, 47, 38, 34, foliage);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function getTreeSpriteMaterial(kind = 'oak') {
    const THREE = window.THREE;
    if (!state.treeSpriteMaterials) state.treeSpriteMaterials = new Map();
    if (state.treeSpriteMaterials.has(kind)) return state.treeSpriteMaterials.get(kind);
    const material = new THREE.SpriteMaterial({
      map: createTreeSpriteTexture(kind),
      color: 0xffffff,
      transparent: true,
      depthWrite: false
    });
    state.treeSpriteMaterials.set(kind, material);
    return material;
  }

  function addTreeSprite(parent, kind, height, width) {
    const THREE = window.THREE;
    if (!THREE.Sprite) return null;
    const sprite = new THREE.Sprite(getTreeSpriteMaterial(kind));
    sprite.position.set(0, height * 0.5, 0);
    sprite.scale.set(width, height, 1);
    sprite.renderOrder = 2;
    sprite.userData.category = 'tree';
    parent.add(sprite);
    return sprite;
  }

  function addOakTree(group, tileX, tileY, height) {
    addTreeSprite(group, 'oak', height, 1.85 + hashNoise(tileX + 31, tileY + 43) * 0.22);
  }

  function addPineTree(group, tileX, tileY, height) {
    addTreeSprite(group, 'pine', height, 1.55 + hashNoise(tileX + 37, tileY + 47) * 0.18);
  }

  function addPalmTree(group, tileX, tileY, height) {
    addTreeSprite(group, 'palm', height, 1.72 + hashNoise(tileX + 41, tileY + 53) * 0.2);
  }

  function createTree(tileX, tileY) {
    const THREE = window.THREE;
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const group = new THREE.Group();
    const jitterX = (hashNoise(tileX + 151, tileY + 263) - 0.5) * 0.16;
    const jitterZ = (hashNoise(tileX + 379, tileY + 443) - 0.5) * 0.16;
    group.position.set(position.x + jitterX, 0, position.z + jitterZ);
    group.rotation.y = hashNoise(tileX + 719, tileY + 827) * Math.PI * 2;
    const style = visualStyle();
    const roll = hashNoise(tileX + 83, tileY + 29);
    let kind = Math.floor(roll * 3);
    if (style === 'fantasy_forest') kind = roll < 0.45 ? 1 : roll < 0.86 ? 0 : 2;
    else if (style === 'temperate_kingdom') kind = roll < 0.68 ? 1 : roll < 0.94 ? 0 : 2;
    else if (style === 'arabia_dryland') kind = roll < 0.86 ? 0 : 1;
    else if (style === 'desert_raid' || style === 'industrial_desert') kind = roll < 0.82 ? 2 : 1;
    else if (style === 'metal_wasteland') kind = roll < 0.72 ? 0 : 1;
    const styleHeightBoost = style === 'fantasy_forest' ? 0.32 : style === 'temperate_kingdom' ? 0.18 : 0;
    const height = 2.25 + styleHeightBoost + hashNoise(tileX + 17, tileY + 41) * 0.85;
    const widthScale = 0.9 + hashNoise(tileX + 971, tileY + 593) * 0.24;
    group.scale.x = widthScale;
    group.scale.z = 0.92 + hashNoise(tileX + 641, tileY + 733) * 0.2;
    addTreeGroundShadow(group, kind === 0 ? 0.72 : 0.88, kind === 0 ? 0.5 : 0.62);

    if (kind === 0) addPineTree(group, tileX, tileY, height);
    else if (kind === 1) addOakTree(group, tileX, tileY, height);
    else addPalmTree(group, tileX, tileY, height);
    return group;
  }

  function rockProfile() {
    const style = visualStyle();
    if (style === 'alien_crystal') {
      return {
        geometryKey: 'rock:crystal-octahedron',
        geometryFactory: () => new window.THREE.OctahedronGeometry(1, 0),
        material: state.materials.crystal || state.materials.rock,
        countBase: 5,
        countRange: 9,
        radius: 0.42,
        sizeBase: 0.28,
        sizeRange: 0.46,
        scale: [0.58, 1.95, 0.58]
      };
    }
    if (style === 'desert_raid' || style === 'industrial_desert') {
      return {
        material: state.materials.rockSandstone || state.materials.rock,
        countBase: 5,
        countRange: 8,
        radius: 0.62,
        sizeBase: 0.27,
        sizeRange: 0.34,
        scale: [1.45, 0.58, 1.14]
      };
    }
    if (style === 'metal_wasteland') {
      return {
        material: state.materials.rockMetal || state.materials.rockBasalt || state.materials.rock,
        countBase: 7,
        countRange: 9,
        radius: 0.54,
        sizeBase: 0.25,
        sizeRange: 0.38,
        scale: [1.18, 0.88, 1.02]
      };
    }
    if (style === 'fantasy_forest') {
      return {
        material: state.materials.rockBasalt || state.materials.rock,
        countBase: 6,
        countRange: 8,
        radius: 0.5,
        sizeBase: 0.23,
        sizeRange: 0.32,
        scale: [1.2, 0.84, 1.06]
      };
    }
    return {
      material: state.materials.rock,
      countBase: 4,
      countRange: 7,
      radius: 0.48,
      sizeBase: 0.25,
      sizeRange: 0.32,
      scale: [1.25, 0.92, 1]
    };
  }

  function createRock(tileX, tileY) {
    const THREE = window.THREE;
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    const profile = rockProfile();
    const count = profile.countBase + Math.floor(hashNoise(tileX + 11, tileY + 71) * profile.countRange);
    for (let i = 0; i < count; i++) {
      const angle = hashNoise(tileX + i * 31, tileY + 97) * Math.PI * 2;
      const radius = hashNoise(tileX + i * 17, tileY + 59) * profile.radius;
      const size = profile.sizeBase + hashNoise(tileX + i * 13, tileY + 7) * profile.sizeRange;
      const rock = new THREE.Mesh(
        geometry(profile.geometryKey || 'rock:dodecahedron', profile.geometryFactory || (() => new THREE.DodecahedronGeometry(1, 0))),
        profile.material
      );
      rock.scale.set(size * profile.scale[0], size * profile.scale[1] * (0.78 + hashNoise(i, tileX) * 0.34), size * profile.scale[2]);
      rock.rotation.set(hashNoise(i, tileY) * 0.4, angle, hashNoise(tileX, i) * 0.35);
      addMesh(group, rock, Math.cos(angle) * radius, size * 0.38, Math.sin(angle) * radius);
    }
    return group;
  }

  function createRockInstanceBatches({ obstacleData: sourceObstacleData = [], obstacle = {}, rows = 0, columns = 0 } = {}) {
    const THREE = window.THREE;
    if (!THREE?.InstancedMesh || !OpenRTS.rendering.staticInstanceBatcher) return null;
    const instances = [];
    const profile = rockProfile();
    for (let tileY = 0; tileY < rows; tileY++) {
      for (let tileX = 0; tileX < columns; tileX++) {
        if (sourceObstacleData[tileY]?.[tileX] !== obstacle.ROCK) continue;
        const center = tileCenter(tileX, tileY);
        const position = worldToScene(center.x, center.y);
        const count = profile.countBase + Math.floor(hashNoise(tileX + 11, tileY + 71) * profile.countRange);
        for (let i = 0; i < count; i++) {
          const angle = hashNoise(tileX + i * 31, tileY + 97) * Math.PI * 2;
          const radius = hashNoise(tileX + i * 17, tileY + 59) * profile.radius;
          const size = profile.sizeBase + hashNoise(tileX + i * 13, tileY + 7) * profile.sizeRange;
          instances.push({
            x: position.x + Math.cos(angle) * radius,
            y: size * 0.38,
            z: position.z + Math.sin(angle) * radius,
            rotationX: hashNoise(i, tileY) * 0.4,
            rotationY: angle,
            rotationZ: hashNoise(tileX, i) * 0.35,
            scaleX: size * profile.scale[0],
            scaleY: size * profile.scale[1] * (0.78 + hashNoise(i, tileX) * 0.34),
            scaleZ: size * profile.scale[2]
          });
        }
      }
    }
    const batch = OpenRTS.rendering.staticInstanceBatcher.createInstancedMeshBatch({
      THREE,
      geometry: geometry(profile.geometryKey || 'rock:dodecahedron', profile.geometryFactory || (() => new THREE.DodecahedronGeometry(1, 0))),
      material: profile.material,
      instances,
      name: 'static-rock-outcrop-boulders',
      userData: { staticBatch: 'rocks', obstacleType: obstacle.ROCK }
    });
    state.staticInstancingCounts = {
      ...(state.staticInstancingCounts || {}),
      rockBatches: batch ? 1 : 0,
      rockInstances: instances.length
    };
    return batch
      ? { items: [batch], handledObstacleTypes: [obstacle.ROCK] }
      : null;
  }

  function createDitch(tileX, tileY) {
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const elevation = typeof getWorldElevation === 'function' ? getWorldElevation(center.x, center.y) : 0;
    const group = new window.THREE.Group();
    group.position.set(position.x, elevation + 0.018, position.z);
    group.rotation.y = hashNoise(tileX + 23, tileY + 47) > 0.5 ? 0.18 : -0.18;

    addBox(group, 0, 0, 0, 0.96, 0.035, 0.42, state.materials.dirt);
    addBox(group, -0.18, 0.02, -0.18, 0.46, 0.06, 0.09, state.materials.wood).rotation.y = 0.22;
    addBox(group, 0.18, 0.025, 0.18, 0.48, 0.06, 0.09, state.materials.wood).rotation.y = -0.42;
    addBox(group, -0.42, 0.035, 0, 0.12, 0.09, 0.5, state.materials.dirt);
    addBox(group, 0.42, 0.035, 0, 0.12, 0.09, 0.5, state.materials.dirt);
    return group;
  }

  function createCliffWall(tileX, tileY) {
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const elevation = typeof getWorldElevation === 'function' ? getWorldElevation(center.x, center.y) : 0;
    const group = new window.THREE.Group();
    group.position.set(position.x, elevation - 0.18, position.z);

    for (let i = 0; i < 8; i++) {
      const px = -0.42 + (i % 4) * 0.28 + (hashNoise(tileX + i * 7, tileY + 3) - 0.5) * 0.04;
      const pz = i < 4 ? -0.28 : 0.06;
      const width = 0.24 + hashNoise(tileX + i * 13, tileY + 11) * 0.08;
      const height = 0.34 + hashNoise(tileX + i * 17, tileY + 19) * 0.28;
      const depth = 0.18 + hashNoise(tileX + i * 23, tileY + 29) * 0.08;
      const material = i % 3 === 0 ? state.materials.stoneDark : state.materials.rock;
      const block = addBox(group, px, 0, pz, width, height, depth, material);
      block.rotation.y = (hashNoise(tileX + i, tileY + i) - 0.5) * 0.28;
    }
    addBox(group, 0, 0.34, -0.1, 1.02, 0.08, 0.52, state.materials.stoneLight);
    return group;
  }

  function createWell(tileX, tileY) {
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const elevation = typeof getWorldElevation === 'function' ? getWorldElevation(center.x, center.y) : 0;
    const group = new window.THREE.Group();
    group.position.set(position.x, elevation + 0.01, position.z);
    group.rotation.y = hashNoise(tileX + 89, tileY + 131) * Math.PI * 2;

    addCylinder(group, 0, 0, 0, 0.36, 0.42, 0.34, state.materials.stoneDark, 18);
    addCylinder(group, 0, 0.31, 0, 0.25, 0.3, 0.035, state.materials.slit, 18);
    addCylinder(group, -0.32, 0.28, 0, 0.035, 0.045, 0.74, state.materials.wood, 8);
    addCylinder(group, 0.32, 0.28, 0, 0.035, 0.045, 0.74, state.materials.wood, 8);
    addBox(group, 0, 1.03, 0, 0.78, 0.08, 0.08, state.materials.wood);
    addCylinder(group, 0, 0.52, 0, 0.012, 0.012, 0.46, state.materials.iron, 8);
    addBox(group, 0, 0.31, 0, 0.16, 0.16, 0.14, state.materials.wood);
    addBox(group, 0, 0.47, 0, 0.22, 0.035, 0.18, state.materials.iron);
    return group;
  }

  function createHutDecoration(tileX, tileY) {
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const elevation = typeof getWorldElevation === 'function' ? getWorldElevation(center.x, center.y) : 0;
    const group = new window.THREE.Group();
    group.position.set(position.x, elevation + 0.01, position.z);
    group.rotation.y = hashNoise(tileX + 211, tileY + 17) * Math.PI * 2;
    addBox(group, 0, 0.02, 0, 0.52, 0.42, 0.48, state.materials.wood);
    const roof = new window.THREE.Mesh(
      geometry('decor:hut-roof', () => new window.THREE.ConeGeometry(0.48, 0.44, 4)),
      state.materials.trunk
    );
    roof.rotation.y = Math.PI * 0.25;
    addMesh(group, roof, 0, 0.66, 0);
    return group;
  }

  function createMapDecoration(tileX, tileY, decorType) {
    if (decorType === DECOR.DITCH) return createDitch(tileX, tileY);
    if (decorType === DECOR.CLIFF) return createCliffWall(tileX, tileY);
    if (decorType === DECOR.WELL) return createWell(tileX, tileY);
    if (decorType === DECOR.HUT) return createHutDecoration(tileX, tileY);
    return null;
  }

  function createGoldMine(mine) {
    const THREE = window.THREE;
    const position = worldToScene(mine.x, mine.y);
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    group.rotation.y = hashNoise(mine.tileX + 101, mine.tileY + 211) * Math.PI * 2;

    const style = visualStyle();
    const profile = rockProfile();
    const count = style === 'alien_crystal' ? 18 : style === 'metal_wasteland' ? 30 : style === 'industrial_desert' || style === 'desert_raid' ? 20 : 24;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + hashNoise(mine.tileX + i * 17, mine.tileY) * 0.38;
      const radius = 0.18 + hashNoise(mine.tileX + i * 23, mine.tileY + 7) * (style === 'metal_wasteland' ? 1.18 : 1.02);
      const size = 0.28 + hashNoise(mine.tileX + i * 11, mine.tileY + 13) * (style === 'alien_crystal' ? 0.52 : 0.36);
      const resourceMaterial = style === 'alien_crystal'
        ? state.materials.crystal
        : style === 'metal_wasteland'
          ? state.materials.rockMetal
          : style === 'industrial_desert' || style === 'desert_raid'
            ? state.materials.supply
            : state.materials.gold;
      const rock = new THREE.Mesh(
        geometry(profile.geometryKey || 'rock:dodecahedron', profile.geometryFactory || (() => new THREE.DodecahedronGeometry(1, 0))),
        i % 3 === 0 ? resourceMaterial : profile.material
      );
      const tallCrystal = style === 'alien_crystal' && i % 3 === 0;
      rock.scale.set(size * (tallCrystal ? 0.62 : 1.32), size * (tallCrystal ? 2.35 : 0.78), size * (tallCrystal ? 0.62 : 1.08));
      rock.rotation.set(hashNoise(i, mine.tileY) * 0.4, angle, hashNoise(mine.tileX, i) * 0.35);
      addMesh(group, rock, Math.cos(angle) * radius, size * 0.32, Math.sin(angle) * radius);
    }

    return group;
  }

  function createNeutralHouse(house) {
    const position = worldToScene(house.x, house.y);
    const group = new window.THREE.Group();
    group.position.set(position.x, 0, position.z);
    const occupied = (house.occupants?.length || 0) > 0;

    if (house.isWreck) {
      addBox(group, 0, 0.05, 0, 1.35, 0.2, 1.0, state.materials.charcoal || state.materials.rock);
      addBox(group, -0.25, 0.18, 0, 0.12, 0.5, 1.1, state.materials.wood).rotation.z = 0.65;
      addBox(group, 0.28, 0.2, 0, 0.1, 0.52, 1.0, state.materials.wood).rotation.z = -0.58;
      return group;
    }

    addBox(group, 0, 0.1, 0, 1.35, 0.7, 1.05, state.materials.wood);
    addBox(group, 0, 0.08, 0.54, 0.28, 0.42, 0.05, state.materials.dirt);
    if (!occupied) {
      const roof = new window.THREE.Mesh(
        geometry('house:roof', () => new window.THREE.ConeGeometry(1.05, 0.62, 4)),
        state.materials.trunk
      );
      roof.rotation.y = Math.PI * 0.25;
      addMesh(group, roof, 0, 0.9, 0);
    }
    if (house.burning) {
      for (let i = 0; i < 4; i++) {
        const flame = new window.THREE.Mesh(
          geometry('house:flame', () => new window.THREE.ConeGeometry(0.12, 0.5, 7)),
          i % 2 ? state.materials.gold : state.materials.red
        );
        flame.position.set((i - 1.5) * 0.22, 1.05, 0.05 * (i % 2 ? 1 : -1));
        flame.rotation.y = i;
        group.add(flame);
      }
    }
    return group;
  }

  function buildStaticWorld() {
    return OpenRTS.rendering.staticWorldComposer.compose({
      group: state.staticGroup,
      onReset: () => { state.treeCrowns = []; },
      createTerrainMeshes,
      createObstacleBatches: createRockInstanceBatches,
      obstacleData,
      decorationData,
      obstacle: OBSTACLE,
      decor: DECOR,
      rows: MAP_ROWS,
      columns: MAP_COLS,
      createTree,
      createRock,
      createMapDecoration,
      buildings: getBuildings(),
      homeType: BUILDING_TYPES.HOME,
      createCastle,
      createDefenseTower,
      goldMines: typeof getGoldMines === 'function' ? getGoldMines() : [],
      createGoldMine,
      houses: typeof getHouses === 'function' ? getHouses() : [],
      createNeutralHouse
    });
  }

  function updateStaticChunks() {
    if (!state.staticChunkPlanner) return [];
    const heights = typeof heightData !== 'undefined' ? heightData : [];
    state.staticChunks = state.staticChunkPlanner.collectChunks({
      rows: MAP_ROWS,
      columns: MAP_COLS,
      signatureForTile: (x, y) => [
        terrainData[y]?.[x],
        obstacleData[y]?.[x],
        decorationData[y]?.[x],
        heights[y]?.[x]
      ].join(',')
    });
    return state.staticChunks;
  }

  function updateStaticChunkVisibility() {
    if (!state.staticChunkPlanner || !state.staticChunks?.length || !state.staticGroup?.children) return;
    const visibleChunks = state.staticChunkPlanner.visibleChunks(state.staticChunks, {
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
      viewportWidth: camera.viewportWidth || canvas.width,
      viewportHeight: camera.viewportHeight || canvas.height
    }, tileSize * 4);
    const visibleIds = new Set(visibleChunks.map(chunk => chunk.id));
    let tagged = 0;
    let visible = 0;
    for (const child of state.staticGroup.children) {
      const chunkId = child?.userData?.staticChunkId;
      if (!chunkId) continue;
      tagged++;
      child.visible = visibleIds.has(chunkId);
      if (child.visible) visible++;
    }
    OpenRTS.diagnostics.performance?.setGauge?.('render.static.visibleChunks', visibleChunks.length);
    OpenRTS.diagnostics.performance?.setGauge?.('render.static.visibleChunkMeshes', visible);
    OpenRTS.diagnostics.performance?.setGauge?.('render.static.chunkedMeshes', tagged);
  }

  function staticWorldSignature() {
    return OpenRTS.rendering.staticWorldSignatures.createSignature({
      seed: MAP_SEED,
      columns: MAP_COLS,
      rows: MAP_ROWS,
      buildings: getBuildings(),
      obstacleRevision: typeof getObstacleRevision === 'function' ? getObstacleRevision() : 0,
      goldMineRevision: typeof getGoldMineRevision === 'function' ? getGoldMineRevision() : 0,
      houseRevision: typeof getHouseRevision === 'function' ? getHouseRevision() : 0,
      mapConfig
    });
  }

  function addSelectionRing(parent, radius) {
    const THREE = window.THREE;
    const ring = new THREE.Mesh(
      geometry(`ring:${radius}`, () => new THREE.RingGeometry(radius * 0.78, radius, 32)),
      state.materials.selection
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.025;
    ring.renderOrder = 4;
    parent.add(ring);
  }

  function createProceduralUnit(unit) {
    return state.unitModels.create(unit);
  }

  function createUnit(unit) {
    return OpenRTS.rendering.modelFactoryResolver.create(unit, {
      category: 'unit',
      fallbackId: `unit.${unit?.unitType || 'soldier'}`,
      fallback: createProceduralUnit
    });
  }

  function createProceduralSheep(sheep) {
    const group = new window.THREE.Group();
    const position = worldToScene(sheep.x, sheep.y);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = -(Number.isFinite(sheep.heading) ? sheep.heading : 0);
    if (sheep.selected) addSelectionRing(group, 0.48);
    if (sheep.isDead) {
      addBox(group, 0, 0.04, 0, 0.58, 0.06, 0.1, state.materials.bone);
      for (let i = -2; i <= 2; i++) addBox(group, i * 0.1, 0.07, 0, 0.035, 0.18, 0.22, state.materials.bone).rotation.z = Math.PI * 0.5;
      addSphere(group, 0.38, 0.1, 0, 0.13, state.materials.bone);
      return group;
    }
    const step = sheep.grazeTimer > 0 ? 0 : Math.sin(performance.now() * 0.006 + sheep.phase) * 0.05;
    addSphere(group, 0, 0.34, 0, 0.42, state.materials.sheep, { x: 0.56, y: 0.34, z: 0.34 });
    addSphere(group, 0.43, 0.42, 0, 0.16, state.materials.sheepFace);
    for (const [legX, legZ, offset] of [[-0.22, -0.14, step], [-0.22, 0.14, -step], [0.22, -0.14, -step], [0.22, 0.14, step]]) {
      addBox(group, legX, 0.03, legZ + offset, 0.055, 0.25, 0.055, state.materials.sheepFace);
    }
    return group;
  }

  function createRoast(roast) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const position = worldToScene(roast.x, roast.y);
    group.position.set(position.x, 0, position.z);

    const logA = addCylinder(group, 0, 0.035, 0, 0.08, 0.1, 0.9, state.materials.wood, 8);
    logA.rotation.z = Math.PI * 0.5;
    logA.rotation.y = Math.PI * 0.25;
    const logB = addCylinder(group, 0, 0.04, 0, 0.08, 0.1, 0.9, state.materials.wood, 8);
    logB.rotation.z = Math.PI * 0.5;
    logB.rotation.y = -Math.PI * 0.25;

    const flicker = 1 + Math.sin(roast.age * 12.5) * 0.12;
    const outerFlame = new THREE.Mesh(
      geometry('roast:flame-outer', () => new THREE.ConeGeometry(0.3, 0.78, 9)),
      state.materials.flameOrange
    );
    outerFlame.position.y = 0.4;
    outerFlame.scale.set(1, flicker, 1);
    outerFlame.rotation.y = roast.age * 1.7;
    group.add(outerFlame);
    const innerFlame = new THREE.Mesh(
      geometry('roast:flame-inner', () => new THREE.ConeGeometry(0.16, 0.5, 8)),
      state.materials.flameYellow
    );
    innerFlame.position.set(0.04, 0.3, -0.02);
    innerFlame.scale.y = 1.05 + Math.cos(roast.age * 15) * 0.13;
    group.add(innerFlame);

    for (const side of [-1, 1]) {
      addBranchBetween(group, { x: side * 0.62, y: 0.02, z: 0 }, { x: side * 0.62, y: 0.95, z: 0 }, 0.035, state.materials.wood, 7);
    }
    const spit = addCylinder(group, 0, 0.82, 0, 0.025, 0.025, 1.55, state.materials.iron, 8);
    spit.rotation.z = Math.PI * 0.5;

    const roastAssembly = new THREE.Group();
    roastAssembly.position.y = 0.82;
    roastAssembly.rotation.x = roast.rotation;
    addSphere(roastAssembly, 0, 0, 0, 0.34, state.materials.roast, { x: 0.58, y: 0.28, z: 0.3 });
    addSphere(roastAssembly, 0.46, 0, 0, 0.13, state.materials.roast);
    for (const x of [-0.3, -0.1, 0.12, 0.32]) {
      const stripe = addBox(roastAssembly, x, -0.2, 0.22, 0.045, 0.4, 0.035, state.materials.roastLight);
      stripe.rotation.z = -0.22;
    }
    for (const [x, z] of [[-0.28, -0.18], [-0.28, 0.18], [0.25, -0.18], [0.25, 0.18]]) {
      addBox(roastAssembly, x, -0.04, z, 0.055, 0.28, 0.055, state.materials.roastLight);
    }
    group.add(roastAssembly);
    return group;
  }

  function createSheep(sheep) {
    return OpenRTS.rendering.modelFactoryResolver.create(sheep, {
      category: 'wildlife',
      fallbackId: 'wildlife.sheep',
      fallback: createProceduralSheep
    });
  }

  function createProceduralDuck(duck) {
    const group = new window.THREE.Group();
    const position = worldToScene(duck.x, duck.y);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = -(Number.isFinite(duck.heading) ? duck.heading : 0);
    if (duck.selected) addSelectionRing(group, 0.32);
    if (duck.isDead) {
      addBox(group, 0, 0.03, 0, 0.3, 0.04, 0.08, state.materials.bone);
      return group;
    }
    const bob = Math.sin(performance.now() * 0.003 + duck.bobPhase) * 0.025;
    addSphere(group, 0, 0.17 + bob, 0, 0.2, state.materials.duck, { x: 0.32, y: 0.2, z: 0.2 });
    addSphere(group, 0.22, 0.29 + bob, 0, 0.12, state.materials.duckHead);
    addBox(group, 0.35, 0.25 + bob, 0, 0.12, 0.045, 0.08, state.materials.orange);
    return group;
  }

  function createDuck(duck) {
    return OpenRTS.rendering.modelFactoryResolver.create(duck, {
      category: 'wildlife',
      fallbackId: 'wildlife.duck',
      fallback: createProceduralDuck
    });
  }

  function createProceduralHorse(horse) {
    const group = new window.THREE.Group();
    const position = worldToScene(horse.x, horse.y);
    group.position.set(position.x, 0, position.z);
    group.rotation.y = -(Number.isFinite(horse.heading) ? horse.heading : 0);
    if (horse.selected) addSelectionRing(group, 0.58);
    addSphere(group, 0, 0.4, 0, 0.44, state.materials.horse, { x: 0.66, y: 0.34, z: 0.34 });
    addSphere(group, 0.5, 0.58, 0, 0.2, state.materials.horse, { x: 0.25, y: 0.33, z: 0.21 });
    for (const [legX, legZ] of [[-0.27, -0.14], [-0.27, 0.14], [0.27, -0.14], [0.27, 0.14]]) {
      addBox(group, legX, 0.03, legZ, 0.065, 0.34, 0.065, state.materials.leather);
    }
    return group;
  }

  function createHorse(horse) {
    return OpenRTS.rendering.modelFactoryResolver.create(horse, {
      category: 'wildlife',
      fallbackId: 'wildlife.horse',
      fallback: createProceduralHorse
    });
  }

  function createProceduralWorldItem(item) {
    const group = new window.THREE.Group();
    const position = worldToScene(item.x, item.y);
    group.position.set(position.x, 0, position.z);
    if (item.selected) addSelectionRing(group, 0.34);
    addBox(group, 0, 0.03, 0, 0.34, 0.24, 0.28, state.materials.supply);
    addBox(group, 0, 0.27, 0, 0.38, 0.045, 0.32, state.materials.iron);
    addBox(group, 0, 0.1, 0, 0.055, 0.17, 0.3, state.materials.iron);
    return group;
  }

  function createWorldItem(item) {
    return OpenRTS.rendering.modelFactoryResolver.create(item, {
      category: 'item',
      fallbackId: item?.assetId || 'item.supply',
      fallback: createProceduralWorldItem
    });
  }

  function registerProceduralModelFactories() {
    const registry = OpenRTS.rendering.factoryRegistry;
    if (!registry || state.proceduralFactoriesRegistered) return;
    const registrations = [
      ['unit.king', createProceduralUnit],
      ['unit.worker', createProceduralUnit],
      ['unit.soldier', createProceduralUnit],
      ['unit.archer', createProceduralUnit],
      ['unit.knight', createProceduralUnit],
      ['unit.scout', createProceduralUnit],
      ['unit.gunman', createProceduralUnit],
      ['unit.crossbowman', createProceduralUnit],
      ['unit.grenademan', createProceduralUnit],
      ['unit.balloon', createProceduralUnit],
      ['unit.robot_walker', createProceduralUnit],
      ['unit.hover_tank', createProceduralUnit],
      ['wildlife.sheep', createProceduralSheep],
      ['wildlife.duck', createProceduralDuck],
      ['wildlife.horse', createProceduralHorse],
      ['building.castle', building => state.buildingModels.createCastle(building)],
      ['building.eok_town_center', building => state.buildingModels.createEraKingdomsTownCenter(building)],
      ['building.arrow_tower', building => state.buildingModels.createDefenseTower(building)],
      ['item.supply', createProceduralWorldItem]
    ];
    for (const [id, factory] of registrations) {
      if (!registry.has(id)) registry.register(id, source => factory(source), { renderer: 'three', kind: 'procedural' });
    }
    state.proceduralFactoriesRegistered = true;
  }

  function getDynamicRenderSources(fallbackUnits) {
    return OpenRTS.rendering.threeDomains?.getDynamicRenderSources
      ? OpenRTS.rendering.threeDomains.getDynamicRenderSources(fallbackUnits)
      : {
        units: fallbackUnits || [],
        sheep: Array.isArray(sheepData) ? sheepData : [],
        ducks: Array.isArray(duckData) ? duckData : [],
        horses: Array.isArray(horseData) ? horseData : [],
        items: Array.isArray(window.itemData) ? window.itemData : [],
        projectiles: OpenRTS.systems.projectiles.getProjectiles()
      };
  }

  function createSelectedObjectMarker(selectedObject) {
    if (!selectedObject || selectedObject.objectType !== 'obstacle') return null;
    const position = worldToScene(selectedObject.x, selectedObject.y);
    const marker = new window.THREE.Group();
    marker.position.set(position.x, 0, position.z);
    addSelectionRing(marker, selectedObject.obstacleType === OBSTACLE.TREE ? 0.78 : 0.64);
    return marker;
  }

  function createProjectileVisual(projectile) {
    return OpenRTS.rendering.projectileVisuals.createProjectileVisual(projectile, {
      THREE: window.THREE,
      worldToScene,
      addSphere,
      addBox,
      materials: state.materials
    });
  }

  function createImpactEffectVisual(effect) {
    return OpenRTS.rendering.projectileVisuals.createImpactEffectVisual(effect, {
      THREE: window.THREE,
      worldToScene,
      geometry,
      materials: state.materials,
      scale: SCALE
    });
  }

  function buildDynamicWorld(units) {
    const renderSources = getDynamicRenderSources(units);
    const dynamicCuller = OpenRTS.rendering.optimization.createWorldViewCuller({
      camera,
      viewportWidth: canvas.width,
      viewportHeight: canvas.height,
      overscan: tileSize * 8
    });
    const counts = OpenRTS.rendering.dynamicWorldComposer.compose({
      group: state.dynamicGroup,
      pool: state.dynamicPool,
      worldToScene: (x, y) => worldToScene(x, y),
      isVisible: (source, category) => dynamicCuller.isVisible(source, category === 'projectiles' || category === 'impactEffects' ? tileSize : tileSize * 2),
      sources: renderSources,
      roasts: OpenRTS.systems.cooking.getRoasts(),
      impactEffects: OpenRTS.systems.projectiles.getImpactEffects(),
      selectedObject: typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null,
      factories: {
        createUnit,
        createSheep,
        createRoast,
        createDuck,
        createHorse,
        createWorldItem,
        createSelectedObjectMarker,
        createProjectile: createProjectileVisual,
        createImpactEffect: createImpactEffectVisual
      }
    });
    state.lastDynamicCounts = counts || {};
    OpenRTS.diagnostics.performance?.increment?.('render.dynamic.created', counts?.created || 0);
    OpenRTS.diagnostics.performance?.increment?.('render.dynamic.reused', counts?.reused || 0);
    OpenRTS.diagnostics.performance?.increment?.('render.dynamic.removed', counts?.removed || 0);
    OpenRTS.diagnostics.performance?.increment?.('render.dynamic.culled', counts?.culled || 0);
    OpenRTS.diagnostics.performance?.setGauge?.('render.dynamic.poolSize', state.dynamicPool?.entries?.size || 0);
    OpenRTS.diagnostics.performance?.setGauge?.('render.dynamic.lastCulled', counts?.culled || 0);
    return counts;
  }

  function updateCameraMatrices() {
    OpenRTS.rendering.threeCameraSync.syncCamera({
      sceneCamera: state.camera,
      renderer: state.renderer,
      canvas: canvas3d,
      gameCamera: camera,
      scale: SCALE,
      mapWidth: getMapWidthPx(),
      mapHeight: getMapHeightPx()
    });
  }

  function updateTreeWind() {
    state.treeWindFrame = (state.treeWindFrame + 1) % 4;
    if (state.treeWindFrame !== 0) return;
    OpenRTS.rendering.treeWind.updateCrowns(state.treeCrowns, performance.now() * 0.001);
  }

  function render3DScene(units) {
    if (!init3DRenderer()) return false;
    const signature = staticWorldSignature();
    if (signature !== state.staticSignature) {
      OpenRTS.diagnostics.performance?.measure
        ? OpenRTS.diagnostics.performance.measure('render.static.rebuild', () => {
          buildStaticWorld();
          updateStaticChunks();
        })
        : (buildStaticWorld(), updateStaticChunks());
      OpenRTS.diagnostics.performance?.increment?.('render.static.rebuilds', 1);
      OpenRTS.diagnostics.performance?.setGauge?.('render.static.chunkCount', state.staticChunks.length);
      OpenRTS.diagnostics.performance?.setGauge?.('render.static.rockBatches', state.staticInstancingCounts.rockBatches || 0);
      OpenRTS.diagnostics.performance?.setGauge?.('render.static.rockInstances', state.staticInstancingCounts.rockInstances || 0);
      state.staticSignature = signature;
    }
    OpenRTS.diagnostics.performance?.measure
      ? OpenRTS.diagnostics.performance.measure('render.dynamic.compose', () => buildDynamicWorld(units))
      : buildDynamicWorld(units);
    updateTreeWind();
    updateCameraMatrices();
    updateStaticChunkVisibility();
    if (state.renderer.info?.render) {
      OpenRTS.diagnostics.performance?.setGauge?.('render.three.drawCalls', state.renderer.info.render.calls || 0);
      OpenRTS.diagnostics.performance?.setGauge?.('render.three.triangles', state.renderer.info.render.triangles || 0);
    }
    OpenRTS.diagnostics.performance?.measure
      ? OpenRTS.diagnostics.performance.measure('render.three.frame', () => state.renderer.render(state.scene, state.camera))
      : state.renderer.render(state.scene, state.camera);
    const health = OpenRTS.rendering.optimization.createRenderHealthReport({
      performance: OpenRTS.diagnostics.performance,
      frameBudget: state.frameBudget
    });
    OpenRTS.diagnostics.performance?.setGauge?.('render.health.ok', health.ok ? 1 : 0);
    OpenRTS.diagnostics.performance?.setGauge?.('render.health.warningCount', health.warnings.length);
    OpenRTS.rendering.threeOverlay.draw({
      ctx,
      canvas,
      units,
      buildings: getBuildings(),
      selectedObject: typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null,
      markers: typeof getCommandClickMarkers === 'function' ? getCommandClickMarkers() : [],
      projectWorld,
      towerType: BUILDING_TYPES.TOWER,
      treeType: OBSTACLE.TREE
    });
    return true;
  }

  function projectWorld(worldX, worldY, height = 0) {
    return OpenRTS.rendering.threeCoordinates.projectWorldToScreen(worldX, worldY, height, {
      THREE: window.THREE,
      camera: state.camera,
      canvas,
      scale: SCALE,
      mapWidth: getMapWidthPx(),
      mapHeight: getMapHeightPx()
    });
  }

  function is3DWorldPointVisible(worldX, worldY, height = 0) {
    const point = projectWorld(worldX, worldY, height);
    return !!point && point.x >= 0 && point.x <= canvas.width && point.y >= 0 && point.y <= canvas.height;
  }

  function get3DWorldPoint(screenX, screenY) {
    return OpenRTS.rendering.threeCoordinates.screenToWorld(screenX, screenY, {
      THREE: window.THREE,
      raycaster: state.raycaster,
      camera: state.camera,
      canvas,
      groundPlane: state.groundPlane,
      scale: SCALE,
      mapWidth: getMapWidthPx(),
      mapHeight: getMapHeightPx()
    });
  }

  function loadRTSModel(url) {
    if (!window.GLTFLoader) return Promise.reject(new Error('GLTFLoader is not available.'));
    return new Promise((resolve, reject) => {
      new window.GLTFLoader().load(url, gltf => {
        gltf.scene.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        resolve(gltf);
      }, undefined, reject);
    });
  }

  window.use3DRenderer = use3DRenderer;
  window.init3DRenderer = init3DRenderer;
  window.render3DScene = render3DScene;
  window.get3DWorldPoint = get3DWorldPoint;
  window.refresh3DCameraMatrices = updateCameraMatrices;
  window.is3DWorldPointVisible = is3DWorldPointVisible;
  window.loadRTSModel = loadRTSModel;

  return { use3DRenderer, init3DRenderer, render3DScene, get3DWorldPoint, is3DWorldPointVisible, loadRTSModel };
})();
