(function registerCommandBus(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before CommandBus.js');

  const types = Object.freeze({
    MOVE: 'unit.move',
    ATTACK: 'unit.attack',
    MOUNT: 'unit.mount',
    PICK_UP: 'unit.pick-up',
    DROP: 'unit.drop',
    FIRE_STANCE: 'unit.fire-stance',
    COOK: 'world.cook',
    CASTLE_UPGRADE: 'castle.upgrade',
    CASTLE_ENTER: 'castle.enter',
    CASTLE_EXIT: 'castle.exit',
    CASTLE_RAMPART: 'castle.rampart'
  });
  const handlers = new Map();
  const queue = [];
  const history = [];
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

  function register(type, handler, validate = null) {
    if (typeof type !== 'string' || !type) throw new TypeError('Command type must be a non-empty string');
    if (typeof handler !== 'function') throw new TypeError(`Command "${type}" requires a handler`);
    if (handlers.has(type)) throw new Error(`Command handler already registered: ${type}`);
    handlers.set(type, Object.freeze({ handler, validate }));
  }

  function bindFrameProvider(provider) {
    if (typeof provider !== 'function') throw new TypeError('Command frame provider must be a function');
    frameProvider = provider;
  }

  function enqueue({ type, payload = {}, playerId = 'local', executeFrame = frameProvider() + 1 }) {
    if (!handlers.has(type)) throw new Error(`Unknown command type: ${type}`);
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

  function process(frame, context) {
    const results = [];
    while (queue.length > 0 && queue[0].executeFrame <= frame) {
      const command = queue.shift();
      const registration = handlers.get(command.type);
      const valid = !registration.validate || registration.validate(command, context) !== false;
      if (!valid) {
        const result = Object.freeze({ command, accepted: false });
        results.push(result);
        app.events?.emit(app.events.types.COMMAND_REJECTED, result);
        continue;
      }
      const accepted = registration.handler(command, context) !== false;
      const result = Object.freeze({ command, accepted });
      results.push(result);
      app.events?.emit(
        accepted ? app.events.types.COMMAND_EXECUTED : app.events.types.COMMAND_REJECTED,
        result
      );
    }
    return results;
  }

  function loadHistory(commands, { clearQueue = true } = {}) {
    if (!Array.isArray(commands)) throw new TypeError('Command history must be an array');
    if (clearQueue) queue.length = 0;
    for (const source of commands) {
      if (!handlers.has(source.type)) throw new Error(`Unknown command type: ${source.type}`);
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

  function clear({ includeHistory = true } = {}) {
    queue.length = 0;
    if (includeHistory) {
      history.length = 0;
      nextSequence = 1;
    }
  }

  const bus = Object.freeze({
    types,
    register,
    bindFrameProvider,
    enqueue,
    process,
    loadHistory,
    clear,
    getPending: () => queue.map(cloneSerializable),
    getHistory: () => history.map(cloneSerializable)
  });
  app.commands = bus;
  app.runtime?.registerService('commands', bus);
})(globalThis);
