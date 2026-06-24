(function registerContentPackLoader(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.config = app.config || {};

  const packs = new Map();
  const gamePackages = new Map();
  const loadState = {
    loaded: false,
    errors: [],
    selectedGamePackageId: '',
    activeGamePackage: null
  };
  const PACKAGE_FILE_KEYS = Object.freeze([
    'abilities',
    'weapons',
    'rulesets',
    'factions',
    'units',
    'unitPacks',
    'buildings',
    'assets',
    'terrainPresets',
    'modes',
    'scenarios'
  ]);

  function normalizePack(data, path) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${path} must contain a content pack object`);
    }
    if (!data.id) throw new Error(`${path} needs an id`);
    return {
      schemaVersion: Number(data.schemaVersion) || 1,
      id: String(data.id),
      name: String(data.name || data.id),
      description: String(data.description || ''),
      version: String(data.version || '0.0.0'),
      files: data.files && typeof data.files === 'object' && !Array.isArray(data.files) ? { ...data.files } : {},
      dependencies: Array.isArray(data.dependencies) ? data.dependencies.map(String) : [],
      sourcePath: path
    };
  }

  function safePackageId(value) {
    const id = String(value || '').trim();
    return /^[a-z][a-z0-9_-]*$/.test(id) ? id : '';
  }

  function dirname(path) {
    const value = String(path || '');
    const index = value.lastIndexOf('/');
    return index >= 0 ? value.slice(0, index + 1) : '';
  }

  function resolvePackageFile(basePath, filePath) {
    const file = String(filePath || '');
    if (!file || file.startsWith('/') || file.includes('..') || /^[a-z]+:/i.test(file)) {
      throw new Error(`Unsafe package file path "${file}"`);
    }
    return `${basePath}${file}`;
  }

  function mergeMap(base, patch) {
    return {
      ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}),
      ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {})
    };
  }

  function normalizeGamePackage(data, manifestPath) {
    const manifestService = app.config.packageManifests;
    const manifest = manifestService?.normalizeManifest
      ? manifestService.normalizeManifest(data, manifestPath)
      : null;
    if (manifest) {
      return {
        ...manifest,
        content: {},
        errors: []
      };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${manifestPath} must contain a game package object`);
    }
    const id = safePackageId(data.id);
    if (!id) throw new Error(`${manifestPath} needs a lowercase game package id`);
    const files = data.files && typeof data.files === 'object' && !Array.isArray(data.files) ? { ...data.files } : {};
    return {
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
      dependencies: Array.isArray(data.dependencies) ? data.dependencies.map(String) : [],
      conflicts: Array.isArray(data.conflicts) ? data.conflicts.map(String) : [],
      provides: Array.isArray(data.provides) ? data.provides.map(String) : [],
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      files,
      basePath: dirname(manifestPath),
      manifestPath,
      fingerprint: '',
      content: {},
      errors: []
    };
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  async function loadContentPack(path) {
    const pack = normalizePack(await fetchJson(path), path);
    packs.set(pack.id, pack);
    return pack;
  }

  async function loadGamePackage(manifestPathOrId) {
    const packageId = safePackageId(manifestPathOrId);
    const manifestPath = packageId && !String(manifestPathOrId).includes('/')
      ? `games/${packageId}/manifest.json`
      : String(manifestPathOrId || '');
    const manifestData = await fetchJson(manifestPath);
    const gamePackage = normalizeGamePackage(manifestData, manifestPath);
    const manifestValidation = app.config.packageManifests?.validateManifest?.(manifestData, {
      manifestPath,
      engineVersion: gamePackage.engineVersion || ''
    });
    if (manifestValidation && !manifestValidation.valid) {
      gamePackage.errors.push(...manifestValidation.errors);
    }

    for (const key of PACKAGE_FILE_KEYS) {
      const file = gamePackage.files[key];
      if (!file) continue;
      try {
        const path = app.config.packageManifests?.resolvePackageFile
          ? app.config.packageManifests.resolvePackageFile(gamePackage.basePath, file)
          : resolvePackageFile(gamePackage.basePath, file);
        gamePackage.content[key] = await fetchJson(path);
      } catch (error) {
        gamePackage.errors.push(`${key}: ${error.message}`);
      }
    }

    gamePackages.set(gamePackage.id, gamePackage);
    loadState.activeGamePackage = gamePackage;
    loadState.selectedGamePackageId = gamePackage.id;
    return gamePackage;
  }

  async function loadSelectedGamePackage(locationLike = root.location) {
    const search = String(locationLike?.search || '');
    const params = new URLSearchParams(search);
    const packageId = safePackageId(params.get('game') || params.get('package'));
    if (!packageId) return null;
    return loadGamePackage(packageId);
  }

  function applyGamePackage(baseDefinitions = {}, gamePackage = loadState.activeGamePackage) {
    if (!gamePackage) return baseDefinitions;
    const content = gamePackage.content || {};
    const mode = gamePackage.mergeMode || 'merge';
    const merged = { ...baseDefinitions };
    for (const key of PACKAGE_FILE_KEYS) {
      if (key === 'scenarios' || content[key] === undefined) continue;
      merged[key] = mode === 'replace'
        ? mergeMap({}, content[key])
        : mergeMap(baseDefinitions[key], content[key]);
    }
    merged.activeGamePackage = {
      id: gamePackage.id,
      name: gamePackage.name,
      version: gamePackage.version,
      manifestPath: gamePackage.manifestPath,
      mergeMode: gamePackage.mergeMode,
      errors: [...gamePackage.errors]
    };
    return merged;
  }

  async function loadContentPacks(paths = []) {
    loadState.errors.length = 0;
    for (const path of paths) {
      try {
        await loadContentPack(path);
      } catch (error) {
        loadState.errors.push(error.message);
        console.warn('Unable to load content pack.', error);
      }
    }
    loadState.loaded = true;
    return loadState;
  }

  function getPack(id) {
    return packs.get(id) || null;
  }

  function getGamePackage(id) {
    return gamePackages.get(id) || null;
  }

  function listPacks() {
    return [...packs.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function listGamePackages() {
    return [...gamePackages.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function createGamePackageLock() {
    if (app.config.packageManifests?.createPackageLock) {
      return app.config.packageManifests.createPackageLock(listGamePackages());
    }
    return {
      schemaVersion: 1,
      packageCount: gamePackages.size,
      fingerprint: '',
      errors: [],
      packages: listGamePackages().map(gamePackage => ({
        id: gamePackage.id,
        version: gamePackage.version,
        dependencies: [...(gamePackage.dependencies || [])],
        files: Object.entries(gamePackage.files || {}).map(([key, file]) => ({ key, file }))
      }))
    };
  }

  function describe() {
    return {
      schemaVersion: 1,
      loaded: loadState.loaded,
      count: packs.size,
      gamePackageCount: gamePackages.size,
      errors: [...loadState.errors],
      activeGamePackage: loadState.activeGamePackage ? {
        id: loadState.activeGamePackage.id,
        name: loadState.activeGamePackage.name,
        version: loadState.activeGamePackage.version,
        fingerprint: loadState.activeGamePackage.fingerprint,
        errors: [...loadState.activeGamePackage.errors]
      } : null,
      packs: listPacks().map(pack => ({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        dependencies: [...pack.dependencies]
      })),
      gamePackages: listGamePackages().map(gamePackage => ({
        id: gamePackage.id,
        name: gamePackage.name,
        version: gamePackage.version,
        engineVersion: gamePackage.engineVersion,
        mergeMode: gamePackage.mergeMode,
        fingerprint: gamePackage.fingerprint,
        dependencies: [...(gamePackage.dependencies || [])],
        conflicts: [...(gamePackage.conflicts || [])],
        provides: [...(gamePackage.provides || [])],
        tags: [...(gamePackage.tags || [])],
        fileCount: Object.keys(gamePackage.files || {}).length,
        errors: [...gamePackage.errors]
      })),
      packageLock: createGamePackageLock()
    };
  }

  app.config.contentPacks = Object.freeze({
    loadContentPack,
    loadContentPacks,
    getPack,
    listPacks,
    describe,
    loadState
  });
  app.config.gamePackages = Object.freeze({
    loadGamePackage,
    loadSelectedGamePackage,
    applyGamePackage,
    getGamePackage,
    listGamePackages,
    createGamePackageLock,
    describe,
    loadState
  });
  app.diagnostics?.register?.('content-packs', describe);
})(globalThis);
