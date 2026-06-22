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

    registerSystem({ id, order = 0, update, enabled = true }) {
      if (typeof id !== 'string' || !id) throw new TypeError('System id must be a non-empty string');
      if (typeof update !== 'function') throw new TypeError(`System "${id}" requires an update function`);
      if (this.systemIds.has(id)) throw new Error(`System already registered: ${id}`);

      const system = Object.freeze({ id, order, update, enabled });
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
        system.update(dt, this.context, this);
      }
    }

    resetClock() {
      this.frame = 0;
      this.elapsed = 0;
    }

    describe() {
      return Object.freeze({
        frame: this.frame,
        elapsed: this.elapsed,
        systems: this.systems.map(system => system.id),
        services: [...this.services.keys()]
      });
    }
  }

  app.GameRuntime = GameRuntime;
  app.runtime = app.runtime instanceof GameRuntime ? app.runtime : new GameRuntime();
})(globalThis);
