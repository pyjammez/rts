import assert from 'node:assert/strict';
import test from 'node:test';
import World from '../engine/ecs/World.js';

test('world creates entities and runs initialized systems in order', () => {
  const world = new World();
  const first = world.createEntity();
  const second = world.createEntity();
  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.equal(world.entities.get(first.id), first);

  const calls = [];
  world.addSystem({
    init(receivedWorld) {
      calls.push(['init', receivedWorld]);
    },
    update(receivedWorld, dt) {
      calls.push(['update', receivedWorld, dt]);
    }
  });
  world.update(0.25);
  assert.equal(calls[0][0], 'init');
  assert.equal(calls[0][1], world);
  assert.deepEqual(calls[1], ['update', world, 0.25]);
});
