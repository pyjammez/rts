import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('entity registry syncs units and world objects into one queryable catalog', () => {
  const context = loadOpenRTSScript('../../ecs/entityManager.js');
  const registry = context.entityManager;
  const red = {
    id: 1,
    unitType: 'worker',
    team: 'red',
    x: 10,
    y: 20,
    size: 18,
    hp: 70,
    maxHp: 74,
    speed: 100,
    path: [{ x: 2, y: 3 }],
    damage: 8,
    shootRange: 45,
    selected: true
  };
  const sheep = {
    id: 'wildlife-1',
    objectType: 'wildlife',
    displayName: 'Sheep',
    team: 'neutral',
    x: 30,
    y: 40,
    size: 34,
    hp: 24,
    maxHp: 24
  };
  const house = {
    id: 'house-1',
    objectType: 'house',
    team: 'neutral',
    x: 70,
    y: 80,
    hp: 260,
    maxHp: 260,
    burning: true
  };

  registry.syncAll({
    units: [red],
    collections: {
      sheep: [sheep],
      houses: [house]
    },
    frame: 42
  });

  assert.equal(registry.describe().entityCount, 3);
  assert.equal(registry.describe().counts.unit, 1);
  assert.equal(registry.describe().counts.wildlife, 1);
  assert.equal(registry.get('unit', 1).components.movement.hasPath, true);
  assert.equal(registry.get('house', 'house-1').lifecycle, 'burning');
  const aliveUnits = registry.getAliveUnits();
  assert.equal(aliveUnits.length, 1);
  assert.equal(aliveUnits[0], red);
  assert.equal(registry.query({ selectable: true }).length, 3);

  registry.syncAll({ units: [], collections: {}, frame: 43 });
  assert.equal(registry.describe().entityCount, 0);
});

test('unit component projection can be sourced from the entity registry', () => {
  const context = loadOpenRTSScript('../../ecs/entityManager.js');
  const componentContext = loadOpenRTSScript('../../ecs/unitComponents.js', {
    OpenRTS: context.OpenRTS,
    entityManager: context.entityManager
  });

  const unit = {
    id: 7,
    unitType: 'archer',
    team: 'blue',
    x: 10,
    y: 12,
    size: 18,
    hp: 50,
    maxHp: 72,
    speed: 90,
    fireCooldown: 0.5,
    path: []
  };
  context.entityManager.syncAll({ units: [unit] });
  componentContext.syncUnitComponentsFromUnits([unit]);

  assert.equal(componentContext.UnitComponents.transform.get(7).x, 10);
  assert.equal(componentContext.UnitComponents.combat.get(7).hp, 50);
  assert.equal(componentContext.UnitComponents.movement.get(7).movementType, 'ground');
});
