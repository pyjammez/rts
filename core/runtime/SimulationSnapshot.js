(function registerSimulationSnapshots(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before SimulationSnapshot.js');

  const SCHEMA_VERSION = 1;
  let stateProvider = null;

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function rounded(value) {
    return Math.round(finite(value) * 1000) / 1000;
  }

  function byId(left, right) {
    return String(left.id).localeCompare(String(right.id), 'en', { numeric: true });
  }

  function snapshotUnit(unit) {
    return {
      id: unit.id,
      type: unit.unitType || 'unit',
      team: unit.team || 'neutral',
      x: rounded(unit.x),
      y: rounded(unit.y),
      hp: rounded(unit.hp),
      maxHp: rounded(unit.maxHp),
      speed: rounded(unit.speed),
      heading: rounded(unit.heading),
      dead: !!unit.isDead,
      mounted: unit.mountType || null,
      inventory: unit.inventoryItem?.id || null,
      targetId: unit.attackOrderTarget?.id ?? unit.currentEnemy?.id ?? null,
      cooldown: rounded(unit.fireCooldown)
    };
  }

  function snapshotBuilding(building) {
    return {
      id: building.id,
      type: building.type,
      team: building.team,
      x: rounded(building.x),
      y: rounded(building.y),
      hp: rounded(building.hp),
      maxHp: rounded(building.maxHp),
      dead: !!building.isDead,
      level: finite(building.upgradeLevel),
      cooldown: rounded(building.fireCooldown)
    };
  }

  function snapshotWildlife(animal, index, type) {
    return {
      id: animal.id ?? `${type}-${index}`,
      type,
      x: rounded(animal.x),
      y: rounded(animal.y),
      hp: rounded(animal.hp),
      dead: !!animal.isDead,
      mounted: !!animal.isMounted,
      heading: rounded(animal.heading)
    };
  }

  function snapshotProjectile(projectile, index) {
    return {
      id: `projectile-${index}`,
      type: projectile.projectileType,
      team: projectile.team,
      x: rounded(projectile.x),
      y: rounded(projectile.y),
      damage: rounded(projectile.damage),
      distance: rounded(projectile.distanceTraveled),
      dead: !!projectile.dead
    };
  }

  function capture(state = {}) {
    const wildlife = [];
    for (const [type, animals] of [
      ['sheep', state.sheep],
      ['duck', state.ducks],
      ['horse', state.horses]
    ]) {
      for (const [index, animal] of (Array.isArray(animals) ? animals : []).entries()) {
        wildlife.push(snapshotWildlife(animal, index, type));
      }
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      frame: Math.max(0, Math.floor(finite(state.frame))),
      seed: finite(state.seed) >>> 0,
      modeId: state.modeId || null,
      units: (Array.isArray(state.units) ? state.units : []).map(snapshotUnit).sort(byId),
      buildings: (Array.isArray(state.buildings) ? state.buildings : []).map(snapshotBuilding).sort(byId),
      wildlife: wildlife.sort(byId),
      projectiles: (Array.isArray(state.projectiles) ? state.projectiles : [])
        .map(snapshotProjectile)
        .sort(byId)
    };
  }

  function checksum(snapshot) {
    const serialized = JSON.stringify(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < serialized.length; index++) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function bindStateProvider(provider) {
    if (typeof provider !== 'function') throw new TypeError('Snapshot state provider must be a function');
    stateProvider = provider;
  }

  function captureCurrent() {
    if (!stateProvider) throw new Error('Snapshot state provider has not been configured');
    const snapshot = capture(stateProvider());
    return Object.freeze({ snapshot, checksum: checksum(snapshot) });
  }

  const service = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    capture,
    checksum,
    bindStateProvider,
    captureCurrent
  });
  app.diagnostics.simulation = service;
  app.runtime?.registerService('simulation-snapshots', service);
  app.diagnostics?.register?.('simulation', () => {
    try {
      return {
        schemaVersion: SCHEMA_VERSION,
        current: captureCurrent()
      };
    } catch (error) {
      return {
        schemaVersion: SCHEMA_VERSION,
        status: 'unavailable',
        reason: error.message
      };
    }
  });
})(globalThis);
