import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(root, 'games');
const schemaContext = {
  OpenRTS: { config: {} }
};
schemaContext.globalThis = schemaContext;
schemaContext.window = schemaContext;
vm.runInNewContext(
  fs.readFileSync(path.join(root, 'game/config/ContentSchemaService.js'), 'utf8'),
  schemaContext,
  { filename: 'ContentSchemaService.js' }
);
const contentSchemas = schemaContext.OpenRTS.config.contentSchemas;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function keysOf(value) {
  return isPlainObject(value) ? Object.keys(value).sort() : [];
}

function countRecords(content, key) {
  return keysOf(content[key]).length;
}

function sortedValues(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null).map(String).filter(Boolean))].sort();
}

function safeJoin(basePath, filePath) {
  const value = String(filePath || '');
  if (!value || path.isAbsolute(value) || value.split(/[\\/]+/).includes('..') || /^[a-z]+:/i.test(value)) {
    throw new Error(`Unsafe package file path "${value}"`);
  }
  return path.join(basePath, value);
}

function loadPackage(entry) {
  const manifestPath = safeJoin(gamesDir, entry.manifest || `${entry.id}/manifest.json`);
  const manifest = readJson(manifestPath);
  const packageRoot = path.dirname(manifestPath);
  const content = {};
  const errors = [];

  for (const [key, filePath] of Object.entries(manifest.files || {})) {
    try {
      const absolutePath = safeJoin(packageRoot, filePath);
      content[key] = readJson(absolutePath);
    } catch (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }

  return { entry, manifest, manifestPath, content, errors };
}

function createReport(packageData) {
  const { entry, manifest, content, errors } = packageData;
  const rulesets = content.rulesets || {};
  const units = Object.values(content.units || {}).filter(isPlainObject);
  const buildings = Object.values(content.buildings || {}).filter(isPlainObject);
  const diagnostics = [...errors.map(message => ({ level: 'error', message }))];
  if (countRecords(content, 'rulesets') === 0) diagnostics.push({ level: 'warning', message: 'missing rulesets' });
  if (countRecords(content, 'factions') === 0) diagnostics.push({ level: 'warning', message: 'missing factions' });
  if (countRecords(content, 'units') === 0) diagnostics.push({ level: 'warning', message: 'missing units' });
  diagnostics.push(...contentSchemas.validatePackageContent(content, { warnUnknownFields: false }).map(diagnostic => ({
    level: diagnostic.level,
    message: `${diagnostic.schemaId} "${diagnostic.recordId}" ${diagnostic.message}`
  })));

  return {
    id: manifest.id || entry.id,
    name: manifest.name || entry.name || entry.id,
    version: manifest.version || '',
    category: entry.category || '',
    style: entry.style || '',
    resources: sortedValues(Object.values(rulesets).flatMap(ruleset => keysOf(ruleset.resources))).join(', ') || 'none',
    units: countRecords(content, 'units'),
    buildings: countRecords(content, 'buildings'),
    weapons: countRecords(content, 'weapons'),
    modes: countRecords(content, 'modes'),
    hasAir: units.some(unit => unit.movementType === 'air' || Number(unit.flightHeight) > 0),
    hasWorkers: units.some(unit => `${unit.role || ''} ${(unit.tags || []).join(' ')}`.toLowerCase().match(/worker|builder/)),
    hasDefense: buildings.some(building => Number(building.damage || building.range || 0) > 0),
    diagnostics
  };
}

function markdownTable(rows) {
  const header = '| Package | Style | Resources | Units | Buildings | Weapons | Modes | Capabilities | Diagnostics |';
  const divider = '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |';
  const body = rows.map(row => {
    const capabilities = [
      row.hasWorkers ? 'workers' : '',
      row.hasAir ? 'air' : '',
      row.hasDefense ? 'defense' : ''
    ].filter(Boolean).join(', ') || 'basic';
    const diagnostics = row.diagnostics.length === 0
      ? 'clean'
      : row.diagnostics.map(item => `${item.level}: ${item.message}`).join('<br>');
    return `| ${row.name} | ${row.style || row.category} | ${row.resources} | ${row.units} | ${row.buildings} | ${row.weapons} | ${row.modes} | ${capabilities} | ${diagnostics} |`;
  });
  return [header, divider, ...body].join('\n');
}

const index = readJson(path.join(gamesDir, 'index.json'));
const reports = (index.packages || []).map(entry => createReport(loadPackage(entry)));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ schemaVersion: 1, packageCount: reports.length, packages: reports }, null, 2));
} else {
  console.log(`# Open RTS Package Report\n\n${markdownTable(reports)}\n`);
}
