(function registerResourceSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before resourceSystem.js');

  let resourceDefinitions = {
    gold: { id: 'gold', name: 'Gold', defaultStartingAmount: 140 },
    wood: { id: 'wood', name: 'Wood', defaultStartingAmount: 160 },
    stone: { id: 'stone', name: 'Stone', defaultStartingAmount: 0 },
    food: { id: 'food', name: 'Food', defaultStartingAmount: 0 }
  };
  let RESOURCE_TYPES = Object.freeze(Object.keys(resourceDefinitions));
  let DEFAULT_STARTING_RESOURCES = Object.freeze({ gold: 140, wood: 160, stone: 0, food: 0 });
  let resourcesByTeam = new Map();

  function normalizeBundle(source = {}) {
    const bundle = RESOURCE_TYPES.reduce((result, type) => {
      const fallback = resourceDefinitions[type]?.defaultStartingAmount || 0;
      result[type] = Math.max(0, Math.floor(Number(source[type] ?? fallback) || 0));
      return result;
    }, {});
    for (const [type, value] of Object.entries(source || {})) {
      if (bundle[type] !== undefined) continue;
      bundle[type] = Math.max(0, Math.floor(Number(value) || 0));
    }
    return bundle;
  }

  function configure({ resources = null, starting = null } = {}) {
    if (resources && typeof resources === 'object' && !Array.isArray(resources)) {
      resourceDefinitions = {};
      for (const [id, definition] of Object.entries(resources)) {
        resourceDefinitions[id] = {
          ...(definition && typeof definition === 'object' ? definition : {}),
          id
        };
      }
      RESOURCE_TYPES = Object.freeze(Object.keys(resourceDefinitions));
    }
    DEFAULT_STARTING_RESOURCES = Object.freeze(RESOURCE_TYPES.reduce((bundle, type) => {
      bundle[type] = Math.max(0, Math.floor(Number(
        starting?.[type] ?? resourceDefinitions[type]?.defaultStartingAmount ?? 0
      ) || 0));
      return bundle;
    }, {}));
    return describe();
  }

  function ensureTeam(team = 'neutral') {
    const key = String(team || 'neutral');
    if (!resourcesByTeam.has(key)) resourcesByTeam.set(key, normalizeBundle());
    return resourcesByTeam.get(key);
  }

  function reset(teams = ['red', 'blue'], starting = DEFAULT_STARTING_RESOURCES) {
    resourcesByTeam = new Map();
    const start = normalizeBundle(starting);
    for (const team of Array.isArray(teams) && teams.length ? teams : ['red', 'blue']) {
      resourcesByTeam.set(String(team), { ...start });
    }
  }

  function get(team = 'neutral') {
    return { ...ensureTeam(team) };
  }

  function add(team, type, amount) {
    const bundle = ensureTeam(team);
    const key = String(type || '');
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!key || value <= 0) return false;
    if (bundle[key] === undefined) bundle[key] = 0;
    bundle[key] += value;
    return true;
  }

  function canAfford(team, cost = {}) {
    const bundle = ensureTeam(team);
    return Object.entries(cost).every(([type, amount]) => bundle[type] >= Math.max(0, Number(amount) || 0));
  }

  function spend(team, cost = {}) {
    if (!canAfford(team, cost)) return false;
    const bundle = ensureTeam(team);
    for (const [type, amount] of Object.entries(cost)) {
      if (bundle[type] === undefined) continue;
      bundle[type] -= Math.max(0, Math.floor(Number(amount) || 0));
    }
    return true;
  }

  function all() {
    return Object.fromEntries([...resourcesByTeam.entries()].map(([team, bundle]) => [team, { ...bundle }]));
  }

  function describe() {
    return {
      schemaVersion: 1,
      resourceTypes: [...RESOURCE_TYPES],
      resources: Object.fromEntries(Object.entries(resourceDefinitions).map(([id, definition]) => [id, { ...definition }])),
      defaultStartingResources: { ...DEFAULT_STARTING_RESOURCES },
      teams: all()
    };
  }

  app.systems.resources = Object.freeze({
    get DEFAULT_STARTING_RESOURCES() { return DEFAULT_STARTING_RESOURCES; },
    get RESOURCE_TYPES() { return RESOURCE_TYPES; },
    configure,
    reset,
    ensureTeam,
    get,
    add,
    canAfford,
    spend,
    all,
    describe
  });
})(globalThis);
