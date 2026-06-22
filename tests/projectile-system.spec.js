import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function target(overrides = {}) {
  return {
    id: 1,
    x: 10,
    y: 0,
    size: 20,
    team: 'blue',
    hp: 100,
    isDead: false,
    takeDamage(amount) {
      this.hp -= amount;
    },
    ...overrides
  };
}

test('projectile system applies direct damage and reuses pooled projectiles', () => {
  const context = loadOpenRTSScript('../../game/systems/projectileSystem.js');
  const system = context.OpenRTS.systems.projectiles;
  const enemy = target();
  const first = system.spawn({ x: 0, y: 0, target: enemy, team: 'red', damage: 12, speed: 10 });

  system.update(1, {
    queryTargets: () => [enemy],
    getBounds: () => ({ width: 100, height: 100 })
  });

  assert.equal(enemy.hp, 88);
  assert.equal(system.getProjectiles().length, 0);
  assert.equal(system.getPoolSize(), 1);

  const second = system.spawn({ x: 0, y: 0, target: enemy, team: 'red', damage: 5, speed: 10 });
  assert.equal(second, first);
  assert.equal(system.getPoolSize(), 0);
});

test('splash projectiles damage nearby enemies with falloff but not friendlies', () => {
  const context = loadOpenRTSScript('../../game/systems/projectileSystem.js');
  const system = context.OpenRTS.systems.projectiles;
  const direct = target({ id: 1 });
  const nearby = target({ id: 2, x: 15 });
  const friendly = target({ id: 3, x: 14, team: 'red' });
  system.spawn({
    x: 0,
    y: 0,
    target: direct,
    team: 'red',
    damage: 20,
    speed: 100,
    projectileType: 'grenade',
    splashRadius: 20
  });

  system.update(0.1, {
    queryTargets: () => [direct, nearby, friendly],
    getBounds: () => ({ width: 100, height: 100 })
  });

  assert.equal(direct.hp, 80);
  assert.equal(nearby.hp, 85);
  assert.equal(friendly.hp, 100);
  assert.equal(system.getImpactEffects().length, 1);
});
