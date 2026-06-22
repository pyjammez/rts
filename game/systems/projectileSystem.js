(function registerProjectileSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before projectileSystem.js');

  const projectiles = [];
  const impactEffects = [];
  const pool = [];

  class Projectile {
    constructor(config) {
      this.reset(config);
    }

    reset({
      x,
      y,
      target,
      team,
      damage = 8,
      shooter = null,
      speed = 200,
      color = null,
      projectileType = 'arrow',
      splashRadius = 0
    }) {
      this.x = x;
      this.y = y;
      this.startX = x;
      this.startY = y;
      this.team = team;
      this.damage = damage;
      this.color = color;
      this.projectileType = projectileType || 'arrow';
      this.splashRadius = Math.max(0, Number(splashRadius) || 0);
      this.dead = false;
      this.radius = 6;
      this.maxRange = 1200;
      this.distanceTraveled = 0;
      const dx = target.x - x;
      const dy = target.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      this.targetDistance = distance;
      this.dirX = dx / distance;
      this.dirY = dy / distance;
      this.speed = speed || 200;
      this.shooter = shooter;
      this.intendedTarget = target;
      return this;
    }

    update(dt, dependencies) {
      if (this.dead) return;
      const moveDistance = this.speed * dt;
      this.x += this.dirX * moveDistance;
      this.y += this.dirY * moveDistance;
      this.distanceTraveled += moveDistance;

      const candidates = dependencies.queryTargets(this.x, this.y, this.radius + dependencies.queryPadding);
      for (const target of candidates) {
        if (!isValidTarget(this, target)) continue;
        if (Math.hypot(target.x - this.x, target.y - this.y) >= target.size * 0.5 + this.radius) continue;
        applyImpactDamage(this, target, dependencies);
        this.dead = true;
        return;
      }

      const bounds = dependencies.getBounds();
      if (
        this.distanceTraveled > this.maxRange ||
        this.x < 0 || this.x > bounds.width ||
        this.y < 0 || this.y > bounds.height
      ) {
        this.dead = true;
      }
    }
  }

  function isValidTarget(projectile, target) {
    return !!target &&
      !target.isDead &&
      target !== projectile.shooter &&
      target.team !== projectile.team;
  }

  function applyImpactDamage(projectile, directTarget, dependencies) {
    if (projectile.splashRadius <= 0) {
      directTarget.takeDamage(projectile.damage);
      return;
    }

    impactEffects.push({
      type: 'explosion',
      x: projectile.x,
      y: projectile.y,
      radius: projectile.splashRadius,
      age: 0,
      duration: 0.42
    });
    const nearby = dependencies.queryTargets(projectile.x, projectile.y, projectile.splashRadius);
    nearby.push(directTarget);

    for (const target of new Set(nearby)) {
      if (!isValidTarget(projectile, target)) continue;
      const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y);
      const targetRadius = Math.max(0, Number(target.size) || 0) * 0.5;
      if (distance > projectile.splashRadius + targetRadius) continue;
      const falloff = Math.max(0.45, 1 - distance / Math.max(1, projectile.splashRadius));
      target.takeDamage(Math.max(1, Math.round(projectile.damage * falloff)));
    }
  }

  function spawn(config) {
    if (!config?.target) return null;
    const projectile = pool.pop()?.reset(config) || new Projectile(config);
    projectiles.push(projectile);
    return projectile;
  }

  function update(dt, dependencies) {
    const resolved = {
      queryTargets: dependencies?.queryTargets || (() => []),
      getBounds: dependencies?.getBounds || (() => ({ width: 1920, height: 1080 })),
      queryPadding: dependencies?.queryPadding || 32
    };
    for (let index = projectiles.length - 1; index >= 0; index--) {
      const projectile = projectiles[index];
      projectile.update(dt, resolved);
      if (!projectile.dead) continue;
      projectiles.splice(index, 1);
      pool.push(projectile);
    }
    for (let index = impactEffects.length - 1; index >= 0; index--) {
      impactEffects[index].age += dt;
      if (impactEffects[index].age >= impactEffects[index].duration) impactEffects.splice(index, 1);
    }
  }

  function render2D(ctx) {
    for (const projectile of projectiles) {
      if (projectile.dead) continue;
      ctx.save();
      ctx.beginPath();
      const radius = projectile.projectileType === 'grenade' ? 7 : projectile.projectileType === 'bullet' ? 3 : 5;
      ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = projectile.color || (projectile.team === 'red' ? '#ff6600' : '#00ccff');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111';
      ctx.stroke();
      ctx.restore();
    }
    for (const effect of impactEffects) {
      const progress = effect.age / effect.duration;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 151, 52, ${1 - progress})`;
      ctx.lineWidth = 4 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function reset() {
    while (projectiles.length) pool.push(projectiles.pop());
    impactEffects.length = 0;
  }

  const system = Object.freeze({
    spawn,
    update,
    reset,
    render2D,
    getProjectiles: () => projectiles,
    getImpactEffects: () => impactEffects,
    getPoolSize: () => pool.length
  });
  app.systems.projectiles = system;
  app.runtime?.registerService('projectiles', system);
})(globalThis);
