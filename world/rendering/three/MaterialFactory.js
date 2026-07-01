(function registerThreeMaterialFactory(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before MaterialFactory.js');

  function createCanvasTexture(THREE, documentRef, width, height, draw, repeatX, repeatY, srgb = true) {
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function unitNoise(noise, x, y) {
    const value = Number(noise(x, y));
    if (!Number.isFinite(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }

  function createBarkTexture({ THREE, documentRef, noise }) {
    return createCanvasTexture(THREE, documentRef, 128, 256, (ctx, canvas) => {
      ctx.fillStyle = '#775137';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let x = 0; x < canvas.width; x += 3) {
        const shade = 52 + Math.floor(noise(x + 71, 19) * 58);
        ctx.strokeStyle = `rgba(${shade},${Math.floor(shade * 0.68)},${Math.floor(shade * 0.45)},0.42)`;
        ctx.lineWidth = 1 + noise(x + 13, 41) * 2;
        ctx.beginPath();
        ctx.moveTo(x, -8);
        for (let y = 0; y <= canvas.height + 8; y += 18) {
          ctx.lineTo(x + (noise(x + y, 103) - 0.5) * 7, y);
        }
        ctx.stroke();
      }
      for (let index = 0; index < 90; index++) {
        const x = noise(index + 211, 17) * canvas.width;
        const y = noise(index + 431, 29) * canvas.height;
        ctx.fillStyle = 'rgba(225,190,132,0.12)';
        ctx.fillRect(x, y, 1 + noise(index, 79) * 3, 7 + noise(index, 97) * 18);
      }
    }, 2, 3);
  }

  function createSoftShadowTexture({ THREE, documentRef }) {
    return createCanvasTexture(THREE, documentRef, 128, 128, (ctx, canvas) => {
      const center = canvas.width * 0.5;
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, center * 0.48);
      gradient.addColorStop(0, 'rgba(0,0,0,0.34)');
      gradient.addColorStop(0.45, 'rgba(0,0,0,0.22)');
      gradient.addColorStop(0.78, 'rgba(0,0,0,0.07)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 1, 1, false);
  }

  function createGrassDetailTexture({ THREE, documentRef, noise, renderer }) {
    const texture = createCanvasTexture(THREE, documentRef, 256, 256, (ctx, canvas) => {
      ctx.fillStyle = '#f4f5ed';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let index = 0; index < 1800; index++) {
        const x = unitNoise(noise, index * 17 + 11, index * 7 + 37) * canvas.width;
        const y = unitNoise(noise, index * 31 + 83, index * 13 + 19) * canvas.height;
        const length = 3 + unitNoise(noise, index * 29 + 5, index * 23 + 101) * 11;
        const lean = (unitNoise(noise, index * 43 + 3, index * 47 + 59) - 0.5) * 5;
        const shade = 112 + Math.floor(unitNoise(noise, index * 53 + 17, index * 61 + 29) * 96);
        ctx.strokeStyle = `rgba(${shade},${Math.min(255, shade + 18)},${Math.max(70, shade - 34)},0.16)`;
        ctx.lineWidth = 0.7 + noise(index * 67 + 7, index * 71 + 41) * 0.65;
        ctx.beginPath();
        ctx.moveTo(x, y + length * 0.5);
        ctx.lineTo(x + lean, y - length * 0.5);
        ctx.stroke();
      }

      for (let patch = 0; patch < 115; patch++) {
        const x = unitNoise(noise, patch * 101 + 5, patch * 17 + 11) * canvas.width;
        const y = unitNoise(noise, patch * 83 + 13, patch * 31 + 7) * canvas.height;
        const radius = 4 + unitNoise(noise, patch * 23 + 19, patch * 29 + 31) * 18;
        const dry = unitNoise(noise, patch * 37 + 41, patch * 43 + 47) > 0.62;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, dry ? 'rgba(185,164,92,0.14)' : 'rgba(78,129,54,0.12)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let clover = 0; clover < 260; clover++) {
        const x = unitNoise(noise, clover * 109 + 3, clover * 113 + 19) * canvas.width;
        const y = unitNoise(noise, clover * 127 + 29, clover * 131 + 47) * canvas.height;
        ctx.fillStyle = 'rgba(46,92,38,0.13)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }, 18, 18);
    texture.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    return texture;
  }

  function createFoliageTexture({ THREE, documentRef, noise, renderer }) {
    const texture = createCanvasTexture(THREE, documentRef, 256, 256, (ctx, canvas) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let cluster = 0; cluster < 180; cluster++) {
        const x = unitNoise(noise, cluster * 19 + 5, cluster * 31 + 11) * canvas.width;
        const y = unitNoise(noise, cluster * 23 + 17, cluster * 37 + 7) * canvas.height;
        const radius = 5 + unitNoise(noise, cluster * 41 + 3, cluster * 43 + 29) * 13;
        const shade = 72 + Math.floor(unitNoise(noise, cluster * 47 + 13, cluster * 53 + 17) * 86);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${shade},${Math.min(150, shade + 44)},${Math.max(38, shade - 28)},0.46)`);
        gradient.addColorStop(0.58, `rgba(${shade},${Math.min(150, shade + 34)},${Math.max(34, shade - 34)},0.22)`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let vein = 0; vein < 420; vein++) {
        const x = unitNoise(noise, vein * 61 + 2, vein * 67 + 5) * canvas.width;
        const y = unitNoise(noise, vein * 71 + 11, vein * 73 + 13) * canvas.height;
        const length = 3 + unitNoise(noise, vein * 79 + 17, vein * 83 + 19) * 8;
        ctx.strokeStyle = 'rgba(215,235,164,0.08)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (unitNoise(noise, vein * 89, vein * 97) - 0.5) * 5, y - length);
        ctx.stroke();
      }
    }, 3, 3);
    texture.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    return texture;
  }

  function createStoneTexture({ THREE, documentRef, noise, renderer, heightMap }) {
    const texture = createCanvasTexture(THREE, documentRef, 256, 256, ctx => {
      ctx.fillStyle = heightMap ? '#777' : '#b3ae9e';
      ctx.fillRect(0, 0, 256, 256);
      const courseHeight = 31;
      for (let row = 0; row < 9; row++) {
        const y = row * courseHeight;
        const offset = row % 2 ? -24 : 0;
        for (let column = -1; column < 7; column++) {
          const variation = noise(row * 31 + column * 17 + 7, row * 13 + column * 23 + 11);
          const width = 45 + Math.floor(variation * 13);
          const x = offset + column * 49;
          const shade = heightMap ? 102 + Math.floor(variation * 52) : 158 + Math.floor(variation * 42);
          ctx.fillStyle = `rgb(${shade},${heightMap ? shade : shade - 3},${heightMap ? shade : shade - 13})`;
          ctx.fillRect(x + 2, y + 2, width - 4, courseHeight - 4);
          ctx.strokeStyle = heightMap ? '#555' : 'rgba(55,50,42,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, width - 2, courseHeight - 2);
          if (!heightMap) {
            ctx.fillStyle = 'rgba(255,246,218,0.12)';
            ctx.fillRect(x + 4, y + 4, width - 8, 2);
            if (variation > 0.72) {
              ctx.fillStyle = 'rgba(52,73,42,0.22)';
              ctx.fillRect(x + 5, y + courseHeight - 8, Math.max(5, width * 0.35), 4);
            }
          }
        }
      }
    }, 2.5, 2.5, !heightMap);
    texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 1);
    return texture;
  }

  function createCourtyardTexture({ THREE, documentRef }) {
    return createCanvasTexture(THREE, documentRef, 192, 192, ctx => {
      ctx.fillStyle = '#81765f';
      ctx.fillRect(0, 0, 192, 192);
      ctx.strokeStyle = 'rgba(47,40,31,0.5)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 192; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(192, y + 2);
        ctx.stroke();
        for (let x = (y / 18) % 2 ? 9 : 0; x < 192; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + 18);
          ctx.stroke();
        }
      }
    }, 4, 4);
  }

  function create({ THREE, renderer, documentRef = root.document, noise, foliageUrl = 'assets/textures/oak-foliage.png' }) {
    if (!THREE || !documentRef || typeof noise !== 'function') {
      throw new Error('Three material creation requires THREE, document, and a noise function');
    }
    const dependencies = { THREE, renderer, documentRef, noise };
    const stoneMap = createStoneTexture({ ...dependencies, heightMap: false });
    const stoneBump = createStoneTexture({ ...dependencies, heightMap: true });
    const courtyardMap = createCourtyardTexture(dependencies);
    const barkMap = createBarkTexture(dependencies);
    const grassDetailMap = createGrassDetailTexture(dependencies);
    const softShadowMap = createSoftShadowTexture(dependencies);
    const foliageMap = createFoliageTexture(dependencies);
    const oakFoliageMap = new THREE.TextureLoader().load(foliageUrl);
    oakFoliageMap.colorSpace = THREE.SRGBColorSpace;
    oakFoliageMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const oakFoliage = new THREE.MeshStandardMaterial({
      map: oakFoliageMap,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
      alphaTest: 0.28
    });
    oakFoliage.alphaToCoverage = true;
    const oakFoliageShade = oakFoliage.clone();
    oakFoliageShade.color.setHex(0xb4c7a5);
    const oakFoliageWarm = oakFoliage.clone();
    oakFoliageWarm.color.setHex(0xd2d48a);

    function foliageMaterial(color, opacity = 1) {
      const material = new THREE.MeshStandardMaterial({
        color,
        map: foliageMap,
        roughness: 0.98,
        metalness: 0,
        side: THREE.DoubleSide,
        alphaTest: 0.18,
        transparent: opacity < 1,
        opacity
      });
      material.alphaToCoverage = true;
      return material;
    }

    return {
      ground: new THREE.MeshStandardMaterial({ vertexColors: true, map: grassDetailMap, bumpMap: grassDetailMap, bumpScale: 0.018, roughness: 0.98, metalness: 0 }),
      groundDetail: grassDetailMap,
      water: new THREE.MeshPhysicalMaterial({ color: 0x3f86a8, roughness: 0.18, metalness: 0.02, transparent: true, opacity: 0.72, depthWrite: false, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xd5cfbd, map: stoneMap, bumpMap: stoneBump, bumpScale: 0.075, roughness: 0.9, metalness: 0 }),
      stoneDark: new THREE.MeshStandardMaterial({ color: 0xaaa597, map: stoneMap, bumpMap: stoneBump, bumpScale: 0.08, roughness: 0.94 }),
      stoneLight: new THREE.MeshStandardMaterial({ color: 0xe2dbc7, map: stoneMap, bumpMap: stoneBump, bumpScale: 0.045, roughness: 0.86 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xd7c6a2, roughness: 0.97, metalness: 0 }),
      roofTerracotta: new THREE.MeshStandardMaterial({ color: 0x8f3f2d, roughness: 0.92, metalness: 0 }),
      roofSlate: new THREE.MeshStandardMaterial({ color: 0x4f5b63, roughness: 0.9, metalness: 0 }),
      roofThatch: new THREE.MeshStandardMaterial({ color: 0x9f8551, roughness: 1, metalness: 0 }),
      courtyard: new THREE.MeshStandardMaterial({ map: courtyardMap, color: 0xa29779, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x52311c, roughness: 0.88 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x242728, roughness: 0.42, metalness: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xe6b83f, roughness: 0.3, metalness: 0.72 }),
      slit: new THREE.MeshBasicMaterial({ color: 0x171713 }),
      unitShadow: new THREE.MeshBasicMaterial({ color: 0x171713, map: softShadowMap, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
      red: new THREE.MeshStandardMaterial({ color: 0xb92e26, roughness: 0.72 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x2c5fb5, roughness: 0.72 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xc99062, roughness: 0.82 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x3a2115, roughness: 0.93 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xaeb5b4, roughness: 0.28, metalness: 0.72 }),
      sciFiMetal: new THREE.MeshStandardMaterial({ color: 0x7fb8d8, roughness: 0.34, metalness: 0.78, emissive: 0x0a2435, emissiveIntensity: 0.08 }),
      robotMetal: new THREE.MeshStandardMaterial({ color: 0x68727d, roughness: 0.42, metalness: 0.86 }),
      desertCloth: new THREE.MeshStandardMaterial({ color: 0xb69b6b, roughness: 0.96 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xd9cfad, roughness: 0.92 }),
      sheep: new THREE.MeshStandardMaterial({ color: 0xe4dfce, roughness: 1 }),
      sheepFace: new THREE.MeshStandardMaterial({ color: 0x30251d, roughness: 0.95 }),
      horse: new THREE.MeshStandardMaterial({ color: 0x744321, roughness: 0.95 }),
      foliage: foliageMaterial(0x285f30),
      foliageLight: foliageMaterial(0x6f9144),
      foliageDark: foliageMaterial(0x173a24),
      foliageWarm: foliageMaterial(0xa5a656),
      oakFoliage,
      oakFoliageShade,
      oakFoliageWarm,
      trunk: new THREE.MeshStandardMaterial({ color: 0x765033, map: barkMap, bumpMap: barkMap, bumpScale: 0.035, roughness: 1 }),
      treeShadow: new THREE.MeshBasicMaterial({ color: 0x172015, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }),
      rock: new THREE.MeshStandardMaterial({ color: 0x77766c, roughness: 0.98 }),
      rockBasalt: new THREE.MeshStandardMaterial({ color: 0x3f4447, roughness: 0.98, metalness: 0.08 }),
      rockSandstone: new THREE.MeshStandardMaterial({ color: 0xae9365, roughness: 1 }),
      rockMetal: new THREE.MeshStandardMaterial({ color: 0x59636b, roughness: 0.72, metalness: 0.48 }),
      crystal: new THREE.MeshStandardMaterial({ color: 0x7bd6ff, roughness: 0.22, metalness: 0.08, emissive: 0x12618a, emissiveIntensity: 0.22 }),
      duck: new THREE.MeshStandardMaterial({ color: 0xd4bd71, roughness: 0.92 }),
      duckHead: new THREE.MeshStandardMaterial({ color: 0x234a34, roughness: 0.88 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xe27a22, roughness: 0.8 }),
      roast: new THREE.MeshStandardMaterial({ color: 0x7b351b, roughness: 0.82 }),
      roastLight: new THREE.MeshStandardMaterial({ color: 0xc97a3a, roughness: 0.78 }),
      flameOrange: new THREE.MeshBasicMaterial({ color: 0xf05a1e, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }),
      flameYellow: new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      selection: new THREE.MeshBasicMaterial({ color: 0xf3ca4a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      projectile: new THREE.MeshBasicMaterial({ color: 0xffd56b }),
      pistolRound: new THREE.MeshBasicMaterial({ color: 0xffe09a }),
      bolt: new THREE.MeshStandardMaterial({ color: 0x5b3822, roughness: 0.82 }),
      grenade: new THREE.MeshStandardMaterial({ color: 0x35402d, roughness: 0.86, metalness: 0.18 }),
      explosion: new THREE.MeshBasicMaterial({ color: 0xff9a32, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      supply: new THREE.MeshStandardMaterial({ color: 0x76502b, roughness: 0.9 })
    };
  }

  const factory = Object.freeze({ create, createBarkTexture, createFoliageTexture, createGrassDetailTexture, createStoneTexture, createCourtyardTexture, unitNoise });
  app.rendering.threeMaterials = factory;
  app.runtime?.registerService('three-materials', factory);
})(globalThis);
