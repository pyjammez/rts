(function registerTowerDefenseSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before towerDefenseSystem.js');

  let state = {
    active: false,
    waveIndex: 0,
    waveCount: 0,
    cooldown: 0,
    interval: 16,
    enemyTeam: 'blue',
    defenderTeam: 'red',
    spawnedTotal: 0
  };

  function reset(config = {}) {
    state = {
      active: config.modeId === 'tower_defense',
      waveIndex: 0,
      waveCount: Math.max(1, Math.floor(Number(config.waveCount) || 10)),
      cooldown: 3,
      interval: 14,
      enemyTeam: 'blue',
      defenderTeam: 'red',
      spawnedTotal: 0
    };
  }

  function spawnWaveUnit(unitType, index, count) {
    if (typeof spawnTowerDefenseEnemy !== 'function') return false;
    const laneOffset = (index - (count - 1) * 0.5) * tileSize * 1.15;
    return !!spawnTowerDefenseEnemy({
      team: state.enemyTeam,
      unitType,
      laneOffset,
      waveIndex: state.waveIndex
    });
  }

  function spawnWave() {
    const count = 4 + Math.floor(state.waveIndex * 1.35);
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const unitType = state.waveIndex >= 5 && i % 4 === 0
        ? 'knight'
        : state.waveIndex >= 3 && i % 3 === 0
          ? 'archer'
          : 'soldier';
      if (spawnWaveUnit(unitType, i, count)) spawned++;
    }
    state.spawnedTotal += spawned;
    state.waveIndex++;
    state.cooldown = state.interval + Math.min(8, state.waveIndex * 1.5);
    return spawned;
  }

  function update(dt, context = {}) {
    if (!state.active) return null;
    const enemies = (context.units || []).filter(unit => unit.team === state.enemyTeam && !unit.isDead);
    if (state.waveIndex >= state.waveCount && enemies.length === 0 && state.spawnedTotal > 0) {
      state.active = false;
      return {
        winner: state.defenderTeam,
        loser: state.enemyTeam,
        reason: `All ${state.waveCount} waves were defeated. The castle stands.`
      };
    }
    state.cooldown -= Math.max(0, Number(dt) || 0);
    if (state.cooldown <= 0 && state.waveIndex < state.waveCount) spawnWave();
    return null;
  }

  function getState() {
    return { ...state };
  }

  app.systems.towerDefense = Object.freeze({ reset, update, getState });
})(globalThis);
