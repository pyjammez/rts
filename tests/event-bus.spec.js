import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('event bus subscribes, emits, and unsubscribes without coupling publishers to listeners', () => {
  const context = loadOpenRTSScript('../../core/events/eventBus.js');
  const received = [];
  const unsubscribe = context.OpenRTS.events.on('match:test', event => received.push(event.payload));

  assert.equal(context.OpenRTS.events.emit('match:test', { winner: 'red' }), 1);
  unsubscribe();
  context.OpenRTS.events.emit('match:test', { winner: 'blue' });

  assert.equal(received.length, 1);
  assert.equal(received[0].winner, 'red');
});

test('event bus supports one-time and wildcard listeners', () => {
  const context = loadOpenRTSScript('../../core/events/eventBus.js');
  let onceCount = 0;
  const eventTypes = [];

  context.OpenRTS.events.once('world:test', () => onceCount++);
  context.OpenRTS.events.on('*', event => eventTypes.push(event.type));
  context.OpenRTS.events.emit('world:test');
  context.OpenRTS.events.emit('world:test');

  assert.equal(onceCount, 1);
  assert.deepEqual(Array.from(eventTypes), ['world:test', 'world:test']);
});
