(function registerScenarioComposer(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.config = app.config || {};

  function mergeSettings(base = {}, overrides = {}) {
    return {
      ...base,
      ...overrides,
      map: { ...(base.map || {}), ...(overrides.map || {}) },
      players: { ...(base.players || {}), ...(overrides.players || {}) },
      units: { ...(base.units || {}), ...(overrides.units || {}) },
      resources: { ...(base.resources || {}), ...(overrides.resources || {}) }
    };
  }

  function composeScenario(id, overrides = {}) {
    const scenario = app.config.scenarios?.getScenario?.(id);
    if (!scenario) return null;
    return {
      ...scenario,
      settings: mergeSettings(scenario.settings || {}, overrides.settings || overrides)
    };
  }

  app.config.scenarioComposer = Object.freeze({
    mergeSettings,
    composeScenario
  });
})(globalThis);
