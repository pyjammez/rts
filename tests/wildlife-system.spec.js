import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function animal(overrides = {}) {
  return {
    x: 0,
    y: 0,
    speed: 10,
    size: 20,
    facing: -1,
    heading: Math.PI,
    wanderAngle: 0,
    wanderTimer: 10,
    grazeTimer: 0,
    isDead: false,
    ...overrides
  };
}

test('wildlife movement is deterministic and updates animal facing', () => {
  const context = loadOpenRTSScript('../../game/systems/wildlifeSystem.js');
  const sheep = animal();
  context.OpenRTS.systems.wildlife.updateSheep(1, [sheep], {
    random: () => 0.5,
    isWalkable: () => true
  });

  assert.equal(sheep.x, 10);
  assert.equal(sheep.y, 0);
  assert.equal(sheep.facing, 1);
  assert.equal(sheep.heading, 0);
});

test('wildlife turns away from blocked terrain and ignores dead animals', () => {
  const context = loadOpenRTSScript('../../game/systems/wildlifeSystem.js');
  const blockedDuck = animal({ wanderTimer: 5 });
  const deadHorse = animal({ isDead: true });
  const wildlife = context.OpenRTS.systems.wildlife;

  wildlife.updateDucks(1, [blockedDuck], {
    random: () => 0.5,
    isDuckPreferred: () => false
  });
  wildlife.updateHorses(1, [deadHorse], {
    random: () => 0.5,
    isWalkable: () => true
  });

  assert.equal(blockedDuck.x, 0);
  assert.equal(blockedDuck.wanderAngle >= Math.PI, true);
  assert.equal(deadHorse.x, 0);
  assert.equal(deadHorse.wanderTimer, 10);
});

test('Three.js material factory rejects incomplete rendering dependencies', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/MaterialFactory.js');
  assert.throws(
    () => context.OpenRTS.rendering.threeMaterials.create({}),
    /requires THREE, document, and a noise function/i
  );
});
