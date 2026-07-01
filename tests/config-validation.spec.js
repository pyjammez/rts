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
    'era_of_kingdoms',
    'desert_command'
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
    ultimate_extinction: ['Core Directive', 'Arm Vanguard', 'Frontier Machine'],
    desert_command: ['Global Coalition', 'Desert Brotherhood', 'Iron Syndicate']
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

test('era of kingdoms includes an arabia-style 1v1 map preset', () => {
  const terrainPresets = JSON.parse(fs.readFileSync(path.join(root, 'games', 'era_of_kingdoms', 'terrain-presets.json'), 'utf8'));
  const modes = JSON.parse(fs.readFileSync(path.join(root, 'games', 'era_of_kingdoms', 'game-modes.json'), 'utf8'));
  const preset = terrainPresets.eok_arabia;
  const versus = modes.era_of_kingdoms_versus;

  assert.equal(preset.visualStyle, 'arabia_dryland');
  assert.equal(preset.waterLevel, 0);
  assert.equal(preset.treeCount >= 120, true);
  assert.equal(preset.goldMineCount >= 8, true);
  assert.equal(versus.defaults.mapStyle, 'eok_arabia');
  assert.equal(versus.defaults.visualStyle, 'arabia_dryland');
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
