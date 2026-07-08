(function registerProjectileVisualFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};
  const spriteMaterials = new Map();

  function createCanvas(width = 96, height = 96) {
    const documentRef = root.document;
    if (documentRef?.createElement) {
      const canvas = documentRef.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    if (typeof root.OffscreenCanvas === 'function') return new root.OffscreenCanvas(width, height);
    return null;
  }

  function drawProjectileSprite(ctx, type) {
    ctx.clearRect(0, 0, 96, 96);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (type === 'grenade') {
      const gradient = ctx.createRadialGradient(48, 48, 4, 48, 48, 24);
      gradient.addColorStop(0, '#8fa96b');
      gradient.addColorStop(0.72, '#435b33');
      gradient.addColorStop(1, 'rgba(20,24,18,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(48, 50, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2f25';
      ctx.fillRect(40, 20, 16, 14);
      return;
    }
    if (type === 'bolt') {
      ctx.strokeStyle = 'rgba(34, 22, 12, 0.2)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(22, 54);
      ctx.lineTo(78, 38);
      ctx.stroke();
      ctx.strokeStyle = '#d8c18a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(21, 55);
      ctx.lineTo(78, 39);
      ctx.stroke();
      ctx.fillStyle = '#54504a';
      ctx.beginPath();
      ctx.moveTo(80, 38);
      ctx.lineTo(66, 32);
      ctx.lineTo(69, 45);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const color = type === 'bullet' ? '#f5de86' : '#f6efe0';
    const gradient = ctx.createRadialGradient(48, 48, 1, 48, 48, type === 'bullet' ? 13 : 18);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, type === 'bullet' ? 'rgba(227,156,51,0.82)' : 'rgba(175,216,255,0.72)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  }

  function drawImpactSprite(ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 61);
    gradient.addColorStop(0, 'rgba(255,245,170,0.95)');
    gradient.addColorStop(0.24, 'rgba(238,118,45,0.7)');
    gradient.addColorStop(0.58, 'rgba(120,56,32,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  function getSpriteMaterial(THREE, type) {
    const key = `projectile:${type}`;
    if (spriteMaterials.has(key)) return spriteMaterials.get(key);
    const canvas = createCanvas(type === 'impact' ? 128 : 96, type === 'impact' ? 128 : 96);
    if (!canvas?.getContext || !THREE.CanvasTexture || !THREE.SpriteMaterial) return null;
    const ctx = canvas.getContext('2d');
    if (type === 'impact') drawImpactSprite(ctx);
    else drawProjectileSprite(ctx, type);
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    material.userData = { billboardSprite: true, type };
    spriteMaterials.set(key, material);
    return material;
  }

  function createProjectileSprite(projectile, { THREE, worldToScene } = {}) {
    if (!THREE?.Sprite || !THREE.SpriteMaterial || !THREE.CanvasTexture) return null;
    const position = worldToScene(projectile.x, projectile.y);
    const progress = projectile.projectileType === 'grenade'
      ? Math.min(1, projectile.distanceTraveled / Math.max(1, projectile.targetDistance))
      : 0;
    const arcHeight = projectile.projectileType === 'grenade' ? Math.sin(progress * Math.PI) * 0.9 : 0;
    const sprite = new THREE.Sprite(getSpriteMaterial(THREE, projectile.projectileType || 'arrow'));
    if (!sprite.material) return null;
    const size = projectile.projectileType === 'grenade' ? 0.24 : projectile.projectileType === 'bullet' ? 0.18 : 0.28;
    if (sprite.center?.set) sprite.center.set(0.5, 0.5);
    sprite.position.set(position.x, 0.35 + arcHeight, position.z);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 8;
    sprite.userData = { billboardSprite: true, entityType: 'projectile' };
    return sprite;
  }

  function createProjectileVisual(projectile, {
    THREE,
    worldToScene,
    addSphere,
    addBox,
    materials
  } = {}) {
    if (!projectile || projectile.dead || !THREE || !worldToScene) return null;
    const spriteProjectile = createProjectileSprite(projectile, { THREE, worldToScene });
    if (spriteProjectile) return spriteProjectile;
    const position = worldToScene(projectile.x, projectile.y);
    if (projectile.projectileType === 'grenade') {
      const progress = Math.min(1, projectile.distanceTraveled / Math.max(1, projectile.targetDistance));
      const arcHeight = Math.sin(progress * Math.PI) * 0.9;
      const group = new THREE.Group();
      addSphere?.(group, 0, 0, 0, 0.1, materials.grenade);
      group.position.set(position.x, 0.3 + arcHeight, position.z);
      return group;
    }

    if (projectile.projectileType === 'bolt') {
      const bolt = new THREE.Group();
      bolt.position.set(position.x, 0.4, position.z);
      bolt.rotation.y = -Math.atan2(projectile.dirY, projectile.dirX);
      addBox?.(bolt, 0, 0, 0, 0.3, 0.035, 0.035, materials.bolt);
      return bolt;
    }

    const group = new THREE.Group();
    const material = projectile.projectileType === 'bullet' ? materials.pistolRound : materials.projectile;
    const radius = projectile.projectileType === 'bullet' ? 0.045 : 0.08;
    addSphere?.(group, 0, 0, 0, radius, material);
    group.position.set(position.x, 0.35, position.z);
    return group;
  }

  function createImpactEffectVisual(effect, {
    THREE,
    worldToScene,
    geometry,
    materials,
    scale = 1
  } = {}) {
    if (!effect || effect.type !== 'explosion' || !THREE || !worldToScene || !geometry) return null;
    const position = worldToScene(effect.x, effect.y);
    const progress = Math.min(1, effect.age / Math.max(0.0001, effect.duration));
    const radius = Math.max(0.08, effect.radius * scale * progress);
    if (THREE.Sprite && THREE.SpriteMaterial && THREE.CanvasTexture) {
      const sprite = new THREE.Sprite(getSpriteMaterial(THREE, 'impact'));
      sprite.position.set(position.x, 0.12, position.z);
      sprite.scale.set(radius * 2, radius * 2, 1);
      sprite.renderOrder = 7;
      sprite.userData = { billboardSprite: true, entityType: 'impact' };
      return sprite;
    }
    const ring = new THREE.Mesh(
      geometry('ring:explosion', () => new THREE.RingGeometry(0.82, 1, 32)),
      materials.explosion
    );
    ring.position.set(position.x, 0.08, position.z);
    ring.rotation.x = -Math.PI * 0.5;
    ring.scale.setScalar(radius);
    return ring;
  }

  app.rendering.projectileVisuals = Object.freeze({
    createProjectileVisual,
    createImpactEffectVisual
  });
})(globalThis);
