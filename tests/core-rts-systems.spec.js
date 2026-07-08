import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('resource system supports package-defined resource vocabularies', () => {
  const context = loadOpenRTSScript('../../game/systems/resourceSystem.js');
  const resources = context.OpenRTS.systems.resources;

  resources.configure({
    resources: {
      supplies: { name: 'Supplies', defaultStartingAmount: 10000 },
      power: { name: 'Power', defaultStartingAmount: 0 },
      command_points: { name: 'Command Points', defaultStartingAmount: 1 }
    }
  });
  resources.reset(['blue'], { supplies: 8000, power: 5, command_points: 2 });

  assert.deepEqual(plain(resources.RESOURCE_TYPES), ['supplies', 'power', 'command_points']);
  assert.equal(resources.canAfford('blue', { supplies: 600, power: 4 }), true);
  assert.equal(resources.spend('blue', { supplies: 600, power: 4 }), true);
  assert.deepEqual(plain(resources.get('blue')), { supplies: 7400, power: 1, command_points: 2 });
  assert.deepEqual(plain(resources.set('blue', { supplies: 12000, power: 0, command_points: 3 })), { supplies: 12000, power: 0, command_points: 3 });
  resources.add('blue', 'supplies', 100);
  assert.equal(resources.get('blue').supplies, 12100);
});

test('tech tree system gates production by owned buildings and research', () => {
  const context = loadOpenRTSScript('../../game/systems/TechTreeSystem.js');
  const tree = context.OpenRTS.systems.techTree.createTechTree({
    faction: {
      id: 'coalition',
      techTree: {
        rootBuildings: ['command_hub'],
        unlocks: {
          command_hub: ['builder', 'barracks'],
          barracks: ['rifle_squad', 'war_factory'],
          war_factory: ['battle_tank']
        }
      },
      production: {
        command_hub: { train: ['builder'], research: [] },
        barracks: { train: ['rifle_squad'], research: ['advanced_training'] },
        war_factory: { train: ['battle_tank'], research: [] }
      }
    },
    units: { builder: {}, rifle_squad: {}, battle_tank: {} },
    buildings: { command_hub: {}, barracks: {}, war_factory: {} },
    abilities: { advanced_training: { requires: ['barracks'] } }
  });

  assert.equal(tree.isUnlocked('battle_tank', { ownedBuildings: ['command_hub', 'barracks'] }), false);
  assert.equal(tree.lockedReason('battle_tank', { ownedBuildings: ['command_hub', 'barracks'] }).reason, 'battle_tank is not unlocked by current tech');
  assert.equal(tree.isUnlocked('battle_tank', { ownedBuildings: ['command_hub', 'barracks', 'war_factory'] }), true);
  assert.deepEqual(plain(tree.availableFromProducer('barracks', { ownedBuildings: ['command_hub', 'barracks'] })), {
    train: ['rifle_squad'],
    research: ['advanced_training']
  });
  assert.deepEqual(plain(tree.allAvailable({ ownedBuildings: ['command_hub', 'barracks'] }).units), ['builder', 'rifle_squad']);
});

