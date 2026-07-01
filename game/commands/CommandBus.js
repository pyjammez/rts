(function registerCommandBus(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before CommandBus.js');

  const types = Object.freeze({
    MOVE: 'unit.move',
    ATTACK_MOVE: 'unit.attack-move',
    ATTACK: 'unit.attack',
    MOUNT: 'unit.mount',
    PICK_UP: 'unit.pick-up',
    DROP: 'unit.drop',
    FIRE_STANCE: 'unit.fire-stance',
    COOK: 'world.cook',
    WORKER_GATHER: 'worker.gather',
    WORKER_BUILD: 'worker.build',
    HOUSE_ENTER: 'house.enter',
    HOUSE_EXIT: 'house.exit',
    HOUSE_BURN: 'house.burn',
    CASTLE_UPGRADE: 'castle.upgrade',
    PRODUCTION_ENQUEUE: 'production.enqueue',
    ABILITY_CAST: 'ability.cast'
  });
  const handlers = new Map();
  const queue = [];
  const history = [];
  const rejectionHistory = [];
  const COMMAND_LOG_SCHEMA_VERSION = 1;
  let nextSequence = 1;
  let frameProvider = () => 0;

  function cloneSerializable(value) {
    if (value === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      throw new TypeError(`Command payload must be serializable: ${error.message}`);
    }
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function checksum(value) {
    const source = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index++) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function getContentVersion() {
    return app.config?.definitions?.manifest?.contentVersion || app.config?.definitions?.loadState?.contentVersion || null;
  }

  function normalizeRegistrationOptions(options = {}) {
    return Object.freeze({
      description: options.description || '',
      payloadSchema: options.payloadSchema || null,
      deterministic: options.deterministic !== false
    });
  }

  function register(type, handler, validate = null, options = {}) {
    if (typeof type !== 'string' || !type) throw new TypeError('Command type must be a non-empty string');
    if (typeof handler !== 'function') throw new TypeError(`Command "${type}" requires a handler`);
    if (handlers.has(type)) throw new Error(`Command handler already registered: ${type}`);
    handlers.set(type, Object.freeze({
      type,
      handler,
      validate,
      options: normalizeRegistrationOptions(options)
    }));
  }

  function bindFrameProvider(provider) {
    if (typeof provider !== 'function') throw new TypeError('Command frame provider must be a function');
    frameProvider = provider;
  }

  function enqueue({ type, payload = {}, playerId = 'local', executeFrame = frameProvider() + 1 }) {
    if (!handlers.has(type)) throw new Error(`Unknown command type: ${type}`);
    const registration = handlers.get(type);
    const schemaValidation = validatePayloadSchema(payload, registration.options.payloadSchema);
    if (!schemaValidation.accepted) {
      throw new TypeError(`Invalid payload for command "${type}": ${schemaValidation.reason}`);
    }
    const command = Object.freeze({
      sequence: nextSequence++,
      executeFrame: Math.max(0, Math.floor(Number(executeFrame) || 0)),
      playerId: String(playerId),
      type,
      payload: cloneSerializable(payload)
    });
    queue.push(command);
    queue.sort((left, right) => left.executeFrame - right.executeFrame || left.sequence - right.sequence);
    history.push(command);
    app.events?.emit(app.events.types.COMMAND_ENQUEUED, command);
    return command;
  }

  function validatePayloadSchema(payload, schema) {
    if (!schema) return { accepted: true };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { accepted: false, reason: 'payload must be an object' };
    }

    for (const [field, rule] of Object.entries(schema)) {
      const normalized = typeof rule === 'string' ? { type: rule, required: true } : { required: true, ...rule };
      const value = payload[field];
      if (value === undefined || value === null) {
        if (normalized.required) return { accepted: false, reason: `missing required field "${field}"` };
        continue;
      }
      if (!matchesSchemaType(value, normalized.type)) {
        return { accepted: false, reason: `field "${field}" must be ${normalized.type}` };
      }
      if (normalized.integer && !Number.isInteger(Number(value))) {
        return { accepted: false, reason: `field "${field}" must be an integer` };
      }
      if (Number.isFinite(Number(normalized.min)) && Number(value) < Number(normalized.min)) {
        return { accepted: false, reason: `field "${field}" must be at least ${normalized.min}` };
      }
      if (Array.isArray(normalized.values) && !normalized.values.includes(value)) {
        return { accepted: false, reason: `field "${field}" must be one of ${normalized.values.join(', ')}` };
      }
    }

    return { accepted: true };
  }

  function matchesSchemaType(value, type) {
    if (!type || type === 'any') return true;
    if (type === 'array') return Array.isArray(value);
    if (type === 'integer') return Number.isInteger(Number(value));
    if (type === 'number') return Number.isFinite(Number(value));
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
    return typeof value === type;
  }

  function normalizeValidationResult(value) {
    if (value === false) return { accepted: false, reason: 'validator rejected command' };
    if (typeof value === 'string') return { accepted: false, reason: value };
    if (value && typeof value === 'object' && value.accepted === false) {
      return { accepted: false, reason: value.reason || 'validator rejected command' };
    }
    return { accepted: true, reason: '' };
  }

  function recordRejection(result) {
    rejectionHistory.push(result);
    app.events?.emit(app.events.types.COMMAND_REJECTED, result);
  }

  function process(frame, context) {
    const results = [];
    while (queue.length > 0 && queue[0].executeFrame <= frame) {
      const command = queue.shift();
      const registration = handlers.get(command.type);
      const validation = registration.validate
        ? normalizeValidationResult(registration.validate(command, context))
        : { accepted: true, reason: '' };
      if (!validation.accepted) {
        const result = Object.freeze({ command, accepted: false, reason: validation.reason, frame });
        results.push(result);
        recordRejection(result);
        continue;
      }
      const accepted = registration.handler(command, context) !== false;
      const result = Object.freeze({
        command,
        accepted,
        reason: accepted ? '' : 'handler rejected command',
        frame
      });
      results.push(result);
      if (accepted) {
        app.events?.emit(app.events.types.COMMAND_EXECUTED, result);
      } else {
        recordRejection(result);
      }
    }
    return results;
  }

  function loadHistory(commands, { clearQueue = true } = {}) {
    if (!Array.isArray(commands)) throw new TypeError('Command history must be an array');
    if (clearQueue) queue.length = 0;
    for (const source of commands) {
      if (!handlers.has(source.type)) throw new Error(`Unknown command type: ${source.type}`);
      const registration = handlers.get(source.type);
      const schemaValidation = validatePayloadSchema(source.payload || {}, registration.options.payloadSchema);
      if (!schemaValidation.accepted) {
        throw new TypeError(`Invalid payload for command "${source.type}": ${schemaValidation.reason}`);
      }
      const command = Object.freeze({
        sequence: Math.max(1, Math.floor(Number(source.sequence) || nextSequence++)),
        executeFrame: Math.max(0, Math.floor(Number(source.executeFrame) || 0)),
        playerId: String(source.playerId || 'replay'),
        type: source.type,
        payload: cloneSerializable(source.payload || {})
      });
      queue.push(command);
      nextSequence = Math.max(nextSequence, command.sequence + 1);
    }
    queue.sort((left, right) => left.executeFrame - right.executeFrame || left.sequence - right.sequence);
    return queue.length;
  }

  function createCommandLogEnvelope(commands, metadata = {}) {
    const commandList = commands.map(cloneSerializable);
    const envelope = {
      schemaVersion: COMMAND_LOG_SCHEMA_VERSION,
      gameVersion: app.version || null,
      contentVersion: getContentVersion(),
      exportedFrame: Math.max(0, Math.floor(Number(frameProvider()) || 0)),
      commandCount: commandList.length,
      metadata: cloneSerializable(metadata) || {},
      commands: commandList
    };
    return Object.freeze({
      ...envelope,
      checksum: checksum(envelope)
    });
  }

  function exportCommandLog(metadata = {}) {
    return createCommandLogEnvelope(history, metadata);
  }

  function verifyCommandLog(log) {
    if (!log || typeof log !== 'object' || Array.isArray(log)) {
      return { accepted: false, reason: 'command log must be an object' };
    }
    if (Number(log.schemaVersion) !== COMMAND_LOG_SCHEMA_VERSION) {
      return { accepted: false, reason: `unsupported command log schema ${log.schemaVersion}` };
    }
    if (!Array.isArray(log.commands)) {
      return { accepted: false, reason: 'command log commands must be an array' };
    }
    if (Number(log.commandCount) !== log.commands.length) {
      return { accepted: false, reason: 'command log commandCount does not match commands length' };
    }
    const { checksum: expectedChecksum, ...withoutChecksum } = log;
    const actualChecksum = checksum(withoutChecksum);
    if (expectedChecksum !== actualChecksum) {
      return { accepted: false, reason: 'command log checksum mismatch' };
    }
    return { accepted: true, reason: '', checksum: actualChecksum };
  }

  function loadCommandLog(log, options = {}) {
    const verification = verifyCommandLog(log);
    if (!verification.accepted) throw new Error(`Invalid command log: ${verification.reason}`);
    return loadHistory(log.commands, options);
  }

  function clear({ includeHistory = true } = {}) {
    queue.length = 0;
    if (includeHistory) {
      history.length = 0;
      rejectionHistory.length = 0;
      nextSequence = 1;
    }
  }

  function describe() {
    const registered = {};
    for (const [type, registration] of handlers) {
      registered[type] = Object.freeze({
        type,
        description: registration.options.description,
        deterministic: registration.options.deterministic,
        payloadSchema: registration.options.payloadSchema
      });
    }
    return Object.freeze({
      registered: Object.freeze(registered),
      registeredCount: handlers.size,
      pendingCount: queue.length,
      historyCount: history.length,
      rejectionCount: rejectionHistory.length,
      commandLogSchemaVersion: COMMAND_LOG_SCHEMA_VERSION,
      nextSequence
    });
  }

  const extensions = {
    gameplayHandlers: app.commands?.gameplayHandlers || null
  };

  const bus = Object.freeze({
    types,
    register,
    bindFrameProvider,
    enqueue,
    process,
    loadHistory,
    exportCommandLog,
    loadCommandLog,
    verifyCommandLog,
    clear,
    describe,
    get gameplayHandlers() { return extensions.gameplayHandlers; },
    set gameplayHandlers(value) { extensions.gameplayHandlers = value; },
    getPending: () => queue.map(cloneSerializable),
    getHistory: () => history.map(cloneSerializable),
    getRejections: () => rejectionHistory.map(cloneSerializable)
  });
  app.commands = bus;
  app.runtime?.registerService('commands', bus);
  app.diagnostics?.register?.('commands', bus.describe);
})(globalThis);
