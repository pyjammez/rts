import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadUnitClass() {
  const commandTypesSource = fs.readFileSync(new URL('../entities/UnitCommandTypes.js', import.meta.url), 'utf8');
  const stateFactorySource = fs.readFileSync(new URL('../entities/UnitStateFactory.js', import.meta.url), 'utf8');
  const commandStateSource = fs.readFileSync(new URL('../entities/UnitCommandStateService.js', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../entities/unit.js', import.meta.url), 'utf8');
  const unitSource = source.split('// --- Bullets ---')[0];
  let dropped = null;
  const context = {
    console,
    Math,
    tileSize: 32,
    units: [],
    findNearestWalkablePoint: (x, y) => ({ x, y }),
    findPath: (_start, goal) => [goal],
    smoothPath: path => path,
    removeCarryableWorldObject: item => {
      item.isPickedUp = true;
      return true;
    },
    dropCarriedItem: (item, x, y) => {
      dropped = { item, x, y };
      return true;
    }
  };
  context.globalThis = context;
  vm.runInNewContext(`${commandTypesSource}\n${stateFactorySource}\n${commandStateSource}\n${unitSource}\nglobalThis.UnitForTest = Unit;`, context);
  return { Unit: context.UnitForTest, getDropped: () => dropped };
}

test('units collect and drop explicitly targeted items after reaching them', () => {
  const { Unit, getDropped } = loadUnitClass();
  const unit = new Unit({ id: 1, x: 0, y: 0, team: 'red', hp: 100, speed: 80 });
  const tree = {
    id: 'tree-1',
    itemId: 'tree',
    objectType: 'obstacle',
    obstacleType: 1,
    displayName: 'Oak Tree',
    description: 'Tree',
    x: 160,
    y: 96,
    size: 42,
    pickupable: true,
    isPickedUp: false,
    isDead: false
  };

  assert.equal(unit.issuePickupCommand(tree), true);
  assert.equal(unit.inventoryItem, null);
  assert.equal(unit.pendingPickupItem, tree);
  assert.equal(unit.processPendingItemAction(), false);

  unit.x = 145;
  unit.y = 96;
  assert.equal(unit.processPendingItemAction(), true);
  assert.equal(unit.inventoryItem.name, 'Oak Tree');
  assert.equal(tree.isPickedUp, true);

  assert.equal(unit.issueDropItemCommand(320, 224), true);
  assert.equal(unit.pendingDropPoint.x, 320);
  assert.equal(unit.pendingDropPoint.y, 224);
  assert.equal(unit.processPendingItemAction(), false);

  unit.x = 320;
  unit.y = 224;
  assert.equal(unit.processPendingItemAction(), true);
  assert.equal(unit.inventoryItem, null);
  assert.equal(getDropped().x, 320);
  assert.equal(getDropped().y, 224);
});