test('production queue spends resources and completes units or research after duration', () => {
  const context = loadOpenRTSScript('../../game/systems/resourceSystem.js');
  loadOpenRTSScript('../../game/systems/TechTreeSystem.js', context);
  loadOpenRTSScript('../../game/systems/ProductionQueueSystem.js', context);
  const resources = context.OpenRTS.systems.resources;
  resources.configure({ resources: { supplies: { defaultStartingAmount: 1000 } } });
  resources.reset(['blue'], { supplies: 1000 });
  const completed = [];
  const tree = context.OpenRTS.systems.techTree.createTechTree({
    faction: { techTree: { rootBuildings: ['barracks'], unlocks: { barracks: ['rifle_squad', 'advanced_training'] } } },
    units: { rifle_squad: {} },
    abilities: { advanced_training: {} },
    buildings: { barracks: {} }
  });
  const queue = context.OpenRTS.systems.productionQueues.createProductionQueueSystem({
    resources,
    techTree: tree,
    units: { rifle_squad: { cost: { supplies: 200 }, trainTime: 2 } },
    abilities: { advanced_training: { cost: { supplies: 100 }, researchTime: 1 } },
    spawnUnit: item => ({ unitType: item.targetId, team: item.team }),
    completeResearch: item => ({ research: item.targetId }),
    onComplete: item => completed.push(item.targetId)
  });

  const unitResult = queue.enqueue({
    producerId: 'barracks-1',
    team: 'blue',
    kind: 'unit',
    id: 'rifle_squad',
    state: { ownedBuildings: ['barracks'] }
  });
  const researchResult = queue.enqueue({
    producerId: 'lab-1',
    team: 'blue',
    kind: 'research',
    id: 'advanced_training',
    state: { ownedBuildings: ['barracks'] }
  });

  assert.equal(unitResult.accepted, true);
  assert.equal(researchResult.accepted, true);
  assert.equal(resources.get('blue').supplies, 700);
  assert.equal(queue.progress('barracks-1')[0].progress, 0);
  assert.deepEqual(plain(queue.update(1).map(item => item.targetId)), ['advanced_training']);
  assert.deepEqual(plain(queue.update(1).map(item => item.targetId)), ['rifle_squad']);
  assert.deepEqual(completed, ['advanced_training', 'rifle_squad']);

  const cancelResult = queue.enqueue({
    producerId: 'barracks-1',
    team: 'blue',
    kind: 'unit',
    id: 'rifle_squad',
    state: { ownedBuildings: ['barracks'] }
  });
  assert.equal(resources.get('blue').supplies, 500);
  assert.equal(queue.cancel('barracks-1', cancelResult.item.id).accepted, true);
  assert.equal(resources.get('blue').supplies, 700);
});

test('ability effect system applies damage heal buffs and custom handlers', () => {
  const context = loadOpenRTSScript('../../game/systems/resourceSystem.js');
  loadOpenRTSScript('../../game/systems/AbilityEffectSystem.js', context);
  const target = { id: 'target', hp: 50, maxHp: 100 };
  const calls = [];
  const result = context.OpenRTS.systems.abilityEffects.applyAbility({
    id: 'battle_drug',
    effects: [
      { type: 'damage', damage: 10 },
      { type: 'heal', amount: 25 },
      { type: 'buff', stat: 'speed', amount: 0.2, duration: 5 },
      { type: 'reveal', duration: 3 }
    ]
  }, {
    target,
    getDamageMultiplier: () => 1.5,
    handlers: {
      reveal: effect => calls.push(effect.duration)
    }
  });

  assert.equal(target.hp, 60);
  assert.deepEqual(plain(target.modifiers), [{ type: 'buff', stat: 'speed', amount: 0.2, duration: 5, sourceId: null }]);
  assert.deepEqual(calls, [3]);
  assert.deepEqual(plain(result.applied.map(effect => effect.type)), ['damage', 'heal', 'buff', 'reveal']);

  const resources = context.OpenRTS.systems.resources;
  resources.configure({ resources: { energy: { defaultStartingAmount: 50 } } });
  resources.reset(['blue'], { energy: 50 });
  const cooldowns = context.OpenRTS.systems.abilityEffects.createCooldownTracker();
  const ability = { id: 'scan', cooldown: 10, cost: { energy: 20 } };

  assert.equal(cooldowns.spendAndStart('caster-1', ability, { now: 5, resources, team: 'blue' }).accepted, true);
  assert.equal(resources.get('blue').energy, 30);
  assert.equal(cooldowns.canCast('caster-1', ability, { now: 8, resources, team: 'blue' }).accepted, false);
  assert.equal(cooldowns.remaining('caster-1', 'scan', 8), 7);
  assert.equal(cooldowns.canCast('caster-1', ability, { now: 16, resources, team: 'blue' }).accepted, true);
});
