import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('a sheep roast heals at most the 20 nearest friendly units after ten seconds', () => {
  const friendlies = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    x: index * 4,
    y: 0,
    team: 'red',
    hp: 10,
    maxHp: 100,
    isDead: false
  }));
  const enemy = { id: 99, x: 4, y: 0, team: 'blue', hp: 10, maxHp: 100, isDead: false };
  const context = loadOpenRTSScript('../../game/systems/cookingSystem.js');
  const cooking = context.OpenRTS.systems.cooking;
  const sheep = { x: 0, y: 0, isDead: false, isMounted: false, reservedByUnitId: null };

  const roast = cooking.start({
    sheep,
    team: 'red',
    tileSize: 32,
    removeSheep: target => {
      target.removed = true;
      return true;
    }
  });
  assert.ok(roast);
  assert.equal(sheep.removed, true);
  assert.equal(cooking.getRoasts().length, 1);

  cooking.update(9.99, [...friendlies, enemy]);
  assert.equal(friendlies.every(unit => unit.hp === 10), true);

  cooking.update(0.02, [...friendlies, enemy]);
  assert.equal(friendlies.filter(unit => unit.hp === unit.maxHp).length, 20);
  assert.equal(enemy.hp, 10);
  assert.equal(cooking.getRoasts().length, 0);
});
