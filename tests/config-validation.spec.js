import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContentData } from '../tools/configValidation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('default content manifest and catalogs validate cleanly', () => {
  const content = loadContent({ root });
  const result = validateContentData(content, { root });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.contentVersion, content.manifest.contentVersion);
  assert.equal(result.summary.catalogUnits > result.summary.baseUnits, true);
  assert.equal(result.summary.rulesets >= 2, true);
  assert.equal(result.summary.factions >= 2, true);
  assert.equal(result.summary.modes, 4);
});

test('prelaunch sample game package folders exist with valid manifests', () => {
  const expectedPackages = [
    'spacesiege',
    'battleforge',
    'modern_warlord',
    'ultimate_extinction',
    'era_of_kingdoms'
  ];

  for (const packageId of expectedPackages) {
    const packageRoot = path.join(root, 'games', packageId);
    const manifestPath = path.join(packageRoot, 'manifest.json');
    assert.equal(fs.existsSync(manifestPath), true, `${packageId} needs a manifest`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.id, packageId);
    assert.equal(manifest.schemaVersion, 1);
    assert.match(manifest.version, /^\d+\.\d+\.\d+/);
    for (const filePath of Object.values(manifest.files || {})) {
      assert.equal(fs.existsSync(path.join(packageRoot, filePath)), true, `${packageId} missing ${filePath}`);
    }
  }
});

