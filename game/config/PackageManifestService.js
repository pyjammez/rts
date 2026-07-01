(function registerPackageManifestService(global) {
  const app = global.OpenRTS = global.OpenRTS || {};
  app.config = app.config || {};

  const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
  const FILE_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
  const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.filter(item => item !== undefined && item !== null).map(String) : [];
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function dirname(path) {
    const value = String(path || '');
    const index = value.lastIndexOf('/');
    return index >= 0 ? value.slice(0, index + 1) : '';
  }

  function joinPath(basePath, filePath) {
    return `${basePath || ''}${filePath || ''}`;
  }

  function isSafeRelativePath(filePath) {
    const value = String(filePath || '');
    return !!value && !value.startsWith('/') && !value.includes('..') && !/^[a-z]+:/i.test(value);
  }

  function resolvePackageFile(basePath, filePath) {
    if (!isSafeRelativePath(filePath)) {
      throw new Error(`Unsafe package file path "${String(filePath || '')}"`);
    }
    return joinPath(basePath, filePath);
  }

  function parseVersion(version) {
    const match = String(version || '').trim().match(SEMVER_PATTERN);
    if (!match) return null;
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3])
    };
  }

  function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    if (!left || !right) return 0;
    return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  }

  function satisfiesEngineVersion(requiredVersion, engineVersion) {
    if (!requiredVersion || !engineVersion) return true;
    const required = parseVersion(requiredVersion);
    const current = parseVersion(engineVersion);
    if (!required || !current) return false;
    return current.major === required.major && compareVersions(engineVersion, requiredVersion) >= 0;
  }

  function normalizeManifest(data, manifestPath = '') {
    if (!isPlainObject(data)) {
      throw new Error(`${manifestPath || 'package manifest'} must contain an object`);
    }
    const id = String(data.id || '').trim();
    if (!PACKAGE_ID_PATTERN.test(id)) {
      throw new Error(`${manifestPath || 'package manifest'} needs a lowercase package id`);
    }
    const files = isPlainObject(data.files) ? { ...data.files } : {};
    return Object.freeze({
      schemaVersion: Number(data.schemaVersion) || 1,
      id,
      name: String(data.name || id),
      description: String(data.description || ''),
      version: String(data.version || '0.0.0'),
      engineVersion: String(data.engineVersion || ''),
      author: String(data.author || ''),
      license: String(data.license || ''),
      homepage: String(data.homepage || ''),
      mergeMode: data.mergeMode === 'replace' ? 'replace' : 'merge',
      dependencies: cloneArray(data.dependencies),
      conflicts: cloneArray(data.conflicts),
      provides: cloneArray(data.provides),
      tags: cloneArray(data.tags),
      files,
      basePath: dirname(manifestPath),
      manifestPath,
      fingerprint: hashString(stableStringify({
        schemaVersion: Number(data.schemaVersion) || 1,
        id,
        version: String(data.version || '0.0.0'),
        engineVersion: String(data.engineVersion || ''),
        mergeMode: data.mergeMode === 'replace' ? 'replace' : 'merge',
        dependencies: cloneArray(data.dependencies).sort(),
        conflicts: cloneArray(data.conflicts).sort(),
        provides: cloneArray(data.provides).sort(),
        files
      }))
    });
  }

  function listFileEntries(manifest) {
    return Object.entries(manifest?.files || {})
      .map(([key, file]) => ({
        key,
        file: String(file || ''),
        path: resolvePackageFile(manifest.basePath || '', file)
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  function validateManifest(data, options = {}) {
    const errors = [];
    if (!isPlainObject(data)) {
      errors.push(`${options.manifestPath || options.path || 'package manifest'} must contain an object`);
      return { valid: false, errors, manifest: null };
    }
    const rawId = String(data.id || '').trim();
    if (!PACKAGE_ID_PATTERN.test(rawId)) {
      errors.push(`${options.manifestPath || options.path || 'package manifest'} needs a lowercase package id`);
    }
    const manifest = rawId && PACKAGE_ID_PATTERN.test(rawId)
      ? normalizeManifest(data, options.manifestPath || options.path || '')
      : {
        schemaVersion: Number(data.schemaVersion) || 1,
        id: rawId || 'unknown',
        name: String(data.name || rawId || 'unknown'),
        version: String(data.version || '0.0.0'),
        engineVersion: String(data.engineVersion || ''),
        mergeMode: data.mergeMode === 'replace' ? 'replace' : 'merge',
        dependencies: cloneArray(data.dependencies),
        conflicts: cloneArray(data.conflicts),
        provides: cloneArray(data.provides),
        tags: cloneArray(data.tags),
        files: isPlainObject(data.files) ? { ...data.files } : {},
        basePath: dirname(options.manifestPath || options.path || ''),
        manifestPath: options.manifestPath || options.path || '',
        fingerprint: ''
      };

    if (manifest.schemaVersion !== 1) errors.push(`game package "${manifest.id}" manifest must set schemaVersion to 1`);
    if (!parseVersion(manifest.version)) errors.push(`game package "${manifest.id}" version must be semantic x.y.z`);
    if (manifest.engineVersion && !parseVersion(manifest.engineVersion)) {
      errors.push(`game package "${manifest.id}" engineVersion must be semantic x.y.z`);
    }
    if (!satisfiesEngineVersion(manifest.engineVersion, options.engineVersion || '')) {
      errors.push(`game package "${manifest.id}" requires engine ${manifest.engineVersion}`);
    }
    if (manifest.mergeMode !== 'merge' && manifest.mergeMode !== 'replace') {
      errors.push(`game package "${manifest.id}" mergeMode must be merge or replace`);
    }

    for (const [key, file] of Object.entries(manifest.files)) {
      if (!FILE_KEY_PATTERN.test(key)) errors.push(`game package "${manifest.id}" file key "${key}" is invalid`);
      if (!isSafeRelativePath(file)) errors.push(`game package "${manifest.id}" file "${key}" has unsafe path "${file}"`);
    }

    const knownPackages = new Set(cloneArray(options.knownPackages));
    for (const dependencyId of manifest.dependencies) {
      if (!PACKAGE_ID_PATTERN.test(dependencyId)) errors.push(`game package "${manifest.id}" dependency "${dependencyId}" is invalid`);
      if (knownPackages.size > 0 && !knownPackages.has(dependencyId)) {
        errors.push(`game package "${manifest.id}" dependency "${dependencyId}" is not installed`);
      }
    }
    for (const conflictId of manifest.conflicts) {
      if (!PACKAGE_ID_PATTERN.test(conflictId)) errors.push(`game package "${manifest.id}" conflict "${conflictId}" is invalid`);
      if (conflictId === manifest.id) errors.push(`game package "${manifest.id}" cannot conflict with itself`);
    }
    for (const providedId of manifest.provides) {
      if (!PACKAGE_ID_PATTERN.test(providedId)) errors.push(`game package "${manifest.id}" provides "${providedId}" is invalid`);
    }

    return { valid: errors.length === 0, errors, manifest };
  }

  function sortByDependencies(manifests = []) {
    const normalized = manifests.map(manifest => manifest.fingerprint ? manifest : normalizeManifest(manifest, manifest.manifestPath || ''));
    const byId = new Map(normalized.map(manifest => [manifest.id, manifest]));
    const visited = new Set();
    const visiting = new Set();
    const ordered = [];
    const errors = [];

    function visit(manifest) {
      if (visited.has(manifest.id)) return;
      if (visiting.has(manifest.id)) {
        errors.push(`game package dependency cycle includes "${manifest.id}"`);
        return;
      }
      visiting.add(manifest.id);
      for (const dependencyId of manifest.dependencies) {
        const dependency = byId.get(dependencyId);
        if (!dependency) {
          errors.push(`game package "${manifest.id}" dependency "${dependencyId}" is not installed`);
          continue;
        }
        visit(dependency);
      }
      visiting.delete(manifest.id);
      visited.add(manifest.id);
      ordered.push(manifest);
    }

    normalized.forEach(visit);
    return { valid: errors.length === 0, errors, ordered };
  }

  function createPackageLock(manifests = []) {
    const sorted = sortByDependencies(manifests);
    const packages = sorted.ordered.map(manifest => ({
      id: manifest.id,
      version: manifest.version,
      fingerprint: manifest.fingerprint,
      engineVersion: manifest.engineVersion,
      dependencies: [...manifest.dependencies],
      files: listFileEntries(manifest).map(entry => ({ key: entry.key, file: entry.file }))
    }));
    return {
      schemaVersion: 1,
      packageCount: packages.length,
      fingerprint: hashString(stableStringify(packages)),
      errors: [...sorted.errors],
      packages
    };
  }

  function describeManifest(manifest) {
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      engineVersion: manifest.engineVersion,
      mergeMode: manifest.mergeMode,
      fingerprint: manifest.fingerprint,
      dependencies: [...manifest.dependencies],
      conflicts: [...manifest.conflicts],
      provides: [...manifest.provides],
      tags: [...manifest.tags],
      files: listFileEntries(manifest)
    };
  }

  function normalizeIndexEntry(entry, indexPath = '') {
    if (!isPlainObject(entry)) {
      throw new Error(`${indexPath || 'package index'} package entries must be objects`);
    }
    const id = String(entry.id || '').trim();
    if (!PACKAGE_ID_PATTERN.test(id)) {
      throw new Error(`${indexPath || 'package index'} package id "${id}" is invalid`);
    }
    const manifest = String(entry.manifest || `${id}/manifest.json`);
    if (!isSafeRelativePath(manifest)) {
      throw new Error(`${indexPath || 'package index'} package "${id}" has unsafe manifest path "${manifest}"`);
    }
    return Object.freeze({
      id,
      manifest,
      manifestPath: resolvePackageFile(dirname(indexPath || 'games/index.json'), manifest),
      name: String(entry.name || id),
      description: String(entry.description || ''),
      category: String(entry.category || 'sample'),
      style: String(entry.style || ''),
      featured: entry.featured === true,
      tags: cloneArray(entry.tags),
      provides: cloneArray(entry.provides)
    });
  }

  function normalizePackageIndex(data, indexPath = 'games/index.json') {
    if (!isPlainObject(data)) {
      throw new Error(`${indexPath} must contain a package index object`);
    }
    const packages = Array.isArray(data.packages)
      ? data.packages.map(entry => normalizeIndexEntry(entry, indexPath))
      : [];
    return Object.freeze({
      schemaVersion: Number(data.schemaVersion) || 1,
      name: String(data.name || 'Game Packages'),
      description: String(data.description || ''),
      indexPath,
      basePath: dirname(indexPath),
      packages,
      fingerprint: hashString(stableStringify({
        schemaVersion: Number(data.schemaVersion) || 1,
        packages: packages.map(entry => ({
          id: entry.id,
          manifest: entry.manifest,
          category: entry.category,
          tags: [...entry.tags].sort()
        })).sort((a, b) => a.id.localeCompare(b.id))
      }))
    });
  }

  function validatePackageIndex(data, options = {}) {
    const errors = [];
    let index = null;
    try {
      index = normalizePackageIndex(data, options.indexPath || 'games/index.json');
    } catch (error) {
      errors.push(error.message);
      return { valid: false, errors, index: null };
    }
    if (index.schemaVersion !== 1) errors.push(`${index.indexPath} must set schemaVersion to 1`);
    if (!Array.isArray(data.packages)) errors.push(`${index.indexPath} needs a packages array`);

    const seen = new Set();
    for (const entry of index.packages) {
      if (seen.has(entry.id)) errors.push(`${index.indexPath} contains duplicate package id "${entry.id}"`);
      seen.add(entry.id);
      if (options.knownPackages && !options.knownPackages.includes(entry.id)) {
        errors.push(`${index.indexPath} references unknown package "${entry.id}"`);
      }
    }

    return { valid: errors.length === 0, errors, index };
  }

  function searchPackageIndex(index, filters = {}) {
    const query = String(filters.query || '').trim().toLowerCase();
    const category = filters.category && filters.category !== 'all' ? String(filters.category) : '';
    const tag = filters.tag && filters.tag !== 'all' ? String(filters.tag) : '';
    return [...(index?.packages || [])].filter(entry => {
      if (category && entry.category !== category) return false;
      if (tag && !entry.tags.includes(tag)) return false;
      if (!query) return true;
      const haystack = [
        entry.id,
        entry.name,
        entry.description,
        entry.category,
        entry.style,
        ...entry.tags,
        ...entry.provides
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function getIndexFacets(index) {
    const packages = index?.packages || [];
    return {
      categories: [...new Set(packages.map(entry => entry.category).filter(Boolean))].sort(),
      tags: [...new Set(packages.flatMap(entry => entry.tags || []))].sort(),
      featured: packages.filter(entry => entry.featured).map(entry => entry.id)
    };
  }

  app.config.packageManifests = Object.freeze({
    PACKAGE_ID_PATTERN,
    normalizeManifest,
    validateManifest,
    listFileEntries,
    resolvePackageFile,
    stableStringify,
    fingerprint: value => hashString(stableStringify(value)),
    parseVersion,
    compareVersions,
    satisfiesEngineVersion,
    sortByDependencies,
    createPackageLock,
    describeManifest,
    normalizePackageIndex,
    validatePackageIndex,
    searchPackageIndex,
    getIndexFacets
  });
})(globalThis);
