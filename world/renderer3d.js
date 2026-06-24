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
    unitAttachments: null,
    unitModels: null,
    terrainMeshes: null,
    buildingModels: null,
    proceduralFactoriesRegistered: false
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
      devicePixelRatio: window.devicePixelRatio || 1
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
    state.primitives = OpenRTS.rendering.meshPrimitives.createFactory({
      THREE,
      geometryCache: state.geometryCache
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
      rampartHeight: RAMPART_HEIGHT
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
      rampartHeight: RAMPART_HEIGHT,
      clamp,
      smoothStep
    });
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
    return state.terrainMeshes.createTerrainMeshes();
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
      geometry('tree-ground-shadow', () => new THREE.CircleGeometry(1, 32)),
      state.materials.treeShadow
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.018;
    shadow.scale.set(radiusX, radiusZ, 1);
    shadow.renderOrder = 1;
    parent.add(shadow);
  }

  function registerTreeCrown(crown, tileX, tileY, strength) {
    crown.userData.windPhase = hashNoise(tileX + 503, tileY + 907) * Math.PI * 2;
    crown.userData.windStrength = strength;
    crown.userData.baseRotationX = crown.rotation.x;
    crown.userData.baseRotationZ = crown.rotation.z;
    state.treeCrowns.push(crown);
  }

  function addOakTree(group, tileX, tileY, height) {
    const THREE = window.THREE;
    const trunkHeight = height * 0.62;
    addCylinder(group, 0, 0, 0, 0.105, 0.19, trunkHeight, state.materials.trunk, 12);

    const crown = new THREE.Group();
    const branchEnds = [
      { x: -0.55, y: height * 0.7, z: 0.18 },
      { x: 0.52, y: height * 0.73, z: -0.2 },
      { x: -0.18, y: height * 0.9, z: -0.42 },
      { x: 0.22, y: height * 0.94, z: 0.4 }
    ];
    for (let i = 0; i < branchEnds.length; i++) {
      addBranchBetween(group, { x: 0, y: trunkHeight * (0.62 + i * 0.07), z: 0 }, branchEnds[i], 0.065 - i * 0.006);
    }

    const cardGeometry = geometry('tree:oak-foliage-card', () => new THREE.PlaneGeometry(1, 1));
    const cardCount = 7;
    for (let i = 0; i < cardCount; i++) {
      const angle = i / cardCount * Math.PI * 2 + hashNoise(tileX + i * 19, tileY + 61) * 0.45;
      const radial = i < 3 ? 0.28 : 0.5;
      const card = new THREE.Mesh(cardGeometry, i % 3 === 0 ? state.materials.oakFoliageShade : state.materials.oakFoliage);
      card.position.set(
        Math.cos(angle) * radial,
        height * (0.72 + hashNoise(tileX + i * 7, tileY + 97) * 0.2),
        Math.sin(angle) * radial
      );
      const width = 1.05 + hashNoise(tileX + i * 31, tileY + 13) * 0.42;
      card.scale.set(width, width * (0.82 + hashNoise(tileX + 43, tileY + i) * 0.18), 1);
      card.rotation.y = angle + Math.PI * 0.5;
      card.rotation.z = (hashNoise(tileX + i, tileY + 211) - 0.5) * 0.2;
      card.castShadow = true;
      crown.add(card);
    }
    group.add(crown);
    registerTreeCrown(crown, tileX, tileY, 0.018);
  }

  function addPineTree(group, tileX, tileY, height) {
    const THREE = window.THREE;
    const trunkHeight = height * 0.92;
    const leanX = (hashNoise(tileX + 307, tileY + 181) - 0.5) * 0.22;
    const leanZ = (hashNoise(tileX + 409, tileY + 263) - 0.5) * 0.16;
    let previous = { x: 0, y: 0, z: 0 };
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const current = { x: leanX * t * t, y: trunkHeight * t, z: leanZ * t * t };
      addBranchBetween(group, previous, current, 0.12 - t * 0.045, state.materials.trunk, 8);
      previous = current;
    }

    const crown = new THREE.Group();
    const branchGeometry = geometry('tree:pine-bough', () => new THREE.ConeGeometry(1, 0.34, 9));
    const layers = 9;
    for (let i = 0; i < layers; i++) {
      const progress = i / (layers - 1);
      const yPos = height * (0.24 + progress * 0.63);
      const radius = 0.92 - progress * 0.62 + hashNoise(tileX + i * 23, tileY + 47) * 0.09;
      const branchCount = i < 2 ? 7 : i < 6 ? 6 : 5;
      for (let branch = 0; branch < branchCount; branch++) {
        const angle = branch / branchCount * Math.PI * 2 + hashNoise(tileX + i * 37, tileY + branch * 19) * 0.28;
        const bough = new THREE.Mesh(
          branchGeometry,
          (i + branch) % 3 === 0 ? state.materials.foliageLight : state.materials.foliage
        );
        const length = radius * (0.72 + hashNoise(tileX + branch * 17, tileY + i * 11) * 0.34);
        bough.scale.set(0.16 + radius * 0.12, 0.18 + radius * 0.08, length);
        bough.position.set(
          leanX * progress * 0.75 + Math.cos(angle) * radius * 0.24,
          yPos + (hashNoise(tileX + branch, tileY + i) - 0.5) * 0.08,
          leanZ * progress * 0.75 + Math.sin(angle) * radius * 0.24
        );
        bough.rotation.set(Math.PI * 0.5 + 0.18, angle, -0.22 - progress * 0.16);
        bough.castShadow = true;
        crown.add(bough);
      }
    }
    const tip = new THREE.Mesh(
      geometry('tree:pine-tip', () => new THREE.ConeGeometry(0.32, 0.72, 9)),
      state.materials.foliageLight
    );
    tip.position.set(leanX, height * 0.94, leanZ);
    tip.rotation.z = -leanX * 0.22;
    tip.castShadow = true;
    crown.add(tip);
    group.add(crown);
    registerTreeCrown(crown, tileX, tileY, 0.014);
  }

  function palmFrondGeometry() {
    const THREE = window.THREE;
    const positions = new Float32Array([
      0, 0, 0,
      0.28, 0.04, -0.2,
      0.28, 0.04, 0.2,
      0.72, -0.04, -0.18,
      0.72, -0.04, 0.18,
      1.24, -0.34, 0
    ]);
    const geometryValue = new THREE.BufferGeometry();
    geometryValue.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometryValue.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
    geometryValue.computeVertexNormals();
    return geometryValue;
  }

  function addPalmTree(group, tileX, tileY, height) {
    const THREE = window.THREE;
    const trunkHeight = height * 0.86;
    const leanX = (hashNoise(tileX + 307, tileY + 109) - 0.5) * 0.38;
    const leanZ = (hashNoise(tileX + 401, tileY + 157) - 0.5) * 0.24;
    const segments = 9;
    let previous = { x: 0, y: 0, z: 0 };
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const current = {
        x: leanX * t * t,
        y: trunkHeight * t,
        z: leanZ * t * t
      };
      const radius = 0.16 - t * 0.07;
      addBranchBetween(group, previous, current, Math.max(0.055, radius), state.materials.trunk, 9);

      const ring = addCylinder(group, current.x, current.y - 0.035, current.z, radius * 1.08, radius * 1.14, 0.035, state.materials.wood, 10);
      ring.rotation.x = (hashNoise(tileX + i, tileY + 5) - 0.5) * 0.18;
      ring.rotation.z = (hashNoise(tileX + 9, tileY + i) - 0.5) * 0.18;
      previous = current;
    }

    const crown = new THREE.Group();
    crown.position.set(previous.x, trunkHeight, previous.z);
    crown.rotation.z = leanX * 0.12;
    const frondGeometry = geometry('tree:palm-frond', palmFrondGeometry);
    const frondCount = 15;
    for (let i = 0; i < frondCount; i++) {
      const angle = i / frondCount * Math.PI * 2 + hashNoise(tileX + i * 17, tileY + 313) * 0.22;
      const frond = new THREE.Mesh(frondGeometry, i % 3 === 0 ? state.materials.foliageLight : state.materials.foliage);
      frond.rotation.y = -angle;
      frond.rotation.z = -0.18 - hashNoise(tileX + i * 19, tileY + 7) * 0.28;
      frond.scale.set(
        1.0 + hashNoise(tileX + i * 41, tileY + 5) * 0.42,
        1,
        0.9 + hashNoise(tileX + 11, tileY + i) * 0.34
      );
      frond.castShadow = true;
      crown.add(frond);
      const end = {
        x: Math.cos(angle) * frond.scale.x,
        y: -0.22 - hashNoise(tileX + i, tileY + 41) * 0.18,
        z: -Math.sin(angle) * frond.scale.x
      };
      addBranchBetween(crown, { x: 0, y: 0, z: 0 }, end, 0.018, state.materials.trunk, 6);
    }
    addSphere(crown, 0, 0.02, 0, 0.24, state.materials.foliage, { x: 0.28, y: 0.2, z: 0.28 });
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2 + hashNoise(tileX + 71, tileY + 89);
      addSphere(
        crown,
        Math.cos(angle) * 0.15,
        -0.13 - hashNoise(tileX + i, tileY + 23) * 0.08,
        Math.sin(angle) * 0.13,
        0.065,
        state.materials.trunk,
        { x: 0.85, y: 0.7, z: 0.75 }
      );
    }
    group.add(crown);
    registerTreeCrown(crown, tileX, tileY, 0.026);
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
    const kind = Math.floor(hashNoise(tileX + 83, tileY + 29) * 3);
    const height = 2.25 + hashNoise(tileX + 17, tileY + 41) * 0.85;
    const widthScale = 0.9 + hashNoise(tileX + 971, tileY + 593) * 0.24;
    group.scale.x = widthScale;
    group.scale.z = 0.92 + hashNoise(tileX + 641, tileY + 733) * 0.2;
    addTreeGroundShadow(group, kind === 0 ? 0.72 : 0.88, kind === 0 ? 0.5 : 0.62);

    if (kind === 0) addPineTree(group, tileX, tileY, height);
    else if (kind === 1) addOakTree(group, tileX, tileY, height);
    else addPalmTree(group, tileX, tileY, height);
    return group;
  }

  function createRock(tileX, tileY) {
    const THREE = window.THREE;
    const center = tileCenter(tileX, tileY);
    const position = worldToScene(center.x, center.y);
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    const count = 4 + Math.floor(hashNoise(tileX + 11, tileY + 71) * 7);
    for (let i = 0; i < count; i++) {
      const angle = hashNoise(tileX + i * 31, tileY + 97) * Math.PI * 2;
      const radius = hashNoise(tileX + i * 17, tileY + 59) * 0.48;
      const size = 0.25 + hashNoise(tileX + i * 13, tileY + 7) * 0.32;
      const rock = new THREE.Mesh(
        geometry('rock:dodecahedron', () => new THREE.DodecahedronGeometry(1, 0)),
        state.materials.rock
      );
      rock.scale.set(size * 1.25, size * (0.72 + hashNoise(i, tileX) * 0.5), size);
      rock.rotation.set(hashNoise(i, tileY) * 0.4, angle, hashNoise(tileX, i) * 0.35);
      addMesh(group, rock, Math.cos(angle) * radius, size * 0.38, Math.sin(angle) * radius);
    }
    return group;
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

    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + hashNoise(mine.tileX + i * 17, mine.tileY) * 0.38;
      const radius = 0.18 + hashNoise(mine.tileX + i * 23, mine.tileY + 7) * 1.02;
      const size = 0.28 + hashNoise(mine.tileX + i * 11, mine.tileY + 13) * 0.36;
      const rock = new THREE.Mesh(
        geometry('rock:dodecahedron', () => new THREE.DodecahedronGeometry(1, 0)),
        i % 3 === 0 ? state.materials.gold : state.materials.rock
      );
      rock.scale.set(size * 1.32, size * 0.78, size * 1.08);
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
      ['wildlife.sheep', createProceduralSheep],
      ['wildlife.duck', createProceduralDuck],
      ['wildlife.horse', createProceduralHorse],
      ['building.castle', createProceduralCastle],
      ['building.arrow_tower', createProceduralDefenseTower],
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
    return OpenRTS.rendering.dynamicWorldComposer.compose({
      group: state.dynamicGroup,
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
    OpenRTS.rendering.treeWind.updateCrowns(state.treeCrowns, performance.now() * 0.001);
  }

  function render3DScene(units) {
    if (!init3DRenderer()) return false;
    const signature = staticWorldSignature();
    if (signature !== state.staticSignature) {
      buildStaticWorld();
      state.staticSignature = signature;
    }
    buildDynamicWorld(units);
    updateTreeWind();
    updateCameraMatrices();
    state.renderer.render(state.scene, state.camera);
    OpenRTS.rendering.threeOverlay.draw({
      ctx,
      canvas,
      units,
      buildings: getBuildings(),
      selectedObject: typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null,
      markers: typeof getCommandClickMarkers === 'function' ? getCommandClickMarkers() : [],
      projectWorld,
      towerType: BUILDING_TYPES.TOWER,
      treeType: OBSTACLE.TREE,
      rampartHeight: RAMPART_HEIGHT
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
