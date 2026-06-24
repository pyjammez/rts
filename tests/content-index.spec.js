import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function createIndex() {
  const context = loadOpenRTSScript('../../game/config/ContentIndex.js');
  return context.OpenRTS.config.createContentIndex({
    abilities: {
      heal: { id: 'heal', name: 'Heal', type: 'active', tags: ['support'] },
      bash: { id: 'bash', name: 'Bash', type: 'passive', tags: ['melee'] }
    },
    weapons: {
      sword: { id: 'sword', name: 'Sword', damage: 9, range: 48, melee: true },
      rifle: { id: 'rifle', name: 'Rifle', damage: 15, range: 210 }
    },
    rulesets: {
      modern_rules: {
        id: 'modern_rules',
        name: 'Modern Rules',
        damageTypes: {
          kinetic: { name: 'Kinetic', modifiers: { light: 1.1, armored: 0.8 } }
        },
        armorTags: {
          light: { name: 'Light' },
          armored: { name: 'Armored' }
        }
      }
    },
    factions: {
      modern: {
        id: 'modern',
        name: 'Modern',
        ruleset: 'modern_rules',
        units: ['rifleman'],
        buildings: ['home']
      }
    },
    units: {
      soldier: {
        id: 'soldier',
        name: 'Soldier',
        hp: 100,
        speed: 100,
        size: 20,
        weapon: 'sword',
        role: 'Sword infantry',
        era: 'medieval',
        pack: 'core',
        packName: 'Core Units',
        tags: ['melee'],
        abilities: ['bash']
      },
      rifleman: {
        id: 'rifleman',
        name: 'Rifleman',
        hp: 85,
        speed: 105,
        size: 19,
        weapon: 'rifle',
        role: 'Modern line infantry',
        era: 'modern',
        pack: 'modern',
        packName: 'Modern Pack',
        tags: ['ranged']
      },
      medic: {
        id: 'medic',
        name: 'Field Medic',
        hp: 70,
        speed: 110,
        size: 18,
        role: 'Support healer',
        era: 'modern',
        pack: 'modern',
        packName: 'Modern Pack',
        abilities: ['heal']
      }
    },
    buildings: {
      home: { id: 'home', name: 'Castle' }
    },
    terrainPresets: {
      grass: { id: 'grass', name: 'Grass' }
    },
    modes: {
      versus: { id: 'versus', name: 'Versus' }
    }
  });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('content index resolves unit combat stats and ability definitions', () => {
  const index = createIndex();
  const soldier = index.getUnit('soldier');
  const medic = index.getUnit('medic');

  assert.equal(soldier.damage, 9);
  assert.equal(soldier.weaponName, 'Sword');
  assert.equal(soldier.melee, true);
  assert.equal(soldier.abilityDefinitions[0].name, 'Bash');
  assert.equal(medic.damage, 8);
  assert.equal(medic.abilityDefinitions[0].name, 'Heal');
});

test('content index searches large catalogs by query and facets', () => {
  const index = createIndex();

  assert.deepEqual(plain(index.searchUnits({ query: 'rifle' }).map(unit => unit.id)), ['rifleman']);
  assert.deepEqual(plain(index.searchUnits({ era: 'modern' }).map(unit => unit.id)), ['medic', 'rifleman']);
  assert.deepEqual(plain(index.searchUnits({ pack: 'modern', query: 'support' }).map(unit => unit.id)), ['medic']);
  assert.deepEqual(plain(index.listUnits({ allowedIds: ['soldier', 'medic'] }).map(unit => unit.id)), ['soldier', 'medic']);
});

test('content index exposes stable catalog diagnostics and facets', () => {
  const index = createIndex();
  const description = index.describe();

  assert.equal(description.schemaVersion, 1);
  assert.equal(description.counts.units, 3);
  assert.equal(description.counts.rulesets, 1);
  assert.equal(description.counts.factions, 1);
  assert.deepEqual(plain(description.facets.eras), ['medieval', 'modern']);
  assert.deepEqual(plain(description.facets.packs), [
    { id: 'core', name: 'Core Units' },
    { id: 'modern', name: 'Modern Pack' }
  ]);
  assert.deepEqual(plain(description.facets.weapons), [
    { id: 'rifle', name: 'Rifle' },
    { id: 'sword', name: 'Sword' }
  ]);
});

test('content index exposes factions rulesets and damage modifiers for modded RTS rules', () => {
  const index = createIndex();

  assert.equal(index.getRuleset('modern_rules').name, 'Modern Rules');
  assert.equal(index.getFaction('modern').ruleset, 'modern_rules');
  assert.deepEqual(plain(index.listFactions().map(faction => faction.id)), ['modern']);
  assert.equal(index.getDamageMultiplier({
    rulesetId: 'modern_rules',
    damageType: 'kinetic',
    armorTags: ['light', 'armored']
  }), 0.8800000000000001);
});