test('static game package index lists every prelaunch sample package', () => {
  const indexPath = path.join(root, 'games', 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const ids = new Set(index.packages.map(entry => entry.id));
  const expectedPackages = [
    'spacesiege',
    'battleforge',
    'modern_warlord',
    'ultimate_extinction',
    'era_of_kingdoms'
  ];

  assert.equal(index.schemaVersion, 1);
  for (const packageId of expectedPackages) {
    assert.equal(ids.has(packageId), true, `games/index.json must list ${packageId}`);
    const entry = index.packages.find(candidate => candidate.id === packageId);
    assert.equal(fs.existsSync(path.join(root, 'games', entry.manifest)), true, `${packageId} manifest path must exist`);
  }
});

test('sample game packages define theme-specific factions', () => {
  const expectedFactionNames = {
    spacesiege: ['Humans', 'Cybernetic', 'Aliens'],
    modern_warlord: ['United Coalition', 'Eastern Federation', 'Insurgent Network'],
    era_of_kingdoms: ['River Crown', 'Highland Realm', 'Steppe Khans'],
    battleforge: ['Crown Alliance', 'Iron Horde', 'Moonwood Sentinels', 'Gravebound'],
    ultimate_extinction: ['Core Directive', 'Arm Vanguard', 'Frontier Machine']
  };

  for (const [packageId, names] of Object.entries(expectedFactionNames)) {
    const factions = JSON.parse(fs.readFileSync(path.join(root, 'games', packageId, 'factions.json'), 'utf8'));
    const actualNames = new Set(Object.values(factions).map(faction => faction.name));
    for (const name of names) {
      assert.equal(actualNames.has(name), true, `${packageId} must define ${name}`);
    }
    assert.equal(Object.values(factions).every(faction => Array.isArray(faction.units) && faction.units.length > 0), true);
  }
});

test('starsiege defines an asymmetric starcraft-like sci-fi tech structure', () => {
  const packageRoot = path.join(root, 'games', 'spacesiege');
  const units = JSON.parse(fs.readFileSync(path.join(packageRoot, 'units.json'), 'utf8'));
  const buildings = JSON.parse(fs.readFileSync(path.join(packageRoot, 'buildings.json'), 'utf8'));
  const factions = JSON.parse(fs.readFileSync(path.join(packageRoot, 'factions.json'), 'utf8'));
  const modes = JSON.parse(fs.readFileSync(path.join(packageRoot, 'game-modes.json'), 'utf8'));
  const rules = JSON.parse(fs.readFileSync(path.join(packageRoot, 'rulesets.json'), 'utf8')).spacesiege_rules;
  const mapSource = fs.readFileSync(path.join(root, 'world', 'map.js'), 'utf8');

  for (const unitId of [
    'ss_human_engineer',
    'ss_human_siege_tank',
    'ss_human_battlecruiser',
    'ss_cyber_probe',
    'ss_cyber_reaver',
    'ss_cyber_carrier',
    'ss_alien_drone',
    'ss_alien_ripper',
    'ss_alien_behemoth'
  ]) {
    assert.ok(units[unitId], `spacesiege must define ${unitId}`);
  }

  for (const buildingId of [
    'ss_human_command_hub',
    'ss_human_barracks',
    'ss_human_factory',
    'ss_human_starport',
    'ss_cyber_nexus',
    'ss_cyber_gateway',
    'ss_cyber_stargate',
    'ss_alien_hive',
    'ss_alien_spawning_pool',
    'ss_alien_spire'
  ]) {
    assert.ok(buildings[buildingId], `spacesiege must define ${buildingId}`);
  }

  assert.equal(Object.keys(units).length >= 22, true);
  assert.equal(Object.keys(buildings).length >= 25, true);
  assert.equal(factions.ss_humans.startingBuildings.ss_human_command_hub, 1);
  assert.equal(factions.ss_cybernetic.startingBuildings.ss_cyber_nexus, 1);
  assert.equal(factions.ss_aliens.startingBuildings.ss_alien_hive, 1);
  assert.equal(buildings.ss_human_command_hub.hqStyle, 'command_center');
  assert.equal(buildings.ss_human_command_hub.mobility.canLiftOff, true);
  assert.equal(buildings.ss_human_command_hub.mobility.canLand, true);
  assert.equal(buildings.ss_human_command_hub.tags.includes('liftable'), true);
  assert.equal(buildings.ss_cyber_nexus.hqStyle, 'nexus');
  assert.equal(buildings.ss_alien_hive.hqStyle, 'hatchery');
  assert.match(buildings.ss_human_command_hub.name, /Command Center/);
  assert.match(buildings.ss_alien_hive.name, /Hatchery/);
  assert.equal(factions.ss_humans.production.ss_human_starport.train.includes('ss_human_battlecruiser'), true);
  assert.equal(factions.ss_cybernetic.techTree.unlocks.ss_cyber_core.includes('ss_cyber_stargate'), true);
  assert.equal(factions.ss_aliens.techTree.unlocks.ss_alien_spawning_pool.includes('ss_alien_hydra_den'), true);
  assert.equal(modes.spacesiege_versus.allowedUnits.length, Object.keys(units).length);
  assert.equal(rules.damageTypes.biological.name, 'Biological');
  assert.match(mapSource, /function isStarSiegeBuilding/);
  assert.match(mapSource, /function drawStarSiegeBuilding/);
  assert.ok(
    mapSource.indexOf('if (isStarSiegeBuilding(building))') < mapSource.indexOf("if (building.type === BUILDING_TYPES.HOME && layer === 'base')"),
    'StarSiege buildings must bypass the generic home base renderer before castle/home routing runs'
  );
  assert.match(mapSource, /function drawStarSiegeCommandCenterBase/);
  assert.match(mapSource, /const stadiumY = top \+ h \* 0\.66/);
  assert.match(mapSource, /const domeCrownY = top \+ h \* 0\.2/);
  assert.match(mapSource, /ctx\.ellipse\(0, stadiumY, w \* 0\.48, h \* 0\.22/);
  assert.match(mapSource, /#f8faf7/);
  assert.match(mapSource, /#c9d0d0/);
  assert.match(mapSource, /ctx\.fillRect\(left \+ w \* wx - w \* 0\.018, top \+ h \* 0\.575/);
  assert.match(mapSource, /ctx\.ellipse\(0, top \+ h \* 0\.69, w \* 0\.16, h \* 0\.06/);
  assert.match(mapSource, /function drawStarSiegeNexusBase/);
  assert.match(mapSource, /function drawStarSiegeHatcheryBase/);
});

test('era of kingdoms includes arabia and defaults to a green forest lake valley', () => {
  const terrainPresets = JSON.parse(fs.readFileSync(path.join(root, 'games', 'era_of_kingdoms', 'terrain-presets.json'), 'utf8'));
  const modes = JSON.parse(fs.readFileSync(path.join(root, 'games', 'era_of_kingdoms', 'game-modes.json'), 'utf8'));
  const arabia = terrainPresets.eok_arabia;
  const valley = terrainPresets.temperate_valley;
  const versus = modes.era_of_kingdoms_versus;

  assert.equal(arabia.visualStyle, 'arabia_dryland');
  assert.equal(arabia.waterLevel, 0);
  assert.equal(arabia.treeCount >= 120, true);
  assert.equal(arabia.goldMineCount >= 8, true);
  assert.equal(valley.visualStyle, 'temperate_kingdom');
  assert.equal(valley.treeCount >= 120, true);
  assert.equal(valley.waterLevel > 0, true);
  assert.equal(versus.defaults.mapStyle, 'temperate_valley');
  assert.equal(versus.defaults.visualStyle, 'temperate_kingdom');
  assert.equal(versus.defaults.generatedLandscape, 'lakes');
});

test('theme map defaults keep animals and neutral houses theme-specific', () => {
  const packages = ['spacesiege', 'battleforge', 'modern_warlord', 'ultimate_extinction', 'era_of_kingdoms'];

  for (const packageId of packages) {
    const packageRoot = path.join(root, 'games', packageId);
    const terrainPresets = JSON.parse(fs.readFileSync(path.join(packageRoot, 'terrain-presets.json'), 'utf8'));
    const modes = JSON.parse(fs.readFileSync(path.join(packageRoot, 'game-modes.json'), 'utf8'));
    const mapRecords = [
      ...Object.values(terrainPresets),
      ...Object.values(modes).map(mode => mode.defaults || {})
    ];

    for (const record of mapRecords) {
      const sheep = Number(record.sheepCount) || 0;
      const ducks = Number(record.duckCount) || 0;
      const houses = Number(record.houseCount) || 0;
      if (packageId !== 'era_of_kingdoms') {
        assert.equal(sheep, 0, `${packageId} must not start with sheep`);
        assert.equal(ducks, 0, `${packageId} must not start with ducks`);
      }
      if (packageId !== 'modern_warlord') {
        assert.equal(houses, 0, `${packageId} must not start with neutral houses`);
      }
    }
  }
});

test('sample themes start with stereotype-matching map styles', () => {
  const expectations = {
    spacesiege: {
      mode: 'spacesiege_versus',
      mapStyle: 'muddy_badlands',
      visualStyle: 'muddy_badlands',
      generatedLandscape: 'cliffs',
      generatedTerrain: 'swamp'
    },
    battleforge: {
      mode: 'battleforge_versus',
      mapStyle: 'enchanted_forest',
      visualStyle: 'fantasy_forest',
      generatedLandscape: 'forest',
      generatedTerrain: 'grass'
    },
    modern_warlord: {
      mode: 'modern_warlord_versus',
      mapStyle: 'dry_oil_basin',
      visualStyle: 'industrial_desert',
      generatedLandscape: 'hilly',
      generatedTerrain: 'desert'
    },
    ultimate_extinction: {
      mode: 'ultimate_extinction_versus',
      mapStyle: 'metal_plateau',
      visualStyle: 'metal_wasteland',
      generatedLandscape: 'flat',
      generatedTerrain: 'metal',
      waterLevel: 0
    },
    era_of_kingdoms: {
      mode: 'era_of_kingdoms_versus',
      mapStyle: 'temperate_valley',
      visualStyle: 'temperate_kingdom',
      generatedLandscape: 'lakes',
      generatedTerrain: 'grass'
    }
  };

  const packageIndex = JSON.parse(fs.readFileSync(path.join(root, 'games', 'index.json'), 'utf8'));
  assert.equal(packageIndex.packages.find(entry => entry.id === 'ultimate_extinction').name, 'Total Destruction');

  for (const [packageId, expected] of Object.entries(expectations)) {
    const modes = JSON.parse(fs.readFileSync(path.join(root, 'games', packageId, 'game-modes.json'), 'utf8'));
    const presets = JSON.parse(fs.readFileSync(path.join(root, 'games', packageId, 'terrain-presets.json'), 'utf8'));
    const defaults = modes[expected.mode].defaults;
    assert.equal(defaults.mapStyle, expected.mapStyle, `${packageId} should default to its themed map preset`);
    assert.equal(defaults.visualStyle, expected.visualStyle, `${packageId} should default to its themed visual style`);
    assert.equal(defaults.generatedLandscape, expected.generatedLandscape, `${packageId} should default to its expected landscape`);
    assert.equal(defaults.generatedTerrain, expected.generatedTerrain, `${packageId} should default to its expected terrain`);
    assert.equal(presets[expected.mapStyle].visualStyle, expected.visualStyle, `${packageId} preset should match visual style`);
    if (Number.isFinite(expected.waterLevel)) assert.equal(defaults.waterLevel, expected.waterLevel);
  }
});

test('versus start policy places default 1v1 teams on opposite map sides', () => {
  const mapSource = fs.readFileSync(path.join(root, 'world', 'map.js'), 'utf8');

  assert.match(mapSource, /function getTeamStartRatio/);
  assert.match(mapSource, /function shouldUseGeneratedStartRatios/);
  assert.match(mapSource, /function twoPlayerSideStartRatios/);
  assert.match(mapSource, /if \(count === 2\) return twoPlayerSideStartRatios\(\)\[teamIndex % 2\]/);
  assert.match(mapSource, /'1v1': \[\[0\.18, 0\.5\], \[0\.82, 0\.5\]\]/);
  assert.match(mapSource, /'default_large'/);
  assert.match(mapSource, /const generatedRatio = getTeamStartRatio\(teamIndex, teams\.length, config\)/);
  assert.match(mapSource, /const ratio = getTeamStartRatio\(teamIndex, teamCount, config\)/);
});

test('modern warlord defines a full modern base-war unit and building roster', () => {
  const packageRoot = path.join(root, 'games', 'modern_warlord');
  const units = JSON.parse(fs.readFileSync(path.join(packageRoot, 'units.json'), 'utf8'));
  const buildings = JSON.parse(fs.readFileSync(path.join(packageRoot, 'buildings.json'), 'utf8'));
  const factions = JSON.parse(fs.readFileSync(path.join(packageRoot, 'factions.json'), 'utf8'));
  const modes = JSON.parse(fs.readFileSync(path.join(packageRoot, 'game-modes.json'), 'utf8'));
  const rules = JSON.parse(fs.readFileSync(path.join(packageRoot, 'rulesets.json'), 'utf8')).modern_warlord_rules;

  for (const unitId of [
    'mw_dozer',
    'mw_worker_cell',
    'mw_missile_squad',
    'mw_commando',
    'mw_heavy_tank',
    'mw_artillery',
    'mw_aa_vehicle',
    'mw_technical',
    'mw_quad_truck',
    'mw_combat_drone'
  ]) {
    assert.ok(units[unitId], `modern_warlord must define ${unitId}`);
  }

  for (const buildingId of [
    'mw_command_center',
    'mw_reactor',
    'mw_supply_center',
    'mw_barracks',
    'mw_war_factory',
    'mw_airfield',
    'mw_strategy_center',
    'mw_missile_battery',
    'mw_tunnel_network'
  ]) {
    assert.ok(buildings[buildingId], `modern_warlord must define ${buildingId}`);
  }

  assert.equal(Object.keys(units).length >= 16, true);
  assert.equal(Object.keys(buildings).length >= 10, true);
  assert.equal(units.mw_dozer.model, 'construction_dozer');
  assert.deepEqual(factions.mw_united_coalition.units.includes('mw_gunship'), true);
  assert.deepEqual(factions.mw_eastern_federation.units.includes('mw_heavy_tank'), true);
  assert.deepEqual(factions.mw_insurgent_network.units.includes('mw_technical'), true);
  assert.equal(factions.mw_insurgent_network.buildings.includes('mw_tunnel_network'), true);
  assert.equal(factions.mw_united_coalition.buildings.includes('mw_airfield'), true);
  assert.equal(modes.modern_warlord_versus.allowedUnits.length, Object.keys(units).length);
  assert.equal(modes.modern_warlord_versus.defaults.mapStyle, 'dry_oil_basin');
  assert.equal(modes.modern_warlord_versus.defaults.unitRoster.mw_dozer >= 3, true);
  assert.equal(factions.mw_united_coalition.startingUnits.mw_dozer >= 3, true);
  assert.equal(factions.mw_eastern_federation.startingUnits.mw_dozer >= 3, true);
  assert.equal(factions.mw_insurgent_network.startingUnits.mw_worker_cell >= 4, true);
  assert.ok(rules.damageTypes.explosive);
  assert.ok(rules.effectTypes.supply_drop);
});

test('terrain preset setup preserves package preset ids without embedded id fields', () => {
  const configSource = fs.readFileSync(path.join(root, 'ui', 'config.js'), 'utf8');
  const terrainPresets = JSON.parse(fs.readFileSync(path.join(root, 'games', 'era_of_kingdoms', 'terrain-presets.json'), 'utf8'));

  assert.equal(terrainPresets.eok_arabia.id, undefined);
  assert.match(configSource, /Object\.entries\(TERRAIN_PRESETS\)/);
  assert.match(configSource, /value:\s*preset\.id\s*\|\|\s*id/);
  assert.match(configSource, /mapConfig\.mapStyle\s*=\s*preset\.id\s*\|\|\s*presetId/);
});

test('content validation catches broken cross-catalog references', () => {
  const content = clone(loadContent({ root }));
  content.units.worker.abilities = ['missing_ability'];
  content.modes.versus.defaults.unitRoster.king = 2;
  content.buildings.tower.weapon = 'missing_weapon';
  content.factions.kingdoms.ruleset = 'missing_ruleset';
  content.factions.kingdoms.production.home.train = ['missing_unit'];
  content.units.worker.cost = { missing_money: -5 };
  content.abilities.heal.cost = 'free';

  const result = validateContentData(content, { root });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unit "worker" references unknown id "missing_ability"/);
  assert.match(result.errors.join('\n'), /mode "versus" roster requests 2 king units; maximum is 1/);
  assert.match(result.errors.join('\n'), /building "tower" references unknown id "missing_weapon"/);
  assert.match(result.errors.join('\n'), /faction "kingdoms" references unknown id "missing_ruleset"/);
  assert.match(result.errors.join('\n'), /faction "kingdoms" production "home" train references unknown id "missing_unit"/);
  assert.match(result.errors.join('\n'), /unit "worker" cost missing_money amount must be at least 0/);
  assert.match(result.errors.join('\n'), /ability "heal" cost must be an object keyed by resource id/);
});

test('content validation rejects unsafe manifest paths and malformed ids', () => {
  const content = clone(loadContent({ root }));
  content.manifest.files.units = '../outside/units.json';
  content.units['Bad Unit'] = {
    name: 'Bad Unit',
    hp: 100,
    speed: 100,
    size: 20,
    weapon: 'sword'
  };
  content.terrainPresets.coastal_grassland.waterLevel = 110;

  const result = validateContentData(content, { root });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /file "units" must stay under assets\/data\//);
  assert.match(result.errors.join('\n'), /units id "Bad Unit" must match/);
  assert.match(result.errors.join('\n'), /terrain preset "coastal_grassland" waterLevel must be at most 100/);
});

test('content validation reports malformed entries without throwing', () => {
  const content = clone(loadContent({ root }));
  content.abilities.bash = null;
  content.rulesets.open_rts_core = null;
  content.factions.kingdoms = null;
  content.weapons.sword = 'not an object';
  content.unitPacks.frontier_eras.units.cave_clubber = null;
  content.modes.versus = null;

  assert.doesNotThrow(() => validateContentData(content, { root }));
  const result = validateContentData(content, { root });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /abilities "bash" must be an object/);
  assert.match(result.errors.join('\n'), /rulesets "open_rts_core" must be an object/);
  assert.match(result.errors.join('\n'), /factions "kingdoms" must be an object/);
  assert.match(result.errors.join('\n'), /weapons "sword" must be an object/);
  assert.match(result.errors.join('\n'), /unit pack "frontier_eras" unit "cave_clubber" must be an object/);
  assert.match(result.errors.join('\n'), /modes "versus" must be an object/);
});
