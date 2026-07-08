(function registerThreeTerrainMeshFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createFactory(deps) {
    const {
      THREE,
      materials,
      tileSize,
      getRows,
      getColumns,
      getMapConfig,
      hashNoise,
      smoothValueNoise,
      fbmNoise,
      getWorldElevation
    } = deps;

    function smoothStep(edge0, edge1, value) {
      const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
      return t * t * (3 - 2 * t);
    }

    function isVolcanicTerrain() {
      return (getMapConfig?.() || {}).mapStyle === 'volcanic_lava';
    }

    function visualStyle() {
      const config = getMapConfig?.() || {};
      return String(config.visualStyle || config.mapStyle || '').toLowerCase();
    }

    function sampleTerrain(x, y) {
      const thresholds = getMapConfig?.().terrain || {};
      const waterEdge = thresholds.water ?? 0.28;
      const sandEdge = thresholds.sand ?? waterEdge + 0.07;
      const heightNoise = fbmNoise(x, y);
      const shoreNoise = (smoothValueNoise(x + 229, y + 541, 3.4) - 0.5) * 0.018;
      const beachNoise = (smoothValueNoise(x + 811, y + 131, 1.8) - 0.5) * 0.012;
      const waterBlend = smoothStep(waterEdge - 0.012, waterEdge + 0.018, heightNoise + shoreNoise);
      const grassBlend = smoothStep(sandEdge - 0.02, sandEdge + 0.035, heightNoise + beachNoise);
      return { heightNoise, waterBlend, grassBlend, isWater: waterBlend < 0.5 };
    }

    function terrainHeight(x, y, sample) {
      const broad = smoothValueNoise(x + 17, y + 43, 8) - 0.5;
      const fine = smoothValueNoise(x + 71, y + 19, 2.5) - 0.5;
      const landHeight = (broad * 0.78 + fine * 0.22) * 0.15;
      const shoreBlend = smoothStep(0.28, 0.72, sample.waterBlend);
      const worldX = x * tileSize;
      const worldY = y * tileSize;
      const authoredHeight = typeof getWorldElevation === 'function' ? getWorldElevation(worldX, worldY) : 0;
      return -0.06 + (landHeight + 0.06) * shoreBlend + authoredHeight;
    }

    function grassDetail(x, y) {
      const broadPatch = smoothValueNoise(x + 503, y + 211, 2.8);
      const meadowPatch = smoothValueNoise(x + 1031, y + 577, 1.25);
      const dryPatch = smoothValueNoise(x + 719, y + 149, 4.6);
      const clover = smoothValueNoise(x + 1609, y + 887, 9.5);
      const blade = hashNoise(Math.floor(x * 24) + 313, Math.floor(y * 24) + 929);
      const tuft = hashNoise(Math.floor(x * 7) + 41, Math.floor(y * 7) + 103);
      return {
        lush: Math.max(0, broadPatch - 0.38) * 0.22 + Math.max(0, clover - 0.65) * 0.14,
        dry: Math.max(0, dryPatch - 0.58) * 0.28,
        dark: Math.max(0, 0.42 - meadowPatch) * 0.16,
        blade: (blade - 0.5) * 0.09,
        tuft: tuft > 0.83 ? 0.08 : 0
      };
    }

    function naturalGrassColor(x, y, shade, options = {}) {
      const detail = grassDetail(x, y);
      const base = new THREE.Color(
        options.r ?? 0.12,
        options.g ?? 0.36,
        options.b ?? 0.12
      );
      base.r += shade * 0.3 + detail.dry * 0.85 - detail.dark * 0.34 + detail.blade * 0.45;
      base.g += shade * 0.58 + detail.lush * 0.76 + detail.dry * 0.34 - detail.dark * 0.42 + detail.blade * 0.32 + detail.tuft;
      base.b += shade * 0.22 + detail.lush * 0.18 - detail.dry * 0.18 - detail.dark * 0.12 + detail.blade * 0.12;
      return base;
    }

    function terrainColor(x, y, sample) {
      const broad = smoothValueNoise(x + 37, y + 61, 5) - 0.5;
      const fine = hashNoise(Math.floor(x * 11) + 101, Math.floor(y * 11) + 409) - 0.5;
      const shade = broad * 0.15 + fine * 0.06;
      if (isVolcanicTerrain()) {
        const lavaGlow = smoothValueNoise(x + 607, y + 443, 1.6);
        const lava = new THREE.Color(0.9 + lavaGlow * 0.14 + shade * 0.1, 0.2 + lavaGlow * 0.12 + shade * 0.08, 0.04);
        const ash = new THREE.Color(0.25 + shade * 0.24, 0.25 + shade * 0.22, 0.24 + shade * 0.2);
        const basalt = new THREE.Color(0.12 + shade * 0.14, 0.12 + shade * 0.13, 0.12 + shade * 0.12);
        const rock = ash.clone().lerp(basalt, smoothValueNoise(x + 503, y + 211, 2.8) * 0.65);
        const shore = new THREE.Color(0.36 + shade * 0.18, 0.31 + shade * 0.12, 0.26 + shade * 0.1).lerp(rock, sample.grassBlend);
        return lava.lerp(shore, sample.waterBlend);
      }

      const style = visualStyle();
      if (style === 'alien_crystal') {
        const water = new THREE.Color(0.05 + shade * 0.12, 0.22 + shade * 0.18, 0.34 + shade * 0.28);
        const dust = new THREE.Color(0.28 + shade * 0.24, 0.25 + shade * 0.18, 0.36 + shade * 0.22);
        const mineral = smoothValueNoise(x + 503, y + 211, 2.8);
        const field = new THREE.Color(0.12 + shade * 0.18, 0.33 + mineral * 0.13 + shade * 0.24, 0.42 + mineral * 0.16 + shade * 0.22);
        return water.lerp(dust.clone().lerp(field, sample.grassBlend), sample.waterBlend);
      }

      if (style === 'industrial_desert' || style === 'desert_raid') {
        const water = new THREE.Color(0.05 + shade * 0.12, 0.19 + shade * 0.16, 0.22 + shade * 0.18);
        const sand = new THREE.Color(0.68 + shade * 0.8, 0.56 + shade * 0.62, 0.33 + shade * 0.42);
        const scrub = new THREE.Color(0.42 + shade * 0.34, 0.39 + shade * 0.28, 0.24 + shade * 0.18);
        return water.lerp(sand.clone().lerp(scrub, sample.grassBlend * 0.65), sample.waterBlend);
      }

      if (style === 'metal_wasteland') {
        const coolant = new THREE.Color(0.04 + shade * 0.1, 0.18 + shade * 0.16, 0.2 + shade * 0.2);
        const oxidized = new THREE.Color(0.34 + shade * 0.22, 0.3 + shade * 0.18, 0.25 + shade * 0.14);
        const metal = new THREE.Color(0.22 + shade * 0.18, 0.25 + shade * 0.18, 0.27 + shade * 0.18);
        return coolant.lerp(oxidized.clone().lerp(metal, sample.grassBlend), sample.waterBlend);
      }

      if (style === 'fantasy_forest') {
        const water = new THREE.Color(0.06 + shade * 0.14, 0.28 + shade * 0.28, 0.4 + shade * 0.32);
        const loam = new THREE.Color(0.42 + shade * 0.36, 0.33 + shade * 0.26, 0.2 + shade * 0.18);
        const moss = naturalGrassColor(x, y, shade, { r: 0.08, g: 0.34, b: 0.13 });
        return water.lerp(loam.clone().lerp(moss, sample.grassBlend), sample.waterBlend);
      }

      if (style === 'temperate_kingdom') {
        const water = new THREE.Color(0.08 + shade * 0.2, 0.32 + shade * 0.32, 0.5 + shade * 0.4);
        const sand = new THREE.Color(0.75 + shade * 0.82, 0.66 + shade * 0.62, 0.42 + shade * 0.42);
        const grass = naturalGrassColor(x, y, shade, { r: 0.13, g: 0.42, b: 0.14 });
        return water.lerp(sand.clone().lerp(grass, sample.grassBlend), sample.waterBlend);
      }

      if (style === 'arabia_dryland') {
        const dryWash = smoothValueNoise(x + 901, y + 277, 3.8);
        const water = new THREE.Color(0.08 + shade * 0.16, 0.25 + shade * 0.18, 0.34 + shade * 0.2);
        const sand = new THREE.Color(0.72 + dryWash * 0.12 + shade * 0.55, 0.61 + dryWash * 0.08 + shade * 0.42, 0.34 + shade * 0.24);
        const grass = new THREE.Color(0.33 + shade * 0.22, 0.45 + dryWash * 0.08 + shade * 0.24, 0.2 + shade * 0.12);
        return water.lerp(sand.clone().lerp(grass, sample.grassBlend * 0.9), sample.waterBlend);
      }

      const water = new THREE.Color(0.08 + shade * 0.2, 0.34 + shade * 0.35, 0.52 + shade * 0.45);
      const sand = new THREE.Color(0.72 + shade, 0.62 + shade * 0.82, 0.34 + shade * 0.5);
      const grass = naturalGrassColor(x, y, shade, { r: 0.11, g: 0.34, b: 0.12 });
      const beach = sand.clone().lerp(grass, sample.grassBlend);
      return water.lerp(beach, sample.waterBlend);
    }

    function createTerrainMeshForRange({ startX = 0, startY = 0, endX = getColumns(), endY = getRows(), subdivisions = 8, chunkId = null } = {}) {
      const rows = getRows();
      const columns = getColumns();
      const positions = [];
      const colors = [];

      function pushVertex(px, py, pz, color) {
        positions.push(px, py, pz);
        colors.push(color.r, color.g, color.b);
      }

      const tileStartX = Math.max(0, Math.floor(startX));
      const tileStartY = Math.max(0, Math.floor(startY));
      const tileEndX = Math.min(columns, Math.ceil(endX));
      const tileEndY = Math.min(rows, Math.ceil(endY));

      for (let tileY = tileStartY; tileY < tileEndY; tileY++) {
        for (let tileX = tileStartX; tileX < tileEndX; tileX++) {
          for (let sy = 0; sy < subdivisions; sy++) {
            for (let sx = 0; sx < subdivisions; sx++) {
              const x0 = tileX + sx / subdivisions;
              const x1 = tileX + (sx + 1) / subdivisions;
              const z0 = tileY + sy / subdivisions;
              const z1 = tileY + (sy + 1) / subdivisions;
              const samples = [sampleTerrain(x0, z0), sampleTerrain(x1, z0), sampleTerrain(x0, z1), sampleTerrain(x1, z1)];
              const points = [
                [x0 - columns * 0.5, terrainHeight(x0, z0, samples[0]), z0 - rows * 0.5],
                [x1 - columns * 0.5, terrainHeight(x1, z0, samples[1]), z0 - rows * 0.5],
                [x0 - columns * 0.5, terrainHeight(x0, z1, samples[2]), z1 - rows * 0.5],
                [x1 - columns * 0.5, terrainHeight(x1, z1, samples[3]), z1 - rows * 0.5]
              ];
              const tileColors = [
                terrainColor(x0, z0, samples[0]),
                terrainColor(x1, z0, samples[1]),
                terrainColor(x0, z1, samples[2]),
                terrainColor(x1, z1, samples[3])
              ];
              for (const index of [0, 2, 1, 1, 2, 3]) pushVertex(...points[index], tileColors[index]);
            }
          }
        }
      }

      const terrainGeometry = new THREE.BufferGeometry();
      terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      terrainGeometry.computeVertexNormals();
      const terrain = new THREE.Mesh(terrainGeometry, materials.ground);
      terrain.receiveShadow = true;
      terrain.userData = {
        ...(terrain.userData || {}),
        staticChunkId: chunkId,
        tileStartX,
        tileStartY,
        tileEndX,
        tileEndY,
        terrainChunk: !!chunkId
      };
      return [terrain];
    }

    function appendTerrainDecal(batch, centerX, centerZ, y, width, depth, rotation = 0) {
      const halfWidth = width * 0.5;
      const halfDepth = depth * 0.5;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const corners = [
        [-halfWidth, -halfDepth, 0, 0],
        [halfWidth, -halfDepth, 1, 0],
        [-halfWidth, halfDepth, 0, 1],
        [halfWidth, halfDepth, 1, 1]
      ].map(([x, z, u, v]) => ({
        x: centerX + x * cos - z * sin,
        z: centerZ + x * sin + z * cos,
        u,
        v
      }));
      for (const index of [0, 2, 1, 1, 2, 3]) {
        const corner = corners[index];
        batch.positions.push(corner.x, y, corner.z);
        batch.uvs.push(corner.u, corner.v);
      }
    }

    function terrainDetailKind(x, y, sample) {
      if (sample.isWater || sample.waterBlend < 0.58) return null;
      const style = visualStyle();
      const patch = smoothValueNoise(x + 1703, y + 733, 2.1);
      const fine = hashNoise(Math.floor(x * 13) + 1511, Math.floor(y * 13) + 1999);
      const shore = sample.waterBlend < 0.82;
      const sandy = sample.grassBlend < 0.42;
      const grassy = sample.grassBlend > 0.62;

      if (style === 'volcanic_lava' || style === 'metal_wasteland') {
        if (patch > 0.68 && fine > 0.44) return 'pebbles';
        if (patch > 0.82) return 'dryPatch';
        return null;
      }

      if (style === 'industrial_desert' || style === 'desert_raid' || style === 'arabia_dryland') {
        if ((sandy || shore) && patch > 0.58 && fine > 0.38) return 'dryPatch';
        if (patch > 0.76 && fine > 0.5) return 'pebbles';
        if (grassy && patch > 0.7 && fine > 0.45) return 'shrub';
        return null;
      }

      if (shore && patch > 0.64) return sandy ? 'dryPatch' : 'pebbles';
      if (grassy && patch > 0.78 && fine > 0.34) return 'grass';
      if (grassy && patch > 0.68 && fine > 0.62) return 'shrub';
      if (!grassy && patch > 0.76) return 'dryPatch';
      if (patch > 0.9) return 'pebbles';
      return null;
    }

    function createTerrainDetailMeshesForRange({ startX = 0, startY = 0, endX = getColumns(), endY = getRows(), chunkId = null } = {}) {
      const rows = getRows();
      const columns = getColumns();
      const batches = {
        grass: { positions: [], uvs: [], material: materials.terrainGrassClump },
        dryPatch: { positions: [], uvs: [], material: materials.terrainDryPatch },
        pebbles: { positions: [], uvs: [], material: materials.terrainPebbles },
        shrub: { positions: [], uvs: [], material: materials.terrainShrubPatch }
      };

      const tileStartX = Math.max(0, Math.floor(startX));
      const tileStartY = Math.max(0, Math.floor(startY));
      const tileEndX = Math.min(columns, Math.ceil(endX));
      const tileEndY = Math.min(rows, Math.ceil(endY));
      const densityScale = Math.max(0.45, Math.min(1, 4096 / Math.max(1, rows * columns)));

      for (let tileY = tileStartY; tileY < tileEndY; tileY++) {
        for (let tileX = tileStartX; tileX < tileEndX; tileX++) {
          const baseRoll = hashNoise(tileX + 3607, tileY + 911);
          if (baseRoll > densityScale) continue;
          const sampleX = tileX + 0.18 + hashNoise(tileX + 101, tileY + 313) * 0.64;
          const sampleY = tileY + 0.18 + hashNoise(tileX + 421, tileY + 211) * 0.64;
          const sample = sampleTerrain(sampleX, sampleY);
          const kind = terrainDetailKind(sampleX, sampleY, sample);
          if (!kind || !batches[kind]?.material) continue;
          const y = terrainHeight(sampleX, sampleY, sample) + 0.022 + Object.keys(batches).indexOf(kind) * 0.002;
          const centerX = sampleX - columns * 0.5;
          const centerZ = sampleY - rows * 0.5;
          const sizeNoise = hashNoise(tileX + 877, tileY + 1291);
          const rotation = hashNoise(tileX + 587, tileY + 809) * Math.PI * 2;
          const width = kind === 'grass'
            ? 0.68 + sizeNoise * 0.55
            : kind === 'shrub'
              ? 0.78 + sizeNoise * 0.78
              : kind === 'pebbles'
                ? 0.54 + sizeNoise * 0.7
                : 0.92 + sizeNoise * 1.12;
          const depth = kind === 'grass'
            ? width * (0.48 + hashNoise(tileX + 1, tileY + 3) * 0.32)
            : kind === 'shrub'
              ? width * (0.58 + hashNoise(tileX + 5, tileY + 7) * 0.28)
              : kind === 'pebbles'
                ? width * (0.62 + hashNoise(tileX + 11, tileY + 13) * 0.34)
                : width * (0.46 + hashNoise(tileX + 17, tileY + 19) * 0.26);
          appendTerrainDecal(batches[kind], centerX, centerZ, y, width, depth, rotation);

          if ((kind === 'grass' || kind === 'shrub') && hashNoise(tileX + 1741, tileY + 1429) > 0.78) {
            appendTerrainDecal(
              batches.grass,
              centerX + (hashNoise(tileX + 31, tileY + 37) - 0.5) * 0.72,
              centerZ + (hashNoise(tileX + 41, tileY + 43) - 0.5) * 0.72,
              y + 0.004,
              width * 0.52,
              depth * 0.7,
              rotation + 0.8
            );
          }
        }
      }

      const meshes = [];
      for (const [kind, batch] of Object.entries(batches)) {
        if (!batch.positions.length || !batch.material) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs, 2));
        const mesh = new THREE.Mesh(geometry, batch.material);
        mesh.receiveShadow = false;
        mesh.castShadow = false;
        mesh.renderOrder = 1;
        mesh.userData = {
          ...(mesh.userData || {}),
          staticChunkId: chunkId,
          terrainDetail: kind,
          terrainChunk: !!chunkId
        };
        meshes.push(mesh);
      }
      return meshes;
    }

    function createTerrainMeshes({ subdivisions = 8, chunkTiles = 0 } = {}) {
      const rows = getRows();
      const columns = getColumns();
      const chunkSize = Math.max(0, Math.floor(Number(chunkTiles) || 0));
      if (!chunkSize) {
        return [
          ...createTerrainMeshForRange({ startX: 0, startY: 0, endX: columns, endY: rows, subdivisions }),
          ...createTerrainDetailMeshesForRange({ startX: 0, startY: 0, endX: columns, endY: rows })
        ];
      }

      const meshes = [];
      for (let startY = 0; startY < rows; startY += chunkSize) {
        for (let startX = 0; startX < columns; startX += chunkSize) {
          const chunkX = Math.floor(startX / chunkSize);
          const chunkY = Math.floor(startY / chunkSize);
          meshes.push(...createTerrainMeshForRange({
            startX,
            startY,
            endX: Math.min(columns, startX + chunkSize),
            endY: Math.min(rows, startY + chunkSize),
            subdivisions,
            chunkId: `${chunkX}:${chunkY}`
          }));
          meshes.push(...createTerrainDetailMeshesForRange({
            startX,
            startY,
            endX: Math.min(columns, startX + chunkSize),
            endY: Math.min(rows, startY + chunkSize),
            chunkId: `${chunkX}:${chunkY}`
          }));
        }
      }
      return meshes;
    }

    return Object.freeze({
      createTerrainMeshes,
      createTerrainMeshForRange,
      createTerrainDetailMeshesForRange,
      sampleTerrain,
      terrainHeight,
      terrainColor,
      grassDetail
    });
  }

  app.rendering.threeTerrainMeshes = Object.freeze({ createFactory });
})(globalThis);
