(function registerProjectileVisualFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createProjectileVisual(projectile, {
    THREE,
    worldToScene,
    addSphere,
    addBox,
    materials
  } = {}) {
    if (!projectile || projectile.dead || !THREE || !worldToScene) return null;
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
