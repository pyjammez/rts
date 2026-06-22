import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = name => path.join(root, 'assets', 'data', name);
const readJson = name => JSON.parse(fs.readFileSync(dataPath(name), 'utf8'));

const weapons = readJson('weapons.json');
const units = readJson('units.json');
const buildings = readJson('buildings.json');
const modes = readJson('game-modes.json');
const terrainPresets = readJson('terrain-presets.json');
const errors = [];

function requireEntry(collection, id, context) {
  if (!collection[id]) errors.push(`${context} references unknown id "${id}"`);
}

for (const [unitId, unit] of Object.entries(units)) {
  if (!unit.name) errors.push(`unit "${unitId}" needs a name`);
  if (unit.weapon) requireEntry(weapons, unit.weapon, `unit "${unitId}"`);
  if (Number(unit.hp) <= 0) errors.push(`unit "${unitId}" must have positive hp`);
  if (Number(unit.speed) <= 0) errors.push(`unit "${unitId}" must have positive speed`);
  if (unit.requiredPerTeam && Number(unit.maxPerTeam) !== 1) {
    errors.push(`required unit "${unitId}" must set maxPerTeam to 1`);
  }
}

for (const [modeId, mode] of Object.entries(modes)) {
  const allowedUnits = Array.isArray(mode.allowedUnits) ? mode.allowedUnits : [];
  allowedUnits.forEach(unitId => requireEntry(units, unitId, `mode "${modeId}"`));
  requireEntry(terrainPresets, mode.defaults?.mapStyle, `mode "${modeId}"`);

  const hasRoster = !!mode.defaults && Object.hasOwn(mode.defaults, 'unitRoster');
  const roster = mode.defaults?.unitRoster || {};
  for (const [unitId, countValue] of Object.entries(roster)) {
    requireEntry(units, unitId, `mode "${modeId}" roster`);
    const count = Number(countValue);
    if (!Number.isInteger(count) || count < 0) errors.push(`mode "${modeId}" has invalid ${unitId} count`);
    const maximum = Number(units[unitId]?.maxPerTeam);
    if (Number.isFinite(maximum) && count > maximum) {
      errors.push(`mode "${modeId}" requests ${count} ${unitId} units; maximum is ${maximum}`);
    }
  }

  if (hasRoster) {
    for (const unitId of allowedUnits) {
      if (units[unitId]?.requiredPerTeam && Number(roster[unitId]) !== 1) {
        errors.push(`mode "${modeId}" must start with exactly one required ${unitId}`);
      }
    }
  }
}

if (!buildings.home) errors.push('buildings.json must define the home castle');

if (errors.length > 0) {
  console.error(`Configuration validation failed (${errors.length}):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Configuration valid: ${Object.keys(units).length} units, ${Object.keys(weapons).length} weapons, ${Object.keys(modes).length} modes.`);
}
