import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

test('configured rosters cannot create more than one required king', () => {
  const source = fs.readFileSync(new URL('../world/gameState.js', import.meta.url), 'utf8');
  const start = source.indexOf('function getConfiguredUnitRoster');
  const end = source.indexOf('function createConfiguredUnit', start);
  const context = {
    getActiveModeConfig: () => ({}),
    getUnitDefinition: type => type === 'king'
      ? { maxPerTeam: 1, requiredPerTeam: true }
      : {},
    getGameModeDefinition: () => ({ allowedUnits: ['king', 'soldier'] })
  };
  context.globalThis = context;
  vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.getRoster = getConfiguredUnitRoster;`, context);

  const roster = context.getRoster({
    modeId: 'versus',
    unitRoster: { king: 12, soldier: 3 }
  });
  assert.equal(roster.king, 1);
  assert.equal(roster.soldier, 3);
});

test('a team loses when its original king dies', () => {
  const context = loadOpenRTSScript('../../game/rules/matchRules.js');
  const result = context.OpenRTS.rules.match.evaluate({
    active: true,
    finished: false,
    teams: ['red', 'blue'],
    initialHomesByTeam: { red: 0, blue: 0 },
    initialKingsByTeam: { red: 1, blue: 1 },
    buildings: [],
    aliveUnits: [
      { team: 'red', unitType: 'soldier', isDead: false },
      { team: 'blue', unitType: 'king', isDead: false }
    ]
  });
  assert.equal(result.loser, 'red');
  assert.equal(result.winner, 'blue');
  assert.match(result.reason, /king has fallen/i);
});

test('a team loses when its defeat-critical commander dies', () => {
  const context = loadOpenRTSScript('../../game/rules/matchRules.js');
  const result = context.OpenRTS.rules.match.evaluate({
    active: true,
    finished: false,
    teams: ['red', 'blue'],
    initialHomesByTeam: { red: 0, blue: 0 },
    initialKingsByTeam: { red: 1, blue: 1 },
    initialDefeatCriticalLabelsByTeam: { red: 'Armored Commander', blue: 'Armored Commander' },
    buildings: [],
    aliveUnits: [
      { team: 'red', unitType: 'ue_raider', isDead: false },
      { team: 'blue', unitType: 'ue_commander', defeatCritical: true, isDead: false }
    ]
  });

  assert.equal(result.loser, 'red');
  assert.equal(result.winner, 'blue');
  assert.match(result.reason, /armored commander has fallen/i);
});

test('a king can upgrade only a friendly castle three times', () => {
  const context = loadOpenRTSScript('../../game/systems/castleUpgradeSystem.js');
  const upgrades = context.OpenRTS.systems.castleUpgrades;

  const king = { team: 'red', unitType: 'king', isDead: false };
  const castle = {
    team: 'red', type: 'home', isDead: false,
    hp: 800, maxHp: 1250, damage: 11, range: 360, attackCooldown: 1.05,
    upgradeLevel: 0, maxUpgradeLevel: 3
  };
  assert.equal(upgrades.upgrade(castle, king), true);
  assert.equal(upgrades.upgrade(castle, king), true);
  assert.equal(upgrades.upgrade(castle, king), true);
  assert.equal(upgrades.upgrade(castle, king), false);
  assert.equal(castle.upgradeLevel, 3);
  assert.equal(castle.maxHp, 2000);
  assert.equal(castle.damage, 20);
  assert.equal(castle.range, 450);
  assert.equal(upgrades.upgrade({ ...castle, team: 'blue', upgradeLevel: 0 }, king), false);
});
