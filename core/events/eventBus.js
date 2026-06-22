(function registerEventBus(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before eventBus.js');

  const listeners = new Map();

  const types = Object.freeze({
    CONFIG_LOADED: 'config:loaded',
    WORLD_REGENERATED: 'world:regenerated',
    MATCH_STARTED: 'match:started',
    MATCH_RESET: 'match:reset',
    MATCH_ENDED: 'match:ended',
    COOKING_STARTED: 'cooking:started',
    COOKING_COMPLETED: 'cooking:completed',
    CASTLE_UPGRADED: 'castle:upgraded',
    COMMAND_ENQUEUED: 'command:enqueued',
    COMMAND_EXECUTED: 'command:executed',
    COMMAND_REJECTED: 'command:rejected'
  });

  function assertSubscription(type, listener) {
    if (typeof type !== 'string' || !type) throw new TypeError('Event type must be a non-empty string');
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function');
  }

  function on(type, listener) {
    assertSubscription(type, listener);
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
    return () => off(type, listener);
  }

  function once(type, listener) {
    assertSubscription(type, listener);
    let unsubscribe = null;
    const wrapped = event => {
      unsubscribe();
      listener(event);
    };
    unsubscribe = on(type, wrapped);
    return unsubscribe;
  }

  function off(type, listener) {
    const group = listeners.get(type);
    if (!group) return false;
    const removed = group.delete(listener);
    if (group.size === 0) listeners.delete(type);
    return removed;
  }

  function emit(type, payload = null) {
    if (typeof type !== 'string' || !type) throw new TypeError('Event type must be a non-empty string');
    const event = Object.freeze({ type, payload });
    const handlers = [
      ...(listeners.get(type) || []),
      ...(listeners.get('*') || [])
    ];

    for (const listener of handlers) {
      try {
        listener(event);
      } catch (error) {
        console.error(`OpenRTS event listener failed for "${type}"`, error);
      }
    }
    return handlers.length;
  }

  function clear(type) {
    if (typeof type === 'string') listeners.delete(type);
    else listeners.clear();
  }

  function listenerCount(type) {
    return listeners.get(type)?.size || 0;
  }

  app.events = Object.freeze({ types, on, once, off, emit, clear, listenerCount });
})(globalThis);
