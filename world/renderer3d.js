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
    geometry: new Map(),
    raycaster: null,
    groundPlane: null,
    treeCrowns: [],
    staticSignature: '',
    initialized: false,
    threeUnavailableWarned: false
  };

  function use3DRenderer() {
    return true;
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

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas3d,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(canvas3d.clientWidth || canvas3d.width, canvas3d.clientHeight || canvas3d.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8aa5a0);
    scene.fog = new THREE.FogExp2(0x91aaa4, 0.0095);

    const sceneCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    sceneCamera.up.set(0, 1, 0);

    const hemisphere = new THREE.HemisphereLight(0xdbe8f0, 0x39452d, 1.55);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe3b2, 3.4);
    sun.position.set(-28, 42, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    scene.add(sun.target);

    const staticGroup = new THREE.Group();
    staticGroup.name = 'static-world';
    const dynamicGroup = new THREE.Group();
    dynamicGroup.name = 'dynamic-entities';
    scene.add(staticGroup, dynamicGroup);

    state.renderer = renderer;
    state.scene = scene;
    state.camera = sceneCamera;
    state.staticGroup = staticGroup;
    state.dynamicGroup = dynamicGroup;
    state.materials = createMaterials();
    state.raycaster = new THREE.Raycaster();
    state.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
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
    if (!state.geometry.has(key)) state.geometry.set(key, factory());
    return state.geometry.get(key);
  }

  function addMesh(parent, mesh, x, y, z, castShadow = true, receiveShadow = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    return mesh;
  }

  function addBox(parent, x, y, z, width, height, depth, material) {
    const THREE = window.THREE;
    const key = `box:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
    const mesh = new THREE.Mesh(geometry(key, () => new THREE.BoxGeometry(width, height, depth)), material);
    return addMesh(parent, mesh, x, y + height * 0.5, z);
  }

  function addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments = 16) {
    const THREE = window.THREE;
    const key = `cyl:${radiusTop}:${radiusBottom}:${height}:${segments}`;
    const mesh = new THREE.Mesh(
      geometry(key, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)),
      material
    );
    return addMesh(parent, mesh, x, y + height * 0.5, z);
  }

  function addSphere(parent, x, y, z, radius, material, scale = null) {
    const THREE = window.THREE;
    const mesh = new THREE.Mesh(
      geometry('sphere:16:10', () => new THREE.SphereGeometry(1, 16, 10)),
      material
    );
    mesh.scale.set(scale?.x || radius, scale?.y || radius, scale?.z || radius);
    return addMesh(parent, mesh, x, y, z);
  }

  function addLongbow(parent, riderY = 0) {
    const THREE = window.THREE;
    const bowGroup = new THREE.Group();
    bowGroup.position.y = riderY;

    const bow = new THREE.Mesh(
      geometry('weapon:longbow', () => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.2, 1.08, 0.18),
          new THREE.Vector3(0.35, 0.84, 0.18),
          new THREE.Vector3(0.42, 0.55, 0.18),
          new THREE.Vector3(0.35, 0.27, 0.18),
          new THREE.Vector3(0.2, 0.03, 0.18)
        ], false, 'centripetal');
        return new THREE.TubeGeometry(curve, 20, 0.026, 7, false);
      }),
      state.materials.wood
    );
    bow.castShadow = true;
    bow.receiveShadow = true;
    bowGroup.add(bow);

    addCylinder(bowGroup, 0.2, 0.03, 0.18, 0.006, 0.006, 1.05, state.materials.bone, 5);
    addCylinder(bowGroup, 0.4, 0.47, 0.18, 0.043, 0.043, 0.16, state.materials.leather, 8);
    parent.add(bowGroup);
    return bowGroup;
  }

  function addPistol(parent, riderY = 0) {
    addBox(parent, 0.29, 0.53 + riderY, 0.13, 0.42, 0.09, 0.1, state.materials.iron);
    const grip = addBox(parent, 0.13, 0.38 + riderY, 0.13, 0.1, 0.2, 0.09, state.materials.leather);
    grip.rotation.z = -0.2;
    addCylinder(parent, 0.51, 0.555 + riderY, 0.13, 0.035, 0.035, 0.08, state.materials.iron, 10).rotation.z = Math.PI * 0.5;
  }

  function addCrossbow(parent, riderY = 0) {
    const THREE = window.THREE;
    const crossbowGroup = new THREE.Group();
    crossbowGroup.position.y = riderY;
    addBox(crossbowGroup, 0.28, 0.47, 0, 0.58, 0.08, 0.1, state.materials.wood);

    const limbs = new THREE.Mesh(
      geometry('weapon:crossbow-limbs', () => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.5, 0.55, -0.4),
          new THREE.Vector3(0.59, 0.55, -0.2),
          new THREE.Vector3(0.62, 0.55, 0),
          new THREE.Vector3(0.59, 0.55, 0.2),
          new THREE.Vector3(0.5, 0.55, 0.4)
        ], false, 'centripetal');
        return new THREE.TubeGeometry(curve, 18, 0.024, 7, false);
      }),
      state.materials.wood
    );
    limbs.castShadow = true;
    crossbowGroup.add(limbs);
    addBox(crossbowGroup, 0.5, 0.54, 0, 0.025, 0.025, 0.8, state.materials.bone);
    addBox(crossbowGroup, 0.45, 0.56, 0, 0.46, 0.025, 0.025, state.materials.steel);
    parent.add(crossbowGroup);
  }

  function addGrenadeWeapon(parent, riderY = 0) {
    addSphere(parent, 0.32, 0.58 + riderY, 0.15, 0.13, state.materials.grenade);
    const fuse = addCylinder(parent, 0.32, 0.69 + riderY, 0.15, 0.018, 0.018, 0.11, state.materials.wood, 6);
    fuse.rotation.z = -0.35;
  }

  function addCarriedObject(parent, unit, riderY = 0) {
    const item = unit.inventoryItem;
    if (!item) return;

    if (item.carryType === 'obstacle' && item.obstacleType === OBSTACLE.TREE) {
      const trunk = addCylinder(parent, 0, 1.02 + riderY, -0.08, 0.07, 0.1, 0.92, state.materials.trunk, 8);
      trunk.rotation.z = Math.PI * 0.5;
      addSphere(parent, -0.43, 1.08 + riderY, -0.08, 0.27, state.materials.foliage, { x: 0.34, y: 0.3, z: 0.3 });
      addSphere(parent, -0.58, 1.1 + riderY, -0.05, 0.2, state.materials.foliageLight);
      return;
    }

    if (item.carryType === 'obstacle' && item.obstacleType === OBSTACLE.ROCK) {
      const rock = new window.THREE.Mesh(
        geometry('carried:rock', () => new window.THREE.DodecahedronGeometry(1, 0)),
        state.materials.rock
      );
      rock.scale.set(0.28, 0.22, 0.25);
      rock.rotation.set(0.2, 0.45, -0.15);
      addMesh(parent, rock, 0.05, 1.12 + riderY, 0);
      return;
    }

    addBox(parent, 0, 0.92 + riderY, -0.12, 0.32, 0.2, 0.24, state.materials.supply);
  }

  function worldToScene(worldX, worldY) {
    return {
      x: (worldX - getMapWidthPx() * 0.5) * SCALE,
      z: (worldY - getMapHeightPx() * 0.5) * SCALE
    };
  }

  function sceneToWorld(point) {
    return {
      x: point.x / SCALE + getMapWidthPx() * 0.5,
      y: point.z / SCALE + getMapHeightPx() * 0.5
    };
  }

  function terrainSample(x, y) {
    const thresholds = mapConfig.terrain || {};
    const waterEdge = thresholds.water ?? 0.28;
    const sandEdge = thresholds.sand ?? waterEdge + 0.07;
    const heightNoise = fbmNoise(x, y);
    const shoreNoise = (smoothValueNoise(x + 229, y + 541, 3.4) - 0.5) * 0.018;
    const beachNoise = (smoothValueNoise(x + 811, y + 131, 1.8) - 0.5) * 0.012;
    const waterBlend = smoothStep(waterEdge - 0.012, waterEdge + 0.018, heightNoise + shoreNoise);
    const grassBlend = smoothStep(sandEdge - 0.02, sandEdge + 0.035, heightNoise + beachNoise);
    return { heightNoise, waterBlend, grassBlend, isWater: waterBlend < 0.5 };
  }

  function smoothStep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
    return t * t * (3 - 2 * t);
  }

  function terrainHeight(x, y, sample) {
    const broad = smoothValueNoise(x + 17, y + 43, 8) - 0.5;
    const fine = smoothValueNoise(x + 71, y + 19, 2.5) - 0.5;
    const landHeight = (broad * 0.78 + fine * 0.22) * 0.15;
    const shoreBlend = smoothStep(0.28, 0.72, sample.waterBlend);
    return -0.06 + (landHeight + 0.06) * shoreBlend;
  }

  function terrainColor(x, y, sample) {
    const THREE = window.THREE;
    const broad = smoothValueNoise(x + 37, y + 61, 5) - 0.5;
    const fine = hashNoise(Math.floor(x * 11) + 101, Math.floor(y * 11) + 409) - 0.5;
    const shade = broad * 0.15 + fine * 0.06;
    const water = new THREE.Color(0.08 + shade * 0.2, 0.34 + shade * 0.35, 0.52 + shade * 0.45);
    const sand = new THREE.Color(0.72 + shade, 0.62 + shade * 0.82, 0.34 + shade * 0.5);
    const meadow = smoothValueNoise(x + 503, y + 211, 2.8);
    const grass = new THREE.Color(0.11 + shade * 0.35, 0.34 + shade * 0.65 + meadow * 0.1, 0.12 + shade * 0.3);
    const beach = sand.clone().lerp(grass, sample.grassBlend);
    return water.lerp(beach, sample.waterBlend);
  }

  function createTerrainMeshes() {
    const THREE = window.THREE;
    const positions = [];
    const colors = [];
    const subdivisions = 8;

    function pushVertex(px, py, pz, color) {
      positions.push(px, py, pz);
      colors.push(color.r, color.g, color.b);
    }

    for (let tileY = 0; tileY < MAP_ROWS; tileY++) {
      for (let tileX = 0; tileX < MAP_COLS; tileX++) {
        for (let sy = 0; sy < subdivisions; sy++) {
          for (let sx = 0; sx < subdivisions; sx++) {
            const x0 = tileX + sx / subdivisions;
            const x1 = tileX + (sx + 1) / subdivisions;
            const z0 = tileY + sy / subdivisions;
            const z1 = tileY + (sy + 1) / subdivisions;
            const samples = [terrainSample(x0, z0), terrainSample(x1, z0), terrainSample(x0, z1), terrainSample(x1, z1)];
            const points = [
              [x0 - MAP_COLS * 0.5, terrainHeight(x0, z0, samples[0]), z0 - MAP_ROWS * 0.5],
              [x1 - MAP_COLS * 0.5, terrainHeight(x1, z0, samples[1]), z0 - MAP_ROWS * 0.5],
              [x0 - MAP_COLS * 0.5, terrainHeight(x0, z1, samples[2]), z1 - MAP_ROWS * 0.5],
              [x1 - MAP_COLS * 0.5, terrainHeight(x1, z1, samples[3]), z1 - MAP_ROWS * 0.5]
            ];
            const tileColors = [terrainColor(x0, z0, samples[0]), terrainColor(x1, z0, samples[1]), terrainColor(x0, z1, samples[2]), terrainColor(x1, z1, samples[3])];
            for (const index of [0, 2, 1, 1, 2, 3]) pushVertex(...points[index], tileColors[index]);

          }
        }
      }
    }

    const terrainGeometry = new THREE.BufferGeometry();
    terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeometry, state.materials.ground);
    terrain.receiveShadow = true;

    return [terrain];
  }

  function addBattlements(parent, axis, centerX, centerZ, length, wallThickness, height, material, skipCenter = false, skipHalfWidth = 0.8) {
    const count = Math.max(4, Math.round(length / 0.58));
    const merlonW = Math.min(0.38, length / count * 0.62);
    for (let i = 0; i < count; i++) {
      const offset = -length * 0.5 + (i + 0.5) * (length / count);
      if (skipCenter && Math.abs(offset) < skipHalfWidth) continue;
      if (axis === 'x') {
        addBox(parent, centerX + offset, height, centerZ - wallThickness * 0.42, merlonW, 0.34, 0.22, material);
        addBox(parent, centerX + offset, height, centerZ + wallThickness * 0.42, merlonW, 0.34, 0.22, material);
      } else {
        addBox(parent, centerX - wallThickness * 0.42, height, centerZ + offset, 0.22, 0.34, merlonW, material);
        addBox(parent, centerX + wallThickness * 0.42, height, centerZ + offset, 0.22, 0.34, merlonW, material);
      }
    }
  }

  function addArrowSlit(parent, x, y, z, face) {
    const THREE = window.THREE;
    const slit = new THREE.Mesh(
      geometry('slit', () => new THREE.PlaneGeometry(0.07, 0.33)),
      state.materials.slit
    );
    slit.position.set(x, y, z);
    if (face === 'front') slit.rotation.y = 0;
    if (face === 'back') slit.rotation.y = Math.PI;
    if (face === 'left') slit.rotation.y = Math.PI * 0.5;
    if (face === 'right') slit.rotation.y = -Math.PI * 0.5;
    parent.add(slit);
  }

  function createCastle(building) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const position = worldToScene(building.x, building.y);
    group.position.set(position.x, 0, position.z);

    const outerW = building.width * 0.9;
    const outerD = building.height * 0.86;
    const wallT = 0.92;
    const wallH = RAMPART_HEIGHT;
    const halfW = outerW * 0.5;
    const halfD = outerD * 0.5;
    const gateW = 3.05;
    const frontSegment = (outerW - gateW) * 0.5;
    const frontOffset = gateW * 0.5 + frontSegment * 0.5;

    addBox(group, 0, 0.02, 0, outerW - wallT * 1.25, 0.08, outerD - wallT * 1.25, state.materials.courtyard);
    addBox(group, 0, 0, -halfD, outerW, wallH, wallT, state.materials.stone);
    addBox(group, -halfW, 0, 0, wallT, wallH, outerD, state.materials.stone);
    addBox(group, halfW, 0, 0, wallT, wallH, outerD, state.materials.stone);
    addBox(group, -frontOffset, 0, halfD, frontSegment, wallH, wallT, state.materials.stone);
    addBox(group, frontOffset, 0, halfD, frontSegment, wallH, wallT, state.materials.stone);

    addBox(group, 0, wallH, -halfD, outerW, 0.09, wallT + 0.08, state.materials.stoneLight);
    addBox(group, -halfW, wallH, 0, wallT + 0.08, 0.09, outerD, state.materials.stoneLight);
    addBox(group, halfW, wallH, 0, wallT + 0.08, 0.09, outerD, state.materials.stoneLight);
    addBox(group, -frontOffset, wallH, halfD, frontSegment, 0.09, wallT + 0.08, state.materials.stoneLight);
    addBox(group, frontOffset, wallH, halfD, frontSegment, 0.09, wallT + 0.08, state.materials.stoneLight);

    addBattlements(group, 'x', 0, -halfD, outerW, wallT, wallH + 0.09, state.materials.stone);
    addBattlements(group, 'z', -halfW, 0, outerD, wallT, wallH + 0.09, state.materials.stone);
    addBattlements(group, 'z', halfW, 0, outerD, wallT, wallH + 0.09, state.materials.stone);
    addBattlements(group, 'x', 0, halfD, outerW, wallT, wallH + 0.09, state.materials.stone, true, gateW * 0.56);

    const towerRadius = 0.72;
    const towerHeight = 1.65;
    const towers = [[-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD]];
    for (const [towerX, towerZ] of towers) {
      addCylinder(group, towerX, 0, towerZ, towerRadius * 0.94, towerRadius, towerHeight, state.materials.stoneDark, 20);
      addCylinder(group, towerX, towerHeight, towerZ, towerRadius * 1.04, towerRadius * 1.04, 0.1, state.materials.stoneLight, 20);
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * Math.PI * 2;
        addBox(
          group,
          towerX + Math.cos(angle) * towerRadius * 0.82,
          towerHeight + 0.1,
          towerZ + Math.sin(angle) * towerRadius * 0.82,
          0.26,
          0.36,
          0.26,
          state.materials.stone
        ).rotation.y = -angle;
      }
    }

    // The taller keep and gatehouse create a believable defensive hierarchy.
    const keepW = outerW * 0.34;
    const keepD = 1.28;
    addBox(group, 0, 0.04, -halfD + wallT * 1.25, keepW, 2.15, keepD, state.materials.stoneDark);
    addBox(group, 0, 2.19, -halfD + wallT * 1.25, keepW + 0.08, 0.1, keepD + 0.08, state.materials.stoneLight);
    addBattlements(group, 'x', 0, -halfD + wallT * 1.25, keepW, keepD, 2.29, state.materials.stone);
    addBattlements(group, 'z', -keepW * 0.5, -halfD + wallT * 1.25, keepD, keepW, 2.29, state.materials.stone);
    addBattlements(group, 'z', keepW * 0.5, -halfD + wallT * 1.25, keepD, keepW, 2.29, state.materials.stone);

    const gatehouseZ = halfD + wallT * 0.15;
    const gatePillarW = 0.62;
    const gatehouseH = 1.88;
    const openingShoulderY = 0.82;
    addBox(group, -(gateW + gatePillarW) * 0.5, 0, gatehouseZ, gatePillarW, gatehouseH, 0.82, state.materials.stoneDark);
    addBox(group, (gateW + gatePillarW) * 0.5, 0, gatehouseZ, gatePillarW, gatehouseH, 0.82, state.materials.stoneDark);
    addBox(group, 0, 1.48, gatehouseZ, gateW + gatePillarW * 2, 0.4, 0.82, state.materials.stoneDark);
    addBox(group, 0, gatehouseH, gatehouseZ, gateW + gatePillarW * 2 + 0.12, 0.1, 0.9, state.materials.stoneLight);
    addBattlements(group, 'x', 0, gatehouseZ, gateW + gatePillarW * 2, 0.9, gatehouseH + 0.1, state.materials.stone);

    // Individual voussoirs form a real arch while leaving the doorway empty.
    const archRadiusX = gateW * 0.5 + 0.02;
    const archRadiusY = 0.7;
    for (let i = 0; i < 11; i++) {
      const angle = i / 10 * Math.PI;
      const stone = addBox(
        group,
        Math.cos(angle) * archRadiusX,
        openingShoulderY + Math.sin(angle) * archRadiusY,
        gatehouseZ + 0.43,
        0.38,
        0.26,
        0.18,
        i === 5 ? state.materials.stoneLight : state.materials.stone
      );
      stone.rotation.z = angle - Math.PI * 0.5;
    }

    for (const slitX of [-outerW * 0.28, 0, outerW * 0.28]) addArrowSlit(group, slitX, 0.7, -halfD - wallT * 0.505, 'front');
    for (const side of [-1, 1]) {
      addArrowSlit(group, side * (halfW + wallT * 0.505), 0.7, -outerD * 0.18, side < 0 ? 'left' : 'right');
      addArrowSlit(group, side * (halfW + wallT * 0.505), 0.7, outerD * 0.12, side < 0 ? 'left' : 'right');
    }

    const stairCount = 12;
    const stairBaseX = 1.0;
    const stairTopX = halfW - wallT * 0.18;
    const stairZ = 1.0;
    const stairWidth = (stairTopX - stairBaseX) / (stairCount - 1) + 0.04;
    for (let step = 0; step < stairCount; step++) {
      const progress = step / (stairCount - 1);
      addBox(
        group,
        stairBaseX + (stairTopX - stairBaseX) * progress,
        0.04,
        stairZ,
        stairWidth,
        0.1 + wallH * progress,
        1.08,
        state.materials.stoneLight
      );
    }
    const railLength = Math.hypot(stairTopX - stairBaseX, wallH) + 0.2;
    const railCenterX = (stairBaseX + stairTopX) * 0.5;
    const railAngle = Math.atan2(wallH, stairTopX - stairBaseX);
    addBox(group, railCenterX, wallH * 0.5, stairZ - 0.52, railLength, 0.13, 0.12, state.materials.stoneDark).rotation.z = railAngle;
    addBox(group, railCenterX, wallH * 0.5, stairZ + 0.52, railLength, 0.13, 0.12, state.materials.stoneDark).rotation.z = railAngle;

    const flagMaterial = building.team === 'red' ? state.materials.red : state.materials.blue;
    addCylinder(group, halfW * 0.45, towerHeight + 0.04, -halfD, 0.025, 0.025, 1.1, state.materials.wood, 8);
    addBox(group, halfW * 0.45 + 0.23, towerHeight + 0.72, -halfD, 0.46, 0.25, 0.035, flagMaterial);
    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }

  function createDefenseTower(building) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const position = worldToScene(building.x, building.y);
    group.position.set(position.x, 0, position.z);
    addCylinder(group, 0, 0, 0, 0.62, 0.76, 2.3, state.materials.stone, 20);
    addCylinder(group, 0, 2.3, 0, 0.82, 0.82, 0.12, state.materials.stoneLight, 20);
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2;
      addBox(group, Math.cos(angle) * 0.68, 2.42, Math.sin(angle) * 0.68, 0.27, 0.38, 0.27, state.materials.stone).rotation.y = -angle;
    }
    for (const y of [0.72, 1.35]) addArrowSlit(group, 0, y, 0.765, 'front');
    const flagMaterial = building.team === 'red' ? state.materials.red : state.materials.blue;
    addCylinder(group, 0.15, 2.42, 0, 0.025, 0.025, 0.9, state.materials.wood, 8);
    addBox(group, 0.38, 3.0, 0, 0.44, 0.23, 0.035, flagMaterial);
    return group;
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
    addCylinder(group, 0, 0, 0, 0.07, 0.15, height * 0.9, state.materials.trunk, 11);
    const crown = new THREE.Group();
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const progress = i / (layers - 1);
      const radius = 0.84 - progress * 0.55 + hashNoise(tileX + i * 23, tileY + 47) * 0.08;
      const layer = new THREE.Mesh(
        geometry(`tree:pine-layer:${i}`, () => new THREE.ConeGeometry(1, 1, 10)),
        i % 2 ? state.materials.foliage : state.materials.foliageLight
      );
      layer.scale.set(radius, height * (0.22 - progress * 0.04), radius * (0.9 + hashNoise(tileX + 17, tileY + i) * 0.18));
      layer.position.set(
        (hashNoise(tileX + i * 37, tileY + 71) - 0.5) * 0.12,
        height * (0.32 + progress * 0.12),
        (hashNoise(tileX + 89, tileY + i * 29) - 0.5) * 0.12
      );
      layer.rotation.y = hashNoise(tileX + i, tileY + 131) * Math.PI;
      layer.castShadow = true;
      crown.add(layer);
    }
    crown.add(new THREE.Mesh(
      geometry('tree:pine-tip', () => new THREE.ConeGeometry(0.32, 0.72, 9)),
      state.materials.foliageLight
    ));
    crown.children[crown.children.length - 1].position.y = height * 0.91;
    crown.children[crown.children.length - 1].castShadow = true;
    group.add(crown);
    registerTreeCrown(crown, tileX, tileY, 0.009);
  }

  function palmFrondGeometry() {
    const THREE = window.THREE;
    const positions = new Float32Array([
      0, 0, 0,
      0.28, 0.04, -0.18,
      0.28, 0.04, 0.18,
      0.72, -0.03, -0.15,
      0.72, -0.03, 0.15,
      1.12, -0.25, 0
    ]);
    const geometryValue = new THREE.BufferGeometry();
    geometryValue.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometryValue.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
    geometryValue.computeVertexNormals();
    return geometryValue;
  }

  function addPalmTree(group, tileX, tileY, height) {
    const THREE = window.THREE;
    const trunkHeight = height * 0.82;
    const trunk = addCylinder(group, 0, 0, 0, 0.09, 0.16, trunkHeight, state.materials.trunk, 12);
    trunk.rotation.z = (hashNoise(tileX + 307, tileY + 109) - 0.5) * 0.08;

    const crown = new THREE.Group();
    crown.position.y = trunkHeight;
    const frondGeometry = geometry('tree:palm-frond', palmFrondGeometry);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2 + hashNoise(tileX + i * 17, tileY + 313) * 0.18;
      const frond = new THREE.Mesh(frondGeometry, i % 3 === 0 ? state.materials.foliageLight : state.materials.foliage);
      frond.rotation.y = -angle;
      frond.scale.set(0.9 + hashNoise(tileX + i * 41, tileY + 5) * 0.28, 1, 0.85 + hashNoise(tileX + 11, tileY + i) * 0.25);
      frond.castShadow = true;
      crown.add(frond);
      const end = {
        x: Math.cos(angle) * frond.scale.x,
        y: -0.16,
        z: -Math.sin(angle) * frond.scale.x
      };
      addBranchBetween(crown, { x: 0, y: 0, z: 0 }, end, 0.022, state.materials.trunk, 6);
    }
    addSphere(crown, 0, 0.02, 0, 0.22, state.materials.foliage, { x: 0.28, y: 0.2, z: 0.28 });
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

  function buildStaticWorld() {
    state.staticGroup.clear();
    state.treeCrowns = [];
    state.staticGroup.add(...createTerrainMeshes());

    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (obstacleData[y][x] === OBSTACLE.TREE) state.staticGroup.add(createTree(x, y));
        if (obstacleData[y][x] === OBSTACLE.ROCK) state.staticGroup.add(createRock(x, y));
      }
    }
    for (const building of getBuildings()) {
      if (building.isDead) continue;
      state.staticGroup.add(building.type === BUILDING_TYPES.HOME ? createCastle(building) : createDefenseTower(building));
    }
  }

  function staticWorldSignature() {
    const buildings = getBuildings().map(building => `${building.id}:${building.isDead ? 1 : 0}:${building.upgradeLevel || 0}`).join(',');
    const obstacles = typeof getObstacleRevision === 'function' ? getObstacleRevision() : 0;
    return `${MAP_SEED}:${MAP_COLS}:${MAP_ROWS}:${buildings}:${obstacles}:${JSON.stringify({
      terrainPreset: mapConfig?.terrainPreset || '',
      terrain: mapConfig?.terrain || {},
      waterPercent: mapConfig?.waterPercent,
      rockCount: mapConfig?.rockCount,
      treeCount: mapConfig?.treeCount
    })}`;
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

  function createUnit(unit) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const position = worldToScene(unit.x, unit.y);
    const elevation = getUnitCastleElevation(unit);
    group.position.set(position.x, elevation, position.z);
    group.rotation.y = -(Number.isFinite(unit.heading) ? unit.heading : 0);
    if (unit.isDead) {
      addBox(group, 0, 0.04, 0, 0.55, 0.06, 0.12, state.materials.bone);
      addSphere(group, 0.33, 0.1, 0, 0.13, state.materials.bone);
      return group;
    }
    if (unit.selected) addSelectionRing(group, 0.46);

    const teamMaterial = unit.team === 'red' ? state.materials.red : state.materials.blue;
    const type = unit.unitType || 'soldier';
    const stride = unit.hasActivePath?.() ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 0.07 : 0;
    const mountedSheep = unit.mountType === 'sheep';
    const mountedHorse = type === 'scout' && !mountedSheep;
    let riderY = 0;
    if (mountedSheep) {
      addSphere(group, 0, 0.34, 0, 0.38, state.materials.sheep, { x: 0.52, y: 0.3, z: 0.3 });
      addSphere(group, 0.42, 0.4, 0, 0.16, state.materials.sheepFace);
      riderY = 0.42;
    } else if (mountedHorse) {
      addSphere(group, 0, 0.38, 0, 0.42, state.materials.horse, { x: 0.62, y: 0.32, z: 0.31 });
      addSphere(group, 0.48, 0.55, 0, 0.18, state.materials.horse, { x: 0.23, y: 0.31, z: 0.2 });
      for (const [legX, legZ, legStep] of [
        [-0.27, -0.14, stride],
        [-0.27, 0.14, -stride],
        [0.27, -0.14, -stride],
        [0.27, 0.14, stride]
      ]) {
        addBox(group, legX, 0.03, legZ + legStep, 0.065, 0.34, 0.065, state.materials.leather);
        addBox(group, legX + 0.035, 0.015, legZ + legStep, 0.12, 0.045, 0.08, state.materials.iron);
      }
      riderY = 0.5;
    }

    addBox(group, -0.09, 0.04 + riderY, -stride, 0.09, 0.28, 0.09, state.materials.leather);
    addBox(group, 0.09, 0.04 + riderY, stride, 0.09, 0.28, 0.09, state.materials.leather);
    addCylinder(group, 0, 0.28 + riderY, 0, type === 'knight' ? 0.22 : 0.18, type === 'knight' ? 0.24 : 0.2, type === 'knight' ? 0.62 : 0.52, teamMaterial, 12);
    addSphere(group, 0, 0.93 + riderY, 0, 0.14, state.materials.skin);
    if (type === 'king') {
      addCylinder(group, 0, 1.02 + riderY, 0, 0.17, 0.17, 0.11, state.materials.gold, 12);
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2;
        const point = new THREE.Mesh(
          geometry('unit:king-crown-point', () => new THREE.ConeGeometry(0.055, 0.2, 6)),
          state.materials.gold
        );
        point.position.set(Math.cos(angle) * 0.13, 1.19 + riderY, Math.sin(angle) * 0.13);
        point.castShadow = true;
        group.add(point);
      }
    }
    if (type === 'knight') {
      addCylinder(group, 0, 0.89 + riderY, 0, 0.15, 0.17, 0.17, state.materials.steel, 12);
      addCylinder(group, -0.25, 0.45 + riderY, 0, 0.18, 0.18, 0.05, state.materials.steel, 16).rotation.z = Math.PI * 0.5;
    }
    if (type === 'archer') {
      addLongbow(group, riderY);
    } else if (type === 'gunman') {
      addPistol(group, riderY);
    } else if (type === 'crossbowman') {
      addCrossbow(group, riderY);
    } else if (type === 'grenademan') {
      addGrenadeWeapon(group, riderY);
    } else {
      const swing = (unit.attackAnimationTime || 0) > 0 ? -0.8 : 0.2;
      const sword = addBox(group, 0.29, 0.48 + riderY, 0, 0.055, 0.68, 0.045, state.materials.steel);
      sword.rotation.z = swing;
      addBox(group, 0.25, 0.46 + riderY, 0, 0.24, 0.05, 0.08, state.materials.wood).rotation.z = swing;
    }
    addCarriedObject(group, unit, riderY);
    return group;
  }

  function getUnitCastleElevation(unit) {
    if (!unit.castleTopBuildingId) return 0;
    if (unit.castleRampClimbed || unit.castleTopReached) return RAMPART_HEIGHT + 0.1;
    if (!unit.castleRampBase || !unit.castleRampTop) return 0;

    const rampX = unit.castleRampTop.x - unit.castleRampBase.x;
    const rampY = unit.castleRampTop.y - unit.castleRampBase.y;
    const rampLengthSquared = rampX * rampX + rampY * rampY;
    if (rampLengthSquared <= 0) return 0;
    const progress = clamp(
      ((unit.x - unit.castleRampBase.x) * rampX + (unit.y - unit.castleRampBase.y) * rampY) / rampLengthSquared,
      0,
      1
    );
    return smoothStep(0.04, 0.96, progress) * (RAMPART_HEIGHT + 0.1);
  }

  function createSheep(sheep) {
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

  function createDuck(duck) {
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

  function createHorse(horse) {
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

  function createWorldItem(item) {
    const group = new window.THREE.Group();
    const position = worldToScene(item.x, item.y);
    group.position.set(position.x, 0, position.z);
    if (item.selected) addSelectionRing(group, 0.34);
    addBox(group, 0, 0.03, 0, 0.34, 0.24, 0.28, state.materials.supply);
    addBox(group, 0, 0.27, 0, 0.38, 0.045, 0.32, state.materials.iron);
    addBox(group, 0, 0.1, 0, 0.055, 0.17, 0.3, state.materials.iron);
    return group;
  }

  function buildDynamicWorld(units) {
    state.dynamicGroup.clear();
    for (const unit of units) state.dynamicGroup.add(createUnit(unit));
    for (const sheep of sheepData) if (!sheep.isMounted) state.dynamicGroup.add(createSheep(sheep));
    for (const roast of OpenRTS.systems.cooking.getRoasts()) state.dynamicGroup.add(createRoast(roast));
    if (Array.isArray(duckData)) for (const duck of duckData) state.dynamicGroup.add(createDuck(duck));
    if (Array.isArray(horseData)) for (const horse of horseData) if (!horse.isDead) state.dynamicGroup.add(createHorse(horse));
    if (Array.isArray(window.itemData)) {
      for (const item of window.itemData) {
        if (!item.isDead && !item.isPickedUp) state.dynamicGroup.add(createWorldItem(item));
      }
    }
    const selectedObject = typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null;
    if (selectedObject && selectedObject.objectType === 'obstacle') {
      const position = worldToScene(selectedObject.x, selectedObject.y);
      const marker = new window.THREE.Group();
      marker.position.set(position.x, 0, position.z);
      addSelectionRing(marker, selectedObject.obstacleType === OBSTACLE.TREE ? 0.78 : 0.64);
      state.dynamicGroup.add(marker);
    }
    for (const bullet of OpenRTS.systems.projectiles.getProjectiles()) {
      if (bullet.dead) continue;
      const position = worldToScene(bullet.x, bullet.y);
      if (bullet.projectileType === 'grenade') {
        const progress = Math.min(1, bullet.distanceTraveled / Math.max(1, bullet.targetDistance));
        const arcHeight = Math.sin(progress * Math.PI) * 0.9;
        addSphere(state.dynamicGroup, position.x, 0.3 + arcHeight, position.z, 0.1, state.materials.grenade);
      } else if (bullet.projectileType === 'bolt') {
        const bolt = new window.THREE.Group();
        bolt.position.set(position.x, 0.4, position.z);
        bolt.rotation.y = -Math.atan2(bullet.dirY, bullet.dirX);
        addBox(bolt, 0, 0, 0, 0.3, 0.035, 0.035, state.materials.bolt);
        state.dynamicGroup.add(bolt);
      } else {
        const material = bullet.projectileType === 'bullet' ? state.materials.pistolRound : state.materials.projectile;
        const radius = bullet.projectileType === 'bullet' ? 0.045 : 0.08;
        addSphere(state.dynamicGroup, position.x, 0.35, position.z, radius, material);
      }
    }
    const impactEffects = OpenRTS.systems.projectiles.getImpactEffects();
    if (Array.isArray(impactEffects)) {
      for (const effect of impactEffects) {
        if (effect.type !== 'explosion') continue;
        const position = worldToScene(effect.x, effect.y);
        const progress = Math.min(1, effect.age / effect.duration);
        const radius = Math.max(0.08, effect.radius * SCALE * progress);
        const ring = new window.THREE.Mesh(
          geometry('ring:explosion', () => new window.THREE.RingGeometry(0.82, 1, 32)),
          state.materials.explosion
        );
        ring.position.set(position.x, 0.08, position.z);
        ring.rotation.x = -Math.PI * 0.5;
        ring.scale.setScalar(radius);
        state.dynamicGroup.add(ring);
      }
    }
  }

  function updateCameraMatrices() {
    if (!state.camera || !state.renderer) return;
    const width = canvas3d.clientWidth || canvas3d.width;
    const heightPx = canvas3d.clientHeight || canvas3d.height;
    if (canvas3d.width !== Math.round(width * state.renderer.getPixelRatio()) || canvas3d.height !== Math.round(heightPx * state.renderer.getPixelRatio())) {
      state.renderer.setSize(width, heightPx, false);
    }
    state.camera.aspect = Math.max(1, width) / Math.max(1, heightPx);
    const centerWorldX = camera.x + camera.viewportWidth / camera.zoom * 0.5;
    const centerWorldY = camera.y + camera.viewportHeight / camera.zoom * 0.5;
    const target = worldToScene(centerWorldX, centerWorldY);
    const zoomForView = Math.max(camera.minZoom3D || 0.22, camera.zoom);
    const cameraHeight = 25 / zoomForView;
    const distance = 20 / zoomForView;
    state.camera.position.set(target.x, cameraHeight, target.z + distance);
    state.camera.lookAt(target.x, 0, target.z);
    state.camera.updateProjectionMatrix();
    state.camera.updateMatrixWorld();
  }

  function updateTreeWind() {
    const time = performance.now() * 0.001;
    for (const crown of state.treeCrowns) {
      const phase = crown.userData.windPhase || 0;
      const strength = crown.userData.windStrength || 0;
      crown.rotation.z = crown.userData.baseRotationZ + Math.sin(time * 0.72 + phase) * strength;
      crown.rotation.x = crown.userData.baseRotationX + Math.cos(time * 0.53 + phase * 1.3) * strength * 0.55;
    }
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
    if (!state.camera) return null;
    const THREE = window.THREE;
    const point = worldToScene(worldX, worldY);
    const projected = new THREE.Vector3(point.x, height, point.z).project(state.camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      x: (projected.x * 0.5 + 0.5) * canvas.width,
      y: (-projected.y * 0.5 + 0.5) * canvas.height
    };
  }

  function is3DWorldPointVisible(worldX, worldY, height = 0) {
    const point = projectWorld(worldX, worldY, height);
    return !!point && point.x >= 0 && point.x <= canvas.width && point.y >= 0 && point.y <= canvas.height;
  }

  function get3DWorldPoint(screenX, screenY) {
    if (!state.raycaster || !state.camera) return null;
    const THREE = window.THREE;
    const pointer = new THREE.Vector2(screenX / canvas.width * 2 - 1, 1 - screenY / canvas.height * 2);
    state.raycaster.setFromCamera(pointer, state.camera);
    const intersection = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(state.groundPlane, intersection)) return null;
    return sceneToWorld(intersection);
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
