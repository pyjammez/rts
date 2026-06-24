(function registerSkirmishAiSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before skirmishAiSystem.js');

  const aiPlayersByTeam = new Map();

  function getAiTeams(config) {
    const slots = Array.isArray(config?.playerSlots) ? config.playerSlots : [];
    return slots
      .filter(slot => slot.controller === 'ai' && slot.flag)
      .map(slot => slot.flag);
  }

  function getStrategyForTeam(config, team) {
    const slot = (config?.playerSlots || []).find(candidate => candidate.flag === team);
    return slot?.aiStrategy || config?.aiStrategy || 'balanced';
  }

  function getOrCreateAiPlayer(team, config, services) {
    const strategy = getStrategyForTeam(config, team);
    const existing = aiPlayersByTeam.get(team);
    if (existing && existing.profile?.id === strategy) return existing;

    const player = new app.ai.core.AIPlayer({
      playerId: `ai-${team}`,
      team,
      strategy,
      commandBus: services.commands || app.commands,
      // Future connection point: pass a read-only query facade once entityManager is fully authoritative.
      entityManager: services.entityManager || null
    });
    aiPlayersByTeam.set(team, player);
    return player;
  }

  function update(dt, context = {}, services = {}) {
    const config = root.mapConfig || {};
    if (config.modeId !== 'versus') return;

    const aiTeams = getAiTeams(config);
    if (aiTeams.length === 0) return;

    const entityManager = services.entityManager || app.entities?.registry || root.entityManager || null;
    const query = app.entities?.query || null;
    const gameState = {
      units: query?.sources
        ? query.sources({ category: 'unit', lifecycle: 'alive' })
        : Array.isArray(context.units) ? context.units : [],
      buildings: query?.sources
        ? query.sources({ category: 'building' }).filter(building => !building.isDead)
        : Array.isArray(context.buildings) ? context.buildings : [],
      entityManager,
      query,
      modeId: config.modeId,
      config
    };

    for (const team of aiTeams) {
      getOrCreateAiPlayer(team, config, { ...services, entityManager }).update(dt, gameState);
    }
  }

  function reset() {
    aiPlayersByTeam.clear();
  }

  function getDebugState() {
    return Array.from(aiPlayersByTeam.values(), player => player.getDebugState());
  }

  app.systems.skirmishAi = Object.freeze({
    update,
    reset,
    getAiTeams,
    getDebugState
  });
})(globalThis);
