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
    treeSpriteMaterials: null,
    rockSpriteMaterials: null,
    entitySpriteMaterials: null
  };

  function use3DRenderer() {
    return false;
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

  function drawTreeBlob(context, x, y, radiusX, radiusY, colors, rotation = 0) {
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
    context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    context.fill();
  }

  function drawSpriteShadow(context, x, y, radiusX, radiusY) {
    const shadow = context.createRadialGradient(x, y, 2, x, y, radiusX);
    shadow.addColorStop(0, 'rgba(20, 14, 7, 0.34)');
    shadow.addColorStop(0.62, 'rgba(20, 14, 7, 0.16)');
    shadow.addColorStop(1, 'rgba(20, 14, 7, 0)');
    context.fillStyle = shadow;
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
  }

  function strokeTaperedBranch(context, points, width, colors) {
    for (let i = 0; i < Math.max(1, Math.floor(width)); i++) {
      const t = i / Math.max(1, width);
      context.strokeStyle = t < 0.42 ? colors.light : colors.dark;
      context.lineWidth = Math.max(1, width - i * 0.82);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(points[0].x + i * 0.24, points[0].y);
      for (let p = 1; p < points.length; p++) {
        const prev = points[p - 1];
        const point = points[p];
        context.quadraticCurveTo(prev.x, prev.y, point.x, point.y);
      }
      context.stroke();
    }
  }

  function drawLeafSpeckles(context, seedX, seedY, bounds, colors, count) {
    for (let i = 0; i < count; i++) {
      const n1 = hashNoise(seedX + i * 17, seedY + i * 31);
      const n2 = hashNoise(seedX + i * 43, seedY + i * 11);
      const x = bounds.x + n1 * bounds.width;
      const y = bounds.y + n2 * bounds.height;
      const radius = 1.3 + hashNoise(seedX + i * 7, seedY + i * 19) * 2.4;
      context.fillStyle = i % 3 === 0 ? colors.light : i % 3 === 1 ? colors.mid : colors.dark;
      context.globalAlpha = 0.16 + hashNoise(seedX + i * 13, seedY + i * 23) * 0.24;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawIrregularCanopy(context, centerX, centerY, radiusX, radiusY, colors, seed) {
    const gradient = context.createRadialGradient(
      centerX - radiusX * 0.28,
      centerY - radiusY * 0.38,
      Math.max(5, radiusX * 0.12),
      centerX,
      centerY,
      Math.max(radiusX, radiusY) * 1.08
    );
    gradient.addColorStop(0, colors.highlight);
    gradient.addColorStop(0.36, colors.mid);
    gradient.addColorStop(0.78, colors.shadow);
    gradient.addColorStop(1, colors.edge);

    const points = [];
    const pointCount = 28;
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const wobble = 0.82 + hashNoise(seed + i * 19, seed + i * 37) * 0.34;
      points.push({
        x: centerX + Math.cos(angle) * radiusX * wobble,
        y: centerY + Math.sin(angle) * radiusY * wobble
      });
    }

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < pointCount; i++) {
      const current = points[i];
      const next = points[(i + 1) % pointCount];
      context.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
    }
    context.closePath();
    context.fill();

    context.strokeStyle = 'rgba(20, 48, 23, 0.18)';
    context.lineWidth = 2.5;
    context.stroke();
  }

  function drawPaintedOakSprite(context) {
    drawSpriteShadow(context, 128, 300, 62, 15);

    const bark = { light: '#9a683d', dark: '#4b2d1a' };
    strokeTaperedBranch(context, [
      { x: 128, y: 292 },
      { x: 124, y: 230 },
      { x: 130, y: 170 }
    ], 20, bark);
    strokeTaperedBranch(context, [
      { x: 128, y: 220 },
      { x: 96, y: 186 },
      { x: 78, y: 145 }
    ], 8, bark);
    strokeTaperedBranch(context, [
      { x: 129, y: 212 },
      { x: 162, y: 181 },
      { x: 184, y: 136 }
    ], 9, bark);
    strokeTaperedBranch(context, [
      { x: 128, y: 188 },
      { x: 120, y: 154 },
      { x: 126, y: 118 }
    ], 7, bark);

    const colors = {
      highlight: '#bfd27a',
      mid: '#557f3d',
      shadow: '#234c2d',
      edge: 'rgba(22, 47, 24, 0)',
      light: '#d5e384',
      dark: '#1d4228'
    };
    drawIrregularCanopy(context, 126, 135, 84, 76, colors, 211);
    drawIrregularCanopy(context, 104, 175, 70, 58, colors, 337);
    drawIrregularCanopy(context, 158, 174, 66, 56, colors, 463);

    context.globalCompositeOperation = 'multiply';
    context.fillStyle = 'rgba(31, 61, 29, 0.2)';
    context.beginPath();
    context.ellipse(140, 190, 74, 36, -0.08, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';

    drawLeafSpeckles(context, 151, 263, { x: 42, y: 54, width: 170, height: 174 }, colors, 170);
  }

  function drawPaintedPineSprite(context) {
    drawSpriteShadow(context, 128, 302, 54, 13);
    const bark = { light: '#8e5a32', dark: '#462817' };
    strokeTaperedBranch(context, [
      { x: 128, y: 296 },
      { x: 126, y: 190 },
      { x: 131, y: 56 }
    ], 14, bark);

    const palette = [
      { fill: '#173d27', ridge: 'rgba(202, 223, 142, 0.2)' },
      { fill: '#215631', ridge: 'rgba(186, 216, 126, 0.18)' },
      { fill: '#102f20', ridge: 'rgba(153, 190, 112, 0.16)' }
    ];
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const y = 72 + t * 178;
      const width = 32 + (1 - t) * 74;
      const height = 26 - t * 6;
      const x = 128 + (hashNoise(300 + i * 17, 700 + i * 11) - 0.5) * 10;
      const color = palette[i % palette.length];
      context.fillStyle = color.fill;
      context.beginPath();
      context.moveTo(x, y - height);
      context.bezierCurveTo(x - width * 0.28, y - height * 0.26, x - width * 0.66, y + height * 0.2, x - width * 0.58, y + height);
      context.quadraticCurveTo(x - width * 0.18, y + height * 0.62, x, y + height * 0.5);
      context.quadraticCurveTo(x + width * 0.24, y + height * 0.74, x + width * 0.6, y + height);
      context.bezierCurveTo(x + width * 0.68, y + height * 0.18, x + width * 0.28, y - height * 0.28, x, y - height);
      context.closePath();
      context.fill();

      context.strokeStyle = color.ridge;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - width * 0.34, y + height * 0.1);
      context.lineTo(x + width * 0.28, y - height * 0.28);
      context.stroke();
    }
  }

  function drawPaintedPalmSprite(context) {
    drawSpriteShadow(context, 118, 304, 48, 13);
    const bark = { light: '#aa7138', dark: '#5a351c' };
    strokeTaperedBranch(context, [
      { x: 118, y: 296 },
      { x: 137, y: 205 },
      { x: 126, y: 104 }
    ], 17, bark);

    context.strokeStyle = 'rgba(60, 34, 16, 0.36)';
    context.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = 282 - i * 14;
      context.beginPath();
      context.moveTo(112 + i * 1.5, y);
      context.lineTo(130 + i * 0.8, y - 5);
      context.stroke();
    }

    const top = { x: 126, y: 103 };
    for (let i = 0; i < 13; i++) {
      const angle = -Math.PI * 1.08 + (i / 12) * Math.PI * 1.86;
      const length = 54 + hashNoise(901 + i * 23, 311 + i * 37) * 42;
      const end = {
        x: top.x + Math.cos(angle) * length,
        y: top.y + Math.sin(angle) * length * (0.56 + hashNoise(77 + i, 99 + i) * 0.28) + 12
      };
      const mid = {
        x: top.x + Math.cos(angle) * length * 0.48,
        y: top.y + Math.sin(angle) * length * 0.26 - 14
      };
      context.strokeStyle = i % 3 === 0 ? '#2d7638' : i % 3 === 1 ? '#4d9850' : '#225f34';
      context.lineWidth = 10 - Math.abs(i - 6) * 0.32;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(top.x, top.y);
      context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
      context.stroke();

      context.strokeStyle = 'rgba(220, 232, 139, 0.24)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(top.x + (end.x - top.x) * 0.28, top.y + (end.y - top.y) * 0.28);
      context.lineTo(top.x + (end.x - top.x) * 0.72, top.y + (end.y - top.y) * 0.72);
      context.stroke();
    }

    context.fillStyle = '#6b421f';
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * 0.5 + 0.3;
      context.beginPath();
      context.arc(top.x + Math.cos(angle) * 7, top.y + 7 + Math.sin(angle) * 4, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function createTreeSpriteTexture(kind = 'oak') {
    const THREE = window.THREE;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = 320;
    const context = textureCanvas.getContext('2d');

    context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (kind === 'pine') drawPaintedPineSprite(context);
    else if (kind === 'palm') drawPaintedPalmSprite(context);
    else drawPaintedOakSprite(context);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
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
    addTreeSprite(group, 'oak', height, 2.55 + hashNoise(tileX + 31, tileY + 43) * 0.34);
  }

  function addPineTree(group, tileX, tileY, height) {
    addTreeSprite(group, 'pine', height, 2.12 + hashNoise(tileX + 37, tileY + 47) * 0.28);
  }

  function addPalmTree(group, tileX, tileY, height) {
    addTreeSprite(group, 'palm', height, 2.42 + hashNoise(tileX + 41, tileY + 53) * 0.34);
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
    else kind = roll < 0.62 ? 1 : roll < 0.92 ? 0 : 2;
    const styleHeightBoost = style === 'fantasy_forest' ? 0.48 : style === 'temperate_kingdom' ? 0.28 : 0;
    const height = 3.15 + styleHeightBoost + hashNoise(tileX + 17, tileY + 41) * 1.15;
    const widthScale = 0.96 + hashNoise(tileX + 971, tileY + 593) * 0.24;
    group.scale.x = widthScale;
    group.scale.z = 0.92 + hashNoise(tileX + 641, tileY + 733) * 0.2;
    addTreeGroundShadow(group, kind === 0 ? 0.9 : 1.08, kind === 0 ? 0.58 : 0.72);

    if (kind === 0) addPineTree(group, tileX, tileY, height);
    else if (kind === 1) addOakTree(group, tileX, tileY, height);
    else addPalmTree(group, tileX, tileY, height);
    return group;
  }

  function rockArtProfile() {
    const style = visualStyle();
    if (style === 'alien_crystal') {
      return {
        key: 'crystal',
        base: '#4fbfe2',
        mid: '#8ee9ff',
        shadow: '#17607a',
        dark: '#0c3546',
        highlight: '#d8fbff',
        glow: 'rgba(93, 222, 255, 0.22)'
      };
    }
    if (style === 'desert_raid' || style === 'industrial_desert' || style === 'arabia_dryland') {
      return {
        key: 'sandstone',
        base: '#a98255',
        mid: '#c8a16b',
        shadow: '#725334',
        dark: '#4f3825',
        highlight: '#ead29d',
        glow: 'rgba(120, 82, 39, 0.08)'
      };
    }
    if (style === 'metal_wasteland') {
      return {
        key: 'metal',
        base: '#5d6870',
        mid: '#7c8992',
        shadow: '#333b42',
        dark: '#20262b',
        highlight: '#b6c0c5',
        glow: 'rgba(84, 122, 140, 0.1)'
      };
    }
    if (style === 'volcanic_lava') {
      return {
        key: 'basalt',
        base: '#424649',
        mid: '#5b6062',
        shadow: '#202426',
        dark: '#111415',
        highlight: '#8e9291',
        glow: 'rgba(255, 95, 35, 0.12)'
      };
    }
    return {
      key: 'granite',
      base: '#74736a',
      mid: '#969287',
      shadow: '#4d4c45',
      dark: '#302f2b',
      highlight: '#d1c9b5',
      glow: 'rgba(52, 44, 32, 0.08)'
    };
  }

  function drawRockPolygon(context, centerX, centerY, radiusX, radiusY, profile, seed, options = {}) {
    const pointCount = options.points || 9;
    const points = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2 + (options.rotation || 0);
      const wobble = 0.72 + hashNoise(seed + i * 17, seed + i * 41) * 0.48;
      points.push({
        x: centerX + Math.cos(angle) * radiusX * wobble,
        y: centerY + Math.sin(angle) * radiusY * wobble
      });
    }

    const gradient = context.createLinearGradient(centerX - radiusX, centerY - radiusY, centerX + radiusX * 0.7, centerY + radiusY);
    gradient.addColorStop(0, profile.highlight);
    gradient.addColorStop(0.24, profile.mid);
    gradient.addColorStop(0.72, profile.base);
    gradient.addColorStop(1, profile.shadow);

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fill();

    context.strokeStyle = 'rgba(28, 24, 20, 0.34)';
    context.lineWidth = Math.max(1, radiusX * 0.055);
    context.stroke();

    context.fillStyle = 'rgba(255, 249, 220, 0.2)';
    context.beginPath();
    context.ellipse(centerX - radiusX * 0.28, centerY - radiusY * 0.38, radiusX * 0.34, radiusY * 0.15, -0.46, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(28, 25, 21, 0.28)';
    context.lineWidth = Math.max(1, radiusX * 0.035);
    context.beginPath();
    context.moveTo(centerX - radiusX * 0.22, centerY - radiusY * 0.05);
    context.lineTo(centerX + radiusX * 0.1, centerY + radiusY * 0.26);
    context.lineTo(centerX + radiusX * 0.38, centerY + radiusY * 0.02);
    context.stroke();
  }

  function createRockSpriteTexture(profile = rockArtProfile(), variant = 0) {
    const THREE = window.THREE;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 320;
    textureCanvas.height = 220;
    const context = textureCanvas.getContext('2d');
    context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);

    const shadow = context.createRadialGradient(160, 176, 8, 160, 176, 132);
    shadow.addColorStop(0, 'rgba(17, 12, 7, 0.34)');
    shadow.addColorStop(0.64, 'rgba(17, 12, 7, 0.16)');
    shadow.addColorStop(1, 'rgba(17, 12, 7, 0)');
    context.fillStyle = shadow;
    context.beginPath();
    context.ellipse(160, 176, 132, 34, 0, 0, Math.PI * 2);
    context.fill();

    if (profile.glow) {
      context.fillStyle = profile.glow;
      context.beginPath();
      context.ellipse(162, 154, 112, 56, 0, 0, Math.PI * 2);
      context.fill();
    }

    const outcropRoll = hashNoise(701 + variant * 19, 809 + variant * 23);
    const count = profile.key === 'crystal'
      ? 9
      : outcropRoll > 0.68 ? 19 : outcropRoll > 0.34 ? 14 : 9;
    const goldenAngle = 2.399963229728653;
    const rocks = [];
    for (let i = 0; i < count; i++) {
      const ring = Math.sqrt((i + 0.5) / count);
      const angle = i * goldenAngle + hashNoise(variant + 97, i + 17) * Math.PI * 0.7;
      const x = 160 + Math.cos(angle) * ring * (42 + outcropRoll * 54) + (hashNoise(i + 11, variant + 31) - 0.5) * 18;
      const y = 150 + Math.sin(angle) * ring * (18 + outcropRoll * 24) + (hashNoise(i + 37, variant + 43) - 0.5) * 12;
      const anchor = i < 3 ? 1.35 : 1;
      rocks.push({
        x,
        y,
        rx: (18 + hashNoise(i + 211, variant + 31) * 19) * anchor,
        ry: (12 + hashNoise(i + 43, variant + 307) * 14) * anchor,
        seed: variant * 1000 + i * 89,
        rotation: hashNoise(i + 509, variant + 19) * Math.PI * 2
      });
    }

    rocks.sort((a, b) => a.y - b.y);
    for (const rock of rocks) {
      if (profile.key === 'crystal') {
        drawRockPolygon(context, rock.x, rock.y - rock.ry * 0.55, rock.rx * 0.62, rock.ry * 1.8, profile, rock.seed, { points: 6, rotation: rock.rotation });
      } else {
        drawRockPolygon(context, rock.x, rock.y, rock.rx, rock.ry, profile, rock.seed, { points: 9, rotation: rock.rotation });
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  function getRockSpriteMaterial(profile = rockArtProfile(), variant = 0) {
    const THREE = window.THREE;
    if (!state.rockSpriteMaterials) state.rockSpriteMaterials = new Map();
    const key = `${profile.key}:${variant % 3}`;
    if (state.rockSpriteMaterials.has(key)) return state.rockSpriteMaterials.get(key);
    const material = new THREE.SpriteMaterial({
      map: createRockSpriteTexture(profile, variant % 3),
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.03
    });
    state.rockSpriteMaterials.set(key, material);
    return material;
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
    const jitterX = (hashNoise(tileX + 151, tileY + 263) - 0.5) * 0.18;
    const jitterZ = (hashNoise(tileX + 379, tileY + 443) - 0.5) * 0.18;
    group.position.set(position.x + jitterX, 0, position.z + jitterZ);
    group.rotation.y = hashNoise(tileX + 719, tileY + 827) * Math.PI * 2;

    const profile = rockArtProfile();
    const variant = Math.floor(hashNoise(tileX + 11, tileY + 71) * 3);
    const sprite = new THREE.Sprite(getRockSpriteMaterial(profile, variant));
    const outcropRoll = hashNoise(tileX + 149, tileY + 251);
    const width = 1.5 + Math.pow(outcropRoll, 0.7) * 2.35;
    const height = 0.82 + Math.pow(outcropRoll, 0.62) * 1.1;
    sprite.position.set(0, height * 0.42, 0);
    sprite.scale.set(width, height, 1);
    sprite.renderOrder = 1.8;
    sprite.userData.category = 'rock';
    group.userData.category = 'rock';
    group.add(sprite);
    return group;
  }

  function createRockInstanceBatches() {
    state.staticInstancingCounts = {
      ...(state.staticInstancingCounts || {}),
      rockBatches: 0,
      rockInstances: 0
    };
    return null;
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

  function createEntitySpriteCanvas(width = 192, height = 192) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function setupEntitySpriteContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
  }

  function spriteEllipse(ctx, x, y, rx, ry, fill, stroke = null, lineWidth = 2) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function spriteStroke(ctx, x1, y1, x2, y2, color, width = 5) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function spriteRoundedRect(ctx, x, y, width, height, radius, fill, stroke = null) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawEntitySkeletonSprite(ctx, kind = 'animal') {
    setupEntitySpriteContext(ctx);
    spriteStroke(ctx, 46, 124, 132, 124, '#ddd3b6', 8);
    for (let i = 0; i < 6; i++) spriteStroke(ctx, 58 + i * 12, 115, 52 + i * 12, 144, '#ddd3b6', 4);
    spriteEllipse(ctx, kind === 'duck' ? 126 : 139, 116, kind === 'duck' ? 10 : 16, kind === 'duck' ? 8 : 12, '#ddd3b6', '#8b8068', 2);
  }

  function drawSheepSprite(ctx, source) {
    if (source?.isDead) return drawEntitySkeletonSprite(ctx, 'sheep');
    setupEntitySpriteContext(ctx);
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const x = 88 + Math.cos(angle) * (28 + (i % 3) * 5);
      const y = 104 + Math.sin(angle) * (16 + (i % 4) * 3);
      spriteEllipse(ctx, x, y, 18, 15, i % 2 ? '#f3eddc' : '#ded6c4', 'rgba(93,83,67,0.22)', 1);
    }
    spriteEllipse(ctx, 105, 104, 46, 27, '#e9e2cf', '#6b6253', 3);
    spriteEllipse(ctx, 146, 91, 17, 19, '#4c4039', '#241d1a', 3);
    for (const x of [68, 87, 108, 129]) spriteStroke(ctx, x, 128, x, 161, '#4c4039', 6);
  }

  function drawDuckSprite(ctx, source) {
    if (source?.isDead) return drawEntitySkeletonSprite(ctx, 'duck');
    setupEntitySpriteContext(ctx);
    spriteEllipse(ctx, 88, 112, 39, 24, '#d5b246', '#6a5720', 3);
    spriteEllipse(ctx, 122, 91, 19, 18, '#d0a638', '#6a5720', 3);
    spriteRoundedRect(ctx, 138, 88, 25, 10, 5, '#d9822d');
    spriteEllipse(ctx, 126, 86, 2.5, 2.5, '#15120b');
    spriteStroke(ctx, 75, 132, 67, 155, '#ca7c2d', 5);
    spriteStroke(ctx, 100, 132, 107, 155, '#ca7c2d', 5);
  }

  function drawHorseSprite(ctx) {
    setupEntitySpriteContext(ctx);
    spriteEllipse(ctx, 88, 109, 50, 27, '#7a5336', '#402a1c', 3);
    spriteEllipse(ctx, 137, 83, 20, 26, '#7a5336', '#402a1c', 3);
    spriteStroke(ctx, 64, 131, 56, 166, '#4a3022', 8);
    spriteStroke(ctx, 84, 133, 85, 166, '#4a3022', 8);
    spriteStroke(ctx, 111, 133, 116, 166, '#4a3022', 8);
    spriteStroke(ctx, 131, 129, 143, 162, '#4a3022', 8);
    spriteStroke(ctx, 43, 100, 30, 84, '#382418', 5);
    spriteEllipse(ctx, 144, 76, 3, 3, '#17100c');
  }

  function drawWorldItemSprite(ctx) {
    setupEntitySpriteContext(ctx);
    spriteRoundedRect(ctx, 55, 76, 82, 72, 10, '#9b7443', '#49351f');
    spriteRoundedRect(ctx, 49, 68, 94, 16, 5, '#c7c3aa', '#6d6958');
    spriteStroke(ctx, 96, 72, 96, 145, '#5f5a4a', 5);
    spriteStroke(ctx, 58, 104, 132, 104, 'rgba(65,47,31,0.35)', 3);
  }

  function getEntitySpriteMaterial(kind, source = {}) {
    if (!state.entitySpriteMaterials) state.entitySpriteMaterials = new Map();
    const key = [
      kind,
      source.isDead ? 'dead' : 'alive',
      source.selected ? 'selected' : '',
      source.variant || '',
      source.assetId || ''
    ].join('|');
    if (state.entitySpriteMaterials.has(key)) return state.entitySpriteMaterials.get(key);
    const THREE = window.THREE;
    const canvas = createEntitySpriteCanvas();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (kind === 'sheep') drawSheepSprite(ctx, source);
    else if (kind === 'duck') drawDuckSprite(ctx, source);
    else if (kind === 'horse') drawHorseSprite(ctx, source);
    else drawWorldItemSprite(ctx, source);
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false
    });
    material.userData = { billboardSprite: true, kind };
    state.entitySpriteMaterials.set(key, material);
    return material;
  }

  function createBillboardEntity(source, kind, options = {}) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const position = worldToScene(source.x, source.y);
    const elevation = typeof getWorldElevation === 'function' ? getWorldElevation(source.x, source.y) : 0;
    group.position.set(position.x, elevation + (options.yOffset || 0), position.z);
    if (source.selected) addSelectionRing(group, options.selectionRadius || 0.42);
    const sprite = new THREE.Sprite(getEntitySpriteMaterial(kind, source));
    if (sprite.center?.set) sprite.center.set(0.5, 0);
    sprite.position.set(0, 0.02, 0);
    const heading = Number.isFinite(source.heading) ? source.heading : 0;
    const facingLeft = Math.cos(heading) < 0;
    const width = options.width || 0.76;
    sprite.scale.set(facingLeft ? -width : width, options.height || 0.92, 1);
    sprite.renderOrder = 6;
    sprite.userData = { billboardSprite: true, entityType: kind };
    group.add(sprite);
    return group;
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
    return createBillboardEntity(sheep, 'sheep', {
      width: sheep.isDead ? 0.74 : 0.86,
      height: sheep.isDead ? 0.56 : 0.86,
      selectionRadius: 0.48
    });
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
    return createBillboardEntity(duck, 'duck', {
      width: duck.isDead ? 0.46 : 0.56,
      height: duck.isDead ? 0.36 : 0.52,
      selectionRadius: 0.32
    });
  }

  function createDuck(duck) {
    return OpenRTS.rendering.modelFactoryResolver.create(duck, {
      category: 'wildlife',
      fallbackId: 'wildlife.duck',
      fallback: createProceduralDuck
    });
  }

  function createProceduralHorse(horse) {
    return createBillboardEntity(horse, 'horse', {
      width: 1.04,
      height: 0.94,
      selectionRadius: 0.58
    });
  }

  function createHorse(horse) {
    return OpenRTS.rendering.modelFactoryResolver.create(horse, {
      category: 'wildlife',
      fallbackId: 'wildlife.horse',
      fallback: createProceduralHorse
    });
  }

  function createProceduralWorldItem(item) {
    return createBillboardEntity(item, 'item', {
      width: 0.62,
      height: 0.62,
      selectionRadius: 0.34
    });
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
