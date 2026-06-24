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

      const water = new THREE.Color(0.08 + shade * 0.2, 0.34 + shade * 0.35, 0.52 + shade * 0.45);
      const sand = new THREE.Color(0.72 + shade, 0.62 + shade * 0.82, 0.34 + shade * 0.5);
      const meadow = smoothValueNoise(x + 503, y + 211, 2.8);
      const grass = new THREE.Color(0.11 + shade * 0.35, 0.34 + shade * 0.65 + meadow * 0.1, 0.12 + shade * 0.3);
      const beach = sand.clone().lerp(grass, sample.grassBlend);
      return water.lerp(beach, sample.waterBlend);
    }

    function createTerrainMeshes({ subdivisions = 8 } = {}) {
      const rows = getRows();
      const columns = getColumns();
      const positions = [];
      const colors = [];

      function pushVertex(px, py, pz, color) {
        positions.push(px, py, pz);
        colors.push(color.r, color.g, color.b);
      }

      for (let tileY = 0; tileY < rows; tileY++) {
        for (let tileX = 0; tileX < columns; tileX++) {
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
      return [terrain];
    }

    return Object.freeze({
      createTerrainMeshes,
      sampleTerrain,
      terrainHeight,
      terrainColor
    });
  }

  app.rendering.threeTerrainMeshes = Object.freeze({ createFactory });
})(globalThis);
