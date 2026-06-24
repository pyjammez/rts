import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function loadAiContext() {
  let context = loadOpenRTSScript('../../core/openRts.js');
  context = loadOpenRTSScript('../../core/events/eventBus.js', context);
  context = loadOpenRTSScript('../../game/commands/CommandBus.js', context);
  context = loadOpenRTSScript('../../game/ai/data/aiProfiles.js', context);
  context = loadOpenRTSScript('../../game/ai/core/Blackboard.js', context);
  context = loadOpenRTSScript('../../game/ai/tactics/TargetSelector.js', context);
  context = loadOpenRTSScript('../../game/ai/tactics/SquadController.js', context);
  context = loadOpenRTSScript('../../game/ai/strategies/BalancedStrategy.js', context);
  context = loadOpenRTSScript('../../game/ai/strategies/RushStrategy.js', context);
  context = loadOpenRTSScript('../../game/ai/strategies/TurtleStrategy.js', context);
  context = loadOpenRTSScript('../../game/ai/planners/DefensePlanner.js', context);
  context = loadOpenRTSScript('../../game/ai/planners/AttackPlanner.js', context);
  context = loadOpenRTSScript('../../game/ai/planners/ArmyPlanner.js', context);
  context = loadOpenRTSScript('../../game/ai/planners/EconomyPlanner.js', context);
  context = loadOpenRTSScript('../../game/ai/core/AIBrain.js', context);
  context = loadOpenRTSScript('../../game/ai/core/AIPlayer.js', context);
  context = loadOpenRTSScript('../../game/systems/skirmishAiSystem.js', context);
  return context;
}

test('skirmish AI submits attacks through the authoritative command bus', () => {
  const context = loadAiContext();
  const commands = [];
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.ATTACK, command => {
    commands.push(command);
    return true;
  });

  context.mapConfig = {
    modeId: 'versus',
    playerSlots: [
      { controller: 'human', flag: 'red' },
      { controller: 'ai', flag: 'blue' }
    ]
  };

  context.OpenRTS.systems.skirmishAi.update(2, {
    units: [
      { id: 1, team: 'blue', x: 0, y: 0, isDead: false, path: [] },
      { id: 2, team: 'red', x: 100, y: 0, isDead: false }
    ],
    buildings: []
  }, {
    commands: context.OpenRTS.commands
  });

  assert.equal(context.OpenRTS.commands.getPending().length, 1);
  context.OpenRTS.commands.process(1, {});
  assert.equal(commands.length, 1);
  assert.equal(commands[0].playerId, 'ai-blue');
  assert.equal(commands[0].payload.targetKind, 'unit');
  assert.equal(commands[0].payload.targetId, 2);
});

test('skirmish AI prioritizes defending its castle from nearby attackers', () => {
  const context = loadAiContext();
  const attacks = [];
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.ATTACK, command => {
    attacks.push(command);
    return true;
  });
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.CASTLE_RAMPART, () => true);
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.CASTLE_UPGRADE, () => true);

  context.mapConfig = {
    modeId: 'versus',
    playerSlots: [
      { controller: 'human', flag: 'red' },
      { controller: 'ai', flag: 'blue' }
    ]
  };

  context.OpenRTS.systems.skirmishAi.update(2, {
    units: [
      { id: 1, team: 'blue', unitType: 'soldier', x: 110, y: 100, hp: 100, isDead: false, path: [] },
      { id: 2, team: 'red', unitType: 'soldier', x: 125, y: 100, hp: 100, isDead: false }
    ],
    buildings: [
      { id: 10, team: 'blue', type: 'home', x: 100, y: 100, upgradeLevel: 3, isDead: false },
      { id: 11, team: 'red', type: 'home', x: 900, y: 100, isDead: false }
    ]
  }, {
    commands: context.OpenRTS.commands
  });

  context.OpenRTS.commands.process(1, {});
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].payload.targetKind, 'unit');
  assert.equal(attacks[0].payload.targetId, 2);
  assert.equal(context.OpenRTS.systems.skirmishAi.getDebugState()[0].lastPlan, 'defend');
});

test('skirmish AI prepares its castle with ranged rampart defenders and king upgrades', () => {
  const context = loadAiContext();
  const ramparts = [];
  const upgrades = [];
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.ATTACK, () => true);
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.CASTLE_RAMPART, command => {
    ramparts.push(command);
    return true;
  });
  context.OpenRTS.commands.register(context.OpenRTS.commands.types.CASTLE_UPGRADE, command => {
    upgrades.push(command);
    return true;
  });

  context.mapConfig = {
    modeId: 'versus',
    playerSlots: [
      { controller: 'human', flag: 'red' },
      { controller: 'ai', flag: 'blue' }
    ]
  };

  context.OpenRTS.systems.skirmishAi.update(2, {
    units: [
      { id: 1, team: 'blue', unitType: 'king', x: 100, y: 100, hp: 180, isDead: false, path: [] },
      { id: 2, team: 'blue', unitType: 'archer', x: 120, y: 100, hp: 72, shootRange: 180, melee: false, isDead: false, path: [] },
      { id: 3, team: 'blue', unitType: 'crossbowman', x: 130, y: 100, hp: 92, shootRange: 170, melee: false, isDead: false, path: [] },
      { id: 4, team: 'red', unitType: 'soldier', x: 900, y: 100, hp: 100, isDead: false }
    ],
    buildings: [
      { id: 10, team: 'blue', type: 'home', x: 100, y: 100, upgradeLevel: 0, isDead: false },
      { id: 11, team: 'red', type: 'home', x: 900, y: 100, isDead: false }
    ]
  }, {
    commands: context.OpenRTS.commands
  });

  context.OpenRTS.commands.process(1, {});
  assert.equal(ramparts.length, 2);
  assert.equal(upgrades.length, 1);
  assert.deepEqual(ramparts.map(command => command.payload.unitId), [2, 3]);
  assert.equal(upgrades[0].payload.kingId, 1);
});
