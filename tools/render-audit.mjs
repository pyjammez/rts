import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeMap(base, patch) {
  return {
    ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}),
    ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {})
  };
}

function safeJoin(basePath, filePath) {
  const value = String(filePath || '');
  if (!value || path.isAbsolute(value) || value.split(/[\\/]+/).includes('..') || /^[a-z]+:/i.test(value)) {
    throw new Error(`Unsafe package file path "${value}"`);
  }
  return path.join(basePath, value);
}

function loadAuditService() {
  const context = { OpenRTS: { rendering: {} } };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'world/rendering/three/RenderAssetAuditService.js'), 'utf8'),
    context,
    { filename: 'RenderAssetAuditService.js' }
  );
  return context.OpenRTS.rendering.renderAssetAudit;
}

function loadCoreDefinitions() {
  return {
    units: readJson(path.join(root, 'assets/data/units.json')),
    buildings: readJson(path.join(root, 'assets/data/buildings.json')),
    assets: readJson(path.join(root, 'assets/data/assets.json'))
  };
}

function loadPackageOverlay(packageId, definitions) {
  if (!packageId) return definitions;
  const manifestPath = path.join(root, 'games', packageId, 'manifest.json');
  const manifest = readJson(manifestPath);
  const packageRoot = path.dirname(manifestPath);
  const merged = { ...definitions };
  for (const key of ['units', 'buildings', 'assets']) {
    const file = manifest.files?.[key];
    if (!file) continue;
    const data = readJson(safeJoin(packageRoot, file));
    merged[key] = key === 'assets'
      ? {
        schemaVersion: data.schemaVersion || merged.assets?.schemaVersion || 1,
        models: mergeMap(merged.assets?.models, data.models),
        textures: mergeMap(merged.assets?.textures, data.textures),
        sounds: mergeMap(merged.assets?.sounds, data.sounds)
      }
      : mergeMap(merged[key], data);
  }
  return merged;
}

function createFactoryRegistryFromAssets(assetManifest) {
  const factories = Object.keys(assetManifest.models || {}).map(id => ({ id, metadata: { renderer: 'three', kind: 'asset-contract' } }));
  return {
    list: () => factories
  };
}

function markdown(audit, packageId) {
  const lines = [
    `# Open RTS Render Audit${packageId ? `: ${packageId}` : ''}`,
    '',
    `Expected models: ${audit.expectedModelCount}`,
    `Asset models: ${audit.assetModelCount}`,
    `Factory contracts: ${audit.factoryCount}`,
    `Diagnostics: ${audit.summary.errors} errors, ${audit.summary.warnings} warnings`,
    '',
    '| Code | Level | Model | Message |',
    '| --- | --- | --- | --- |'
  ];
  if (audit.diagnostics.length === 0) {
    lines.push('| clean | info |  | No render asset issues found. |');
  } else {
    for (const diagnostic of audit.diagnostics) {
      lines.push(`| ${diagnostic.code} | ${diagnostic.level} | ${diagnostic.modelId || ''} | ${diagnostic.message} |`);
    }
  }
  return lines.join('\n');
}

const gameIndex = process.argv.indexOf('--game');
const packageId = gameIndex >= 0 ? process.argv[gameIndex + 1] : '';
const definitions = loadPackageOverlay(packageId, loadCoreDefinitions());
const auditService = loadAuditService();
const audit = auditService.createAudit({
  definitions,
  assetManifest: definitions.assets,
  factoryRegistry: createFactoryRegistryFromAssets(definitions.assets)
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ packageId: packageId || null, audit }, null, 2));
} else {
  console.log(markdown(audit, packageId));
}
