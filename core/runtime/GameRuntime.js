(function registerGameRuntime(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before GameRuntime.js');

  class GameRuntime {
    constructor() {
      this.context = {
        aliveUnits: [],
        ecsAliveUnits: []
      };
      this.services = new Map();
      this.systems = [];
      this.systemIds = new Set();
      this.frame = 0;
      this.elapsed = 0;
      this.initializedSystemIds = new Set();
    }

    setContext(values) {
      Object.assign(this.context, values);
      return this.context;
    }

    registerService(id, service) {
      if (typeof id !== 'string' || !id) throw new TypeError('Service id must be a non-empty string');
      if (this.services.has(id)) throw new Error(`Service already registered: ${id}`);
      this.services.set(id, service);
      return service;
    }

    getService(id) {
      return this.services.get(id);
    }

    registerSystem({ id, order = 0, init = null, reset = null, update, dispose = null, describe = null, enabled = true }) {
      if (typeof id !== 'string' || !id) throw new TypeError('System id must be a non-empty string');
      if (typeof update !== 'function') throw new TypeError(`System "${id}" requires an update function`);
      if (this.systemIds.has(id)) throw new Error(`System already registered: ${id}`);

      const lifecycle = { init, reset, update, dispose, describe };
      for (const [hook, handler] of Object.entries(lifecycle)) {
        if (handler !== null && handler !== undefined && typeof handler !== 'function') {
          throw new TypeError(`System "${id}" ${hook} hook must be a function`);
        }
      }

      const system = Object.freeze({ id, order, init, reset, update, dispose, describe, enabled });
      this.systems.push(system);
      this.systems.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      this.systemIds.add(id);
      return system;
    }

    hasSystem(id) {
      return this.systemIds.has(id);
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      this.frame += 1;
      this.elapsed += dt;

      for (const system of this.systems) {
        const enabled = typeof system.enabled === 'function'
          ? system.enabled(this.context)
          : system.enabled;
        if (!enabled) continue;
        if (!this.initializedSystemIds.has(system.id)) {
          system.init?.(this.context, this);
          this.initializedSystemIds.add(system.id);
        }
        system.update(dt, this.context, this);
      }
    }

    resetClock() {
      this.frame = 0;
      this.elapsed = 0;
    }

    resetSystems(match = null) {
      for (const system of this.systems) {
        system.reset?.(match, this.context, this);
      }
    }

    dispose() {
      for (const system of [...this.systems].reverse()) {
        system.dispose?.(this.context, this);
      }
      this.initializedSystemIds.clear();
    }

    describe() {
      return Object.freeze({
        frame: this.frame,
        elapsed: this.elapsed,
        systems: this.systems.map(system => ({
          id: system.id,
          order: system.order,
          initialized: this.initializedSystemIds.has(system.id),
          lifecycle: {
            init: typeof system.init === 'function',
            reset: typeof system.reset === 'function',
            update: typeof system.update === 'function',
            dispose: typeof system.dispose === 'function',
            describe: typeof system.describe === 'function'
          },
          details: typeof system.describe === 'function' ? system.describe(this.context, this) : null
        })),
        services: [...this.services.keys()]
      });
    }
  }

  app.GameRuntime = GameRuntime;
  app.runtime = app.runtime instanceof GameRuntime ? app.runtime : new GameRuntime();
})(globalThis);
