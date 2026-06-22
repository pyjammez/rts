import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('building combat targets the nearest enemy and respects cooldowns', () => {
  const context = loadOpenRTSScript('../../game/systems/buildingCombatSystem.js');
  const tower = {
    id: 1,
    type: 'tower',
    team: 'red',
    x: 0,
    y: 0,
    range: 100,
    damage: 12,
    projectileSpeed: 240,
    attackCooldown: 1.2,
    fireCooldown: 0,
    isDead: false
  };
  const nearEnemy = { id: 2, team: 'blue', x: 20, y: 0, isDead: false };
  const farEnemy = { id: 3, team: 'blue', x: 70, y: 0, isDead: false };
  const friendly = { id: 4, team: 'red', x: 5, y: 0, isDead: false };
  const projectiles = [];
  const dependencies = { spawnProjectile: projectile => projectiles.push(projectile) };

  context.OpenRTS.systems.buildingCombat.update(
    0.1,
    { buildings: [tower], units: [farEnemy, friendly, nearEnemy] },
    dependencies
  );
  context.OpenRTS.systems.buildingCombat.update(
    0.1,
    { buildings: [tower], units: [farEnemy, nearEnemy] },
    dependencies
  );

  assert.equal(projectiles.length, 1);
  assert.equal(projectiles[0].target, nearEnemy);
  assert.equal(projectiles[0].damage, 12);
  assert.equal(tower.fireCooldown, 1.0999999999999999);
});

test('a castle fires only with a rampart defender and inherits the stronger weapon', () => {
  const context = loadOpenRTSScript('../../game/systems/buildingCombatSystem.js');
  const castle = {
    id: 10,
    type: 'home',
    team: 'red',
    x: 0,
    y: 0,
    range: 200,
    damage: 5,
    attackCooldown: 1,
    fireCooldown: 0,
    isDead: false
  };
  const enemy = { id: 11, team: 'blue', x: 100, y: 0, isDead: false };
  const defender = {
    id: 12,
    damage: 18,
    shootRange: 220,
    projectileSpeed: 310,
    projectileColor: '#abc'
  };
  const projectiles = [];
  const system = context.OpenRTS.systems.buildingCombat;

  system.update(0.1, { buildings: [castle], units: [enemy] }, {
    getRampartDefender: () => null,
    spawnProjectile: projectile => projectiles.push(projectile)
  });
  system.update(0.1, { buildings: [castle], units: [enemy] }, {
    getRampartDefender: () => defender,
    spawnProjectile: projectile => projectiles.push(projectile)
  });

  assert.equal(projectiles.length, 1);
  assert.equal(projectiles[0].damage, 18);
  assert.equal(projectiles[0].speed, 310);
  assert.equal(castle.rampartUnitId, defender.id);
});
