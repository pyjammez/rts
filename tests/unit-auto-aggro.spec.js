import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function createUnit(overrides = {}) {
  const enemy = { id: 2, team: 'blue', x: 120, y: 0, isDead: false };
  const unit = {
    id: 1,
    team: 'red',
    x: 0,
    y: 0,
    isDead: false,
    shootRange: 46,
    stopShootRange: 62,
    aggroRange: 190,
    fireCooldown: 0,
    attackRepathCooldown: 0,
    attackAnimationTime: 0,
    fireStance: 'attack_at_will',
    path: [],
    pathIndex: 0,
    target: null,
    movingDamage: 4,
    damage: 9,
    isEnemyValid: candidate => candidate && !candidate.isDead && candidate.team !== 'red',
    findNearestEnemy(maxDistance) {
      return Math.hypot(enemy.x - this.x, enemy.y - this.y) <= maxDistance ? enemy : null;
    },
    setDestination(x, y) {
      this.destination = { x, y };
      this.target = { x, y };
      return true;
    },
    clearMovementState() {
      this.path = [];
      this.pathIndex = 0;
      this.target = null;
    },
    shootAt(target, damage) {
      this.shot = { target, damage };
    },
    ...overrides
  };
  return { unit, enemy };
}

test('idle units auto-engage enemies inside aggro range but outside weapon range', () => {
  const context = loadOpenRTSScript('../../systems/processors/unitCombatProcessor.js', { tileSize: 32 });
  const { unit, enemy } = createUnit();

  context.processUnitCombat(unit, 0.1);

  assert.equal(unit.currentEnemy, enemy);
  assert.deepEqual(unit.destination, { x: enemy.x, y: enemy.y });
  assert.equal(unit.shot, undefined);
});

test('units hold fire instead of auto-engaging nearby enemies', () => {
  const context = loadOpenRTSScript('../../systems/processors/unitCombatProcessor.js', { tileSize: 32 });
  const { unit } = createUnit({ fireStance: 'hold_fire' });

  context.processUnitCombat(unit, 0.1);

  assert.equal(unit.currentEnemy, null);
  assert.equal(unit.destination, undefined);
});

test('auto-engaging units stop moving and attack once inside weapon range', () => {
  const context = loadOpenRTSScript('../../systems/processors/unitCombatProcessor.js', { tileSize: 32 });
  const enemy = { id: 2, team: 'blue', x: 30, y: 0, isDead: false };
  const { unit } = createUnit({
    currentEnemy: enemy,
    autoEngageTarget: enemy,
    target: { x: enemy.x, y: enemy.y },
    findNearestEnemy: () => enemy
  });

  context.processUnitCombat(unit, 0.1);

  assert.equal(unit.target, null);
  assert.equal(unit.autoEngageTarget, null);
  assert.equal(unit.shot.target, enemy);
  assert.equal(unit.shot.damage, unit.damage);
});
