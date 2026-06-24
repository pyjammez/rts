(function registerMatchSnapshots(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before MatchSnapshot.js');

  const SCHEMA_VERSION = 1;
  let stateProvider = null;

  function cloneSerializable(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value ?? fallback));
    } catch (error) {
      return fallback;
    }
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

  function capture(state = {}) {
    const config = state.config || root.mapConfig || {};
    const definitions = app.config?.definitions || {};
    const registry = state.entityRegistry || app.entities?.registry || root.entityManager || null;
    const commandLog = app.commands?.exportCommandLog
      ? app.commands.exportCommandLog({ reason: 'match-snapshot' })
      : null;

    const snapshot = {
      schemaVersion: SCHEMA_VERSION,
      gameVersion: definitions.manifest?.contentVersion || 'unknown',
      contentVersion: definitions.manifest?.contentVersion || 'unknown',
      capturedFrame: app.runtime?.frame ?? 0,
      seed: app.random?.getSeed?.() ?? state.seed ?? 0,
      modeId: config.modeId || state.modeId || null,
      config: cloneSerializable(config, {}),
      players: cloneSerializable(config.playerSlots || [], []),
      world: {
        dimensions: app.world?.runtime?.dimensions?.() || null,
        generation: app.world?.runtime?.generation ?? null,
        seed: app.world?.runtime?.seed ?? null,
        collections: app.world?.runtime?.describe?.().collectionSizes || {}
      },
      entities: registry?.snapshot ? registry.snapshot() : [],
      resources: cloneSerializable(state.resources || root.playerResources || {}, {}),
      commands: commandLog,
      diagnostics: {
        entities: registry?.describe ? registry.describe() : null,
        commands: app.commands?.describe ? app.commands.describe() : null,
        modes: app.modes?.runtime?.describe ? app.modes.runtime.describe() : null
      }
    };
    return Object.freeze({
      snapshot,
      checksum: checksum(snapshot)
    });
  }

  function bindStateProvider(provider) {
    if (typeof provider !== 'function') throw new TypeError('Match snapshot state provider must be a function');
    stateProvider = provider;
  }

  function captureCurrent() {
    return capture(stateProvider ? stateProvider() : {});
  }

  const service = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    capture,
    checksum,
    bindStateProvider,
    captureCurrent
  });

  app.runtime.matchSnapshots = service;
  app.runtime?.registerService?.('match-snapshots', service);
  app.diagnostics?.register?.('match-snapshot', () => {
    try {
      const current = captureCurrent();
      return {
        schemaVersion: SCHEMA_VERSION,
        checksum: current.checksum,
        entityCount: current.snapshot.entities.length,
        commandCount: current.snapshot.commands?.commandCount ?? 0
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
