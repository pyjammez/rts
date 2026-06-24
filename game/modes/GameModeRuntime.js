(function registerGameModeRuntime(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.modes = app.modes || {};

  const REQUIRED_HOOKS = ['createMatch', 'spawnInitialWorld', 'update', 'checkVictory', 'describeSetup'];

  function noop() {}

  function normalizeMode(modeId, adapter = {}) {
    if (!modeId) throw new Error('Mode id is required');
    return Object.freeze({
      id: modeId,
      createMatch: typeof adapter.createMatch === 'function'
        ? adapter.createMatch
        : config => ({ modeId, config: { ...(config || {}) }, startedAt: Date.now() }),
      spawnInitialWorld: typeof adapter.spawnInitialWorld === 'function' ? adapter.spawnInitialWorld : noop,
      update: typeof adapter.update === 'function' ? adapter.update : () => null,
      checkVictory: typeof adapter.checkVictory === 'function' ? adapter.checkVictory : () => null,
      describeSetup: typeof adapter.describeSetup === 'function'
        ? adapter.describeSetup
        : () => ({ modeId, sections: [] })
    });
  }

  class GameModeRuntime {
    constructor() {
      this.modes = new Map();
      this.active = null;
    }

    register(modeId, adapter = {}) {
      const mode = normalizeMode(modeId, adapter);
      this.modes.set(modeId, mode);
      return mode;
    }

    ensure(modeId, adapter = {}) {
      return this.modes.get(modeId) || this.register(modeId, adapter);
    }

    get(modeId) {
      return this.modes.get(modeId) || null;
    }

    activate(modeId, config = {}, context = {}) {
      const mode = this.ensure(modeId);
      const match = mode.createMatch(config, context) || { modeId, config };
      this.active = {
        modeId,
        mode,
        match,
        config,
        startedFrame: context.frame ?? null
      };
      return this.active;
    }

    spawnInitialWorld(context = {}) {
      if (!this.active) return null;
      return this.active.mode.spawnInitialWorld(this.active.match, context);
    }

    update(dt, context = {}) {
      if (!this.active) return null;
      return this.active.mode.update(dt, this.active.match, context);
    }

    checkVictory(context = {}) {
      if (!this.active) return null;
      return this.active.mode.checkVictory(this.active.match, context);
    }

    describe() {
      const modes = {};
      for (const [id, mode] of this.modes.entries()) {
        modes[id] = {
          id,
          hooks: REQUIRED_HOOKS.filter(hook => typeof mode[hook] === 'function')
        };
      }
      return {
        schemaVersion: 1,
        activeModeId: this.active?.modeId || null,
        modeCount: this.modes.size,
        modes
      };
    }
  }

  const runtime = app.modes.runtime instanceof GameModeRuntime
    ? app.modes.runtime
    : new GameModeRuntime();

  app.modes.GameModeRuntime = GameModeRuntime;
  app.modes.runtime = runtime;
  app.runtime?.registerService?.('game-modes', runtime);
  app.diagnostics?.register?.('game-modes', () => runtime.describe());
})(globalThis);
