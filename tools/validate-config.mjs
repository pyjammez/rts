import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent, validateContentData } from './configValidation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = validateContent({ root });
const packageResults = [];
const packageIndexErrors = [];
const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSafePackageFile(filePath) {
  return typeof filePath === 'string'
    && !path.isAbsolute(filePath)
    && !filePath.split(/[\\/]+/).includes('..')
    && !/^[a-z]+:/i.test(filePath);
}

function validatePackageIdList(errors, manifest, field, knownPackageIds = null) {
  if (manifest[field] === undefined) return;
  if (!Array.isArray(manifest[field])) {
    errors.push(`game package "${manifest.id || 'unknown'}" ${field} must be an array`);
    return;
  }
  for (const value of manifest[field]) {
    const id = String(value || '');
    if (!PACKAGE_ID_PATTERN.test(id)) {
      errors.push(`game package "${manifest.id || 'unknown'}" ${field} id "${id}" is invalid`);
    }
    if (field === 'dependencies' && knownPackageIds && !knownPackageIds.has(id)) {
      errors.push(`game package "${manifest.id || 'unknown'}" dependency "${id}" is not installed`);
    }
    if (field === 'conflicts' && id === manifest.id) {
      errors.push(`game package "${manifest.id}" cannot conflict with itself`);
    }
  }
}

function validatePackageManifest(errors, manifest, manifestPath, knownPackageIds) {
  if (!isPlainObject(manifest)) {
    errors.push(`game package manifest "${manifestPath}" must be an object`);
    return;
  }
  if (Number(manifest.schemaVersion) !== 1) {
    errors.push(`game package "${manifest.id || manifestPath}" manifest must set schemaVersion to 1`);
  }
  if (!PACKAGE_ID_PATTERN.test(String(manifest.id || ''))) {
    errors.push(`game package manifest "${manifestPath}" needs a lowercase id`);
  }
  if (!SEMVER_PATTERN.test(String(manifest.version || ''))) {
    errors.push(`game package "${manifest.id || manifestPath}" version must be semantic x.y.z`);
  }
  if (manifest.engineVersion !== undefined && manifest.engineVersion !== '' && !SEMVER_PATTERN.test(String(manifest.engineVersion))) {
    errors.push(`game package "${manifest.id || manifestPath}" engineVersion must be semantic x.y.z`);
  }
  if (manifest.mergeMode !== undefined && manifest.mergeMode !== 'merge' && manifest.mergeMode !== 'replace') {
    errors.push(`game package "${manifest.id || manifestPath}" mergeMode must be merge or replace`);
  }
  if (manifest.files !== undefined && !isPlainObject(manifest.files)) {
    errors.push(`game package "${manifest.id || manifestPath}" files must be an object`);
  }
  validatePackageIdList(errors, manifest, 'dependencies', knownPackageIds);
  validatePackageIdList(errors, manifest, 'conflicts');
  validatePackageIdList(errors, manifest, 'provides');
  if (manifest.tags !== undefined && !Array.isArray(manifest.tags)) {
    errors.push(`game package "${manifest.id || manifestPath}" tags must be an array`);
  }
}

function validatePackageIndex(errors, index, indexPath, knownPackageIds, manifestPathsById) {
  if (!isPlainObject(index)) {
    errors.push(`game package index "${indexPath}" must be an object`);
    return;
  }
  if (Number(index.schemaVersion) !== 1) errors.push(`game package index "${indexPath}" must set schemaVersion to 1`);
  if (!Array.isArray(index.packages)) {
    errors.push(`game package index "${indexPath}" needs a packages array`);
    return;
  }
  const seen = new Set();
  for (const [packageIndex, entry] of index.packages.entries()) {
    if (!isPlainObject(entry)) {
      errors.push(`game package index entry ${packageIndex} must be an object`);
      continue;
    }
    const id = String(entry.id || '');
    if (!PACKAGE_ID_PATTERN.test(id)) errors.push(`game package index entry ${packageIndex} id "${id}" is invalid`);
    if (seen.has(id)) errors.push(`game package index contains duplicate package id "${id}"`);
    seen.add(id);
    if (!knownPackageIds.has(id)) errors.push(`game package index references unknown package "${id}"`);
    const manifestPath = String(entry.manifest || `${id}/manifest.json`);
    if (!isSafePackageFile(manifestPath)) {
      errors.push(`game package index "${id}" has unsafe manifest path "${manifestPath}"`);
      continue;
    }
    const absoluteManifestPath = path.join(path.dirname(indexPath), manifestPath);
    if (!fs.existsSync(absoluteManifestPath)) {
      errors.push(`game package index "${id}" manifest does not exist at ${manifestPath}`);
    } else if (manifestPathsById.get(id) !== absoluteManifestPath) {
      errors.push(`game package index "${id}" manifest path does not match discovered package manifest`);
    }
    if (entry.tags !== undefined && !Array.isArray(entry.tags)) {
      errors.push(`game package index "${id}" tags must be an array`);
    }
  }
  for (const packageId of knownPackageIds) {
    if (!seen.has(packageId)) errors.push(`game package "${packageId}" is missing from games/index.json`);
  }
}

