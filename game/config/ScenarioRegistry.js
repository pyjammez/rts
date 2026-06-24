(function registerScenarioRegistry(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.config = app.config || {};

  const DEFAULT_SCENARIO_PATHS = [
    'assets/data/scenarios/versus-default.json',
    'assets/data/scenarios/tower-defense-basic.json'
  ];

  const scenarios = new Map();
  const loadState = {
    loaded: false,
    errors: []
  };

  function normalizeScenario(data, path) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${path} must contain a scenario object`);
    }
    if (!data.id) throw new Error(`${path} needs an id`);
    if (!data.modeId) throw new Error(`${path} needs a modeId`);
    return {
      ...data,
      schemaVersion: Number(data.schemaVersion) || 1,
      id: String(data.id),
      modeId: String(data.modeId),
      sourcePath: path
    };
  }

  async function loadScenarios(paths = DEFAULT_SCENARIO_PATHS) {
    scenarios.clear();
    loadState.errors.length = 0;
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`${path} returned ${response.status}`);
        const scenario = normalizeScenario(await response.json(), path);
        scenarios.set(scenario.id, scenario);
      } catch (error) {
        loadState.errors.push(error.message);
        console.warn('Unable to load scenario.', error);
      }
    }
    loadState.loaded = true;
    return loadState;
  }

  function getScenario(id) {
    return scenarios.get(id) || null;
  }

  function listScenarios(filter = {}) {
    return [...scenarios.values()]
      .filter(scenario => !filter.modeId || scenario.modeId === filter.modeId)
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  function describe() {
    const byMode = {};
    for (const scenario of scenarios.values()) {
      byMode[scenario.modeId] = (byMode[scenario.modeId] || 0) + 1;
    }
    return {
      schemaVersion: 1,
      loaded: loadState.loaded,
      count: scenarios.size,
      byMode,
      errors: [...loadState.errors]
    };
  }

  app.config.scenarios = Object.freeze({
    loadScenarios,
    getScenario,
    listScenarios,
    describe,
    loadState
  });
  app.diagnostics?.register?.('scenarios', describe);
})(globalThis);
