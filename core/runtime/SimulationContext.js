(function registerSimulationContext(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before SimulationContext.js');
  app.simulation = app.simulation || {};

  function defaultGetter(path, fallback = null) {
    return () => path.reduce((value, key) => value?.[key], root) ?? fallback;
  }

  function createSimulationContext(overrides = {}) {
    const providers = {
      config: overrides.config || (() => root.mapConfig || {}),
      world: overrides.world || (() => app.world),
      entities: overrides.entities || (() => app.entities?.registry || root.entityManager || null),
      entityQueries: overrides.entityQueries || (() => app.entities?.query || null),
      commands: overrides.commands || (() => app.commands),
      random: overrides.random || (() => app.random),
      navigation: overrides.navigation || (() => root.getNavigationService?.() || null),
      resources: overrides.resources || (() => app.systems?.resources || null),
      modes: overrides.modes || (() => app.modes?.runtime || null),
      events: overrides.events || (() => app.events),
      clock: overrides.clock || (() => ({ frame: app.runtime?.frame ?? 0, elapsed: app.runtime?.elapsed ?? 0 })),
      renderer: overrides.renderer || (() => app.rendering),
      diagnostics: overrides.diagnostics || (() => app.diagnostics),
      units: overrides.units || defaultGetter(['units'], []),
      buildings: overrides.buildings || (() => app.world?.objects?.buildings?.all?.() || root.getBuildings?.() || [])
    };

    function get(name) {
      const provider = providers[name];
      return typeof provider === 'function' ? provider() : provider;
    }

    function snapshot() {
      const clock = get('clock') || {};
      const config = get('config') || {};
      const entityRegistry = get('entities');
      return {
        schemaVersion: 1,
        frame: clock.frame ?? 0,
        elapsed: clock.elapsed ?? 0,
        modeId: config.modeId || null,
        seed: app.random?.getSeed?.() ?? 0,
        entityCount: entityRegistry?.describe?.().entityCount ?? 0,
        services: Object.keys(providers)
      };
    }

    return Object.freeze({
      get,
      snapshot,
      get config() { return get('config'); },
      get world() { return get('world'); },
      get entities() { return get('entities'); },
      get entityQueries() { return get('entityQueries'); },
      get commands() { return get('commands'); },
      get random() { return get('random'); },
      get navigation() { return get('navigation'); },
      get resources() { return get('resources'); },
      get modes() { return get('modes'); },
      get events() { return get('events'); },
      get clock() { return get('clock'); },
      get renderer() { return get('renderer'); },
      get diagnostics() { return get('diagnostics'); },
      get units() { return get('units'); },
      get buildings() { return get('buildings'); }
    });
  }

  const context = createSimulationContext();
  app.simulation.createContext = createSimulationContext;
  app.simulation.context = context;
  app.runtime?.setContext?.({ simulation: context });
  app.runtime?.registerService?.('simulation-context', context);
  app.diagnostics?.register?.('simulation-context', () => context.snapshot());
})(globalThis);