function mergeMap(base, patch) {
  return {
    ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}),
    ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {})
  };
}

function loadPackageOverlay(manifestPath, knownPackageIds) {
  const manifest = readJson(manifestPath);
  const packageRoot = path.dirname(manifestPath);
  const content = loadContent({ root });
  validatePackageManifest(content.loadErrors, manifest, manifestPath, knownPackageIds);
  for (const [key, filePath] of Object.entries(manifest.files || {})) {
    if (key === 'scenarios') continue;
    if (!isSafePackageFile(filePath)) {
      content.loadErrors.push(`game package "${manifest.id || manifestPath}" file "${key}" has unsafe path "${filePath}"`);
      continue;
    }
    const absolutePath = path.join(packageRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      content.loadErrors.push(`game package "${manifest.id || manifestPath}" file "${key}" does not exist at ${filePath}`);
      continue;
    }
    content[key] = mergeMap(content[key], readJson(absolutePath));
  }
  return {
    manifest,
    result: validateContentData(content, { root })
  };
}

const gamesDir = path.join(root, 'games');
if (fs.existsSync(gamesDir)) {
  const manifestPaths = [];
  for (const entry of fs.readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(gamesDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    manifestPaths.push(manifestPath);
  }
  const manifestPathsById = new Map(manifestPaths.map(manifestPath => [String(readJson(manifestPath).id || ''), manifestPath]).filter(([id]) => id));
  const knownPackageIds = new Set(manifestPathsById.keys());
  const packageIndexPath = path.join(gamesDir, 'index.json');
  if (!fs.existsSync(packageIndexPath)) {
    packageIndexErrors.push('games/index.json must exist for S3-hosted package discovery');
  } else {
    validatePackageIndex(packageIndexErrors, readJson(packageIndexPath), packageIndexPath, knownPackageIds, manifestPathsById);
  }
  for (const manifestPath of manifestPaths) {
    packageResults.push(loadPackageOverlay(manifestPath, knownPackageIds));
  }
}

const invalidPackages = packageResults.filter(packageResult => !packageResult.result.valid);

if (!result.valid || invalidPackages.length > 0 || packageIndexErrors.length > 0) {
  console.error(`Configuration validation failed (${result.errors.length}):`);
  result.errors.forEach(error => console.error(`- ${error}`));
  if (packageIndexErrors.length > 0) {
    console.error(`Game package index validation failed (${packageIndexErrors.length}):`);
    packageIndexErrors.forEach(error => console.error(`- ${error}`));
  }
  for (const packageResult of invalidPackages) {
    console.error(`Game package "${packageResult.manifest.id || packageResult.manifest.name || 'unknown'}" validation failed (${packageResult.result.errors.length}):`);
    packageResult.result.errors.forEach(error => console.error(`- ${error}`));
  }
  process.exitCode = 1;
} else {
  console.log(
    `Configuration valid: ${result.summary.catalogUnits} catalog units, `
    + `${result.summary.abilities} abilities, `
    + `${result.summary.weapons} weapons, `
    + `${result.summary.rulesets} rulesets, `
    + `${result.summary.factions} factions, `
    + `${result.summary.modes} modes, `
    + `${packageResults.length} game packages.`
  );
}
