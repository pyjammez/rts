(function registerVisionSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before visionSystem.js');
  app.systems = app.systems || {};

  const visibilityByTeam = new Map();
  let revision = 0;

  function visionRadiusFor(entity) {
    const source = entity?.source || {};
    if (Number.isFinite(Number(source.visionRadius))) return Number(source.visionRadius);
    if (entity?.category === 'building') return source.type === 'home' ? 520 : 380;
    if (source.unitType === 'scout') return 360;
    if (source.movementType === 'air') return 420;
    if (entity?.category === 'unit') return 280;
    return 0;
  }

  function update(_dt, context = {}) {
    const registry = context.registry || app.entities?.registry || root.entityManager;
    visibilityByTeam.clear();
    if (!registry?.query) return;

    const seers = registry.query({
      category: ['unit', 'building'],
      lifecycle: 'alive',
      predicate: entity => entity.team && entity.team !== 'neutral'
    });
    const candidates = registry.query({
      predicate: entity => entity.team !== undefined
    });

    for (const seer of seers) {
      const radius = visionRadiusFor(seer);
      if (radius <= 0) continue;
      if (!visibilityByTeam.has(seer.team)) visibilityByTeam.set(seer.team, new Set());
      const visible = visibilityByTeam.get(seer.team);
      visible.add(seer.key);

      for (const candidate of candidates) {
        if (candidate.team === seer.team || candidate.team === 'neutral') {
          visible.add(candidate.key);
          continue;
        }
        const distance = Math.hypot(candidate.x - seer.x, candidate.y - seer.y);
        if (distance <= radius + Math.max(0, candidate.size || 0)) visible.add(candidate.key);
      }
    }
    revision++;
  }

  function isVisibleTo(team, entityOrKey) {
    if (!team) return true;
    const key = typeof entityOrKey === 'string' ? entityOrKey : entityOrKey?.key;
    const entity = typeof entityOrKey === 'string'
      ? app.entities?.registry?.getByKey?.(entityOrKey)
      : entityOrKey;
    if (!key) return false;
    if (!entity || entity.team === team || entity.team === 'neutral') return true;
    return visibilityByTeam.get(team)?.has(key) || false;
  }

  function describe() {
    const teams = {};
    for (const [team, visible] of visibilityByTeam.entries()) {
      teams[team] = visible.size;
    }
    return {
      schemaVersion: 1,
      revision,
      teams
    };
  }

  app.systems.vision = Object.freeze({
    update,
    isVisibleTo,
    describe
  });
  app.diagnostics?.register?.('vision', describe);
})(globalThis);
