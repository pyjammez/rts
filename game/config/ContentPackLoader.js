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
    activeGamePackage: null,
    packageIndex: null
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

  function mergeModeDefinition(baseMode = {}, override = {}, targetId = '') {
    const merged = mergeMap(baseMode, override);
    merged.id = targetId || baseMode.id || override.id || '';
    merged.defaults = mergeMap(baseMode.defaults, override.defaults);
    return merged;
  }

  function modeOverrideTarget(modeId, packageId, baseModes = {}) {
    const id = String(modeId || '');
    if (baseModes[id]) return id;
    const normalizedPackageId = String(packageId || '').replace(/-/g, '_');
    const aliases = [
      [`${normalizedPackageId}_versus`, 'versus'],
      [`${normalizedPackageId}_td`, 'tower_defense'],
      [`${normalizedPackageId}_tower_defense`, 'tower_defense'],
      [`${normalizedPackageId}_compare`, 'unit_comparison'],
      [`${normalizedPackageId}_unit_comparison`, 'unit_comparison'],
      [`${normalizedPackageId}_builder`, 'map_builder'],
      [`${normalizedPackageId}_map_builder`, 'map_builder']
    ];
    for (const [alias, target] of aliases) {
      if (id === alias && baseModes[target]) return target;
    }
    if (id.endsWith('_versus') && baseModes.versus) return 'versus';
    if ((id.endsWith('_td') || id.endsWith('_tower_defense')) && baseModes.tower_defense) return 'tower_defense';
    if ((id.endsWith('_compare') || id.endsWith('_unit_comparison')) && baseModes.unit_comparison) return 'unit_comparison';
    if ((id.endsWith('_builder') || id.endsWith('_map_builder')) && baseModes.map_builder) return 'map_builder';
    return '';
  }

  function mergeModeOverrides(baseModes = {}, packageModes = {}, gamePackage = {}) {
    const merged = mergeMap({}, baseModes);
    const applied = [];
    const ignored = [];
    for (const [modeId, mode] of Object.entries(packageModes || {})) {
      const targetId = modeOverrideTarget(modeId, gamePackage.id, baseModes);
      if (!targetId) {
        ignored.push(modeId);
        continue;
      }
      merged[targetId] = mergeModeDefinition(baseModes[targetId], mode, targetId);
      applied.push({ source: modeId, target: targetId });
    }
    gamePackage.modeOverrides = applied;
    gamePackage.ignoredModeIds = ignored;
    gamePackage.modeDerivatives = [];
    return merged;
  }

  function defaultComparisonRoster(versusDefaults = {}, allowedUnits = []) {
    const roster = versusDefaults.unitRoster && typeof versusDefaults.unitRoster === 'object'
      ? versusDefaults.unitRoster
      : {};
    const result = {};
    for (const unitId of allowedUnits) {
      result[unitId] = Math.max(0, Math.floor(Number(roster[unitId]) || 0));
    }
    if (Object.values(result).some(count => count > 0)) return result;
    const first = allowedUnits[0];
    return first ? { [first]: 5 } : {};
  }

  function applyPackageModeDerivatives(modes = {}, gamePackage = {}) {
    const appliedTargets = new Set((gamePackage.modeOverrides || []).map(override => override.target));
    if (appliedTargets.has('unit_comparison')) return modes;
    const versus = modes.versus;
    const comparison = modes.unit_comparison;
    if (!versus || !comparison) return modes;

    const allowedUnits = Array.isArray(versus.allowedUnits) && versus.allowedUnits.length
      ? [...versus.allowedUnits]
      : Array.isArray(versus.defaults?.enabledUnits) && versus.defaults.enabledUnits.length
        ? [...versus.defaults.enabledUnits]
        : [];
    if (!allowedUnits.length) return modes;

    const enabledUnits = Array.isArray(versus.defaults?.enabledUnits) && versus.defaults.enabledUnits.length
      ? versus.defaults.enabledUnits.filter(unitId => allowedUnits.includes(unitId))
      : [...allowedUnits];
    const derivedRoster = defaultComparisonRoster(versus.defaults, allowedUnits);
    const defaults = {
      ...(comparison.defaults || {}),
      mapStyle: versus.defaults?.mapStyle || comparison.defaults?.mapStyle,
      visualStyle: versus.defaults?.visualStyle || comparison.defaults?.visualStyle,
      enabledUnits,
      leftUnitRoster: { ...derivedRoster },
      rightUnitRoster: { ...derivedRoster }
    };

    modes.unit_comparison = {
      ...comparison,
      allowedUnits,
      defaults
    };
    gamePackage.modeDerivatives = [
      ...(gamePackage.modeDerivatives || []),
      { source: 'versus', target: 'unit_comparison', fields: ['allowedUnits', 'enabledUnits', 'leftUnitRoster', 'rightUnitRoster'] }
    ];
    return modes;
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
        report: null,
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
      report: null,
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
    const indexedPackage = packageId ? getIndexedGamePackage(packageId) : null;
    const manifestPath = indexedPackage
      ? indexedPackage.manifestPath
      : packageId && !String(manifestPathOrId).includes('/')
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
    gamePackage.report = app.config.packageReports?.createPackageReport
      ? app.config.packageReports.createPackageReport(gamePackage)
      : null;
    return gamePackage;
  }

  async function loadSelectedGamePackage(locationLike = root.location) {
    const search = String(locationLike?.search || '');
    const params = new URLSearchParams(search);
    const packageId = safePackageId(params.get('game') || params.get('package'));
    if (!packageId) return null;
    return loadGamePackage(packageId);
  }

  async function loadGamePackageIndex(path = 'games/index.json') {
    const data = await fetchJson(path);
    const service = app.config.packageManifests;
    const index = service?.normalizePackageIndex
      ? service.normalizePackageIndex(data, path)
      : {
        schemaVersion: Number(data.schemaVersion) || 1,
        name: String(data.name || 'Game Packages'),
        description: String(data.description || ''),
        indexPath: path,
        packages: Array.isArray(data.packages) ? data.packages.map(entry => ({
          id: String(entry.id || ''),
          manifest: String(entry.manifest || `${entry.id}/manifest.json`),
          manifestPath: `games/${String(entry.manifest || `${entry.id}/manifest.json`)}`,
          category: String(entry.category || 'sample'),
          style: String(entry.style || ''),
          featured: entry.featured === true,
          tags: Array.isArray(entry.tags) ? entry.tags.map(String) : []
        })) : []
      };
    const validation = service?.validatePackageIndex?.(data, { indexPath: path });
    if (validation && !validation.valid) {
      loadState.errors.push(...validation.errors);
    }
    loadState.packageIndex = index;
    return index;
  }

  function applyGamePackage(baseDefinitions = {}, gamePackage = loadState.activeGamePackage) {
    if (!gamePackage) return baseDefinitions;
    const content = gamePackage.content || {};
    const mode = gamePackage.mergeMode || 'merge';
    const merged = { ...baseDefinitions };
    for (const key of PACKAGE_FILE_KEYS) {
      if (key === 'scenarios' || content[key] === undefined) continue;
      if (key === 'modes') {
        merged[key] = applyPackageModeDerivatives(
          mergeModeOverrides(baseDefinitions[key] || {}, content[key], gamePackage),
          gamePackage
        );
        continue;
      }
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
      modeOverrides: [...(gamePackage.modeOverrides || [])],
      modeDerivatives: [...(gamePackage.modeDerivatives || [])],
      ignoredModeIds: [...(gamePackage.ignoredModeIds || [])],
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

  function listAvailableGamePackages(filters = {}) {
    const index = loadState.packageIndex;
    if (!index) return [];
    const packages = app.config.packageManifests?.searchPackageIndex
      ? app.config.packageManifests.searchPackageIndex(index, filters)
      : [...(index.packages || [])];
    return packages.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
  }

  function getIndexedGamePackage(id) {
    const packageId = safePackageId(id);
    if (!packageId || !loadState.packageIndex) return null;
    return (loadState.packageIndex.packages || []).find(entry => entry.id === packageId) || null;
  }

  async function loadIndexedGamePackage(id) {
    const entry = getIndexedGamePackage(id);
    return loadGamePackage(entry ? entry.manifestPath : id);
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

  function createGamePackageReport(id = '') {
    const gamePackage = id ? getGamePackage(id) : loadState.activeGamePackage;
    if (!gamePackage || !app.config.packageReports?.createPackageReport) return null;
    gamePackage.report = app.config.packageReports.createPackageReport(gamePackage);
    return gamePackage.report;
  }

  function describe() {
    return {
      schemaVersion: 1,
      loaded: loadState.loaded,
      count: packs.size,
      gamePackageCount: gamePackages.size,
      availableGamePackageCount: loadState.packageIndex?.packages?.length || 0,
      errors: [...loadState.errors],
      packageIndex: loadState.packageIndex ? {
        name: loadState.packageIndex.name,
        description: loadState.packageIndex.description,
        indexPath: loadState.packageIndex.indexPath,
        fingerprint: loadState.packageIndex.fingerprint,
        packageCount: loadState.packageIndex.packages.length,
        facets: app.config.packageManifests?.getIndexFacets
          ? app.config.packageManifests.getIndexFacets(loadState.packageIndex)
          : { categories: [], tags: [], featured: [] },
        report: app.config.packageReports?.createIndexReport
          ? app.config.packageReports.createIndexReport(loadState.packageIndex, listGamePackages())
          : null
      } : null,
      activeGamePackage: loadState.activeGamePackage ? {
        id: loadState.activeGamePackage.id,
        name: loadState.activeGamePackage.name,
        version: loadState.activeGamePackage.version,
        fingerprint: loadState.activeGamePackage.fingerprint,
        report: loadState.activeGamePackage.report
          ? {
            summary: { ...loadState.activeGamePackage.report.summary },
            capabilities: { ...loadState.activeGamePackage.report.capabilities },
            diagnosticSummary: { ...loadState.activeGamePackage.report.diagnosticSummary }
          }
          : null,
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
        report: gamePackage.report
          ? {
            summary: { ...gamePackage.report.summary },
            diagnosticSummary: { ...gamePackage.report.diagnosticSummary }
          }
          : null,
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
    loadGamePackageIndex,
    loadIndexedGamePackage,
    applyGamePackage,
    getGamePackage,
    getIndexedGamePackage,
    listGamePackages,
    listAvailableGamePackages,
    createGamePackageLock,
    createGamePackageReport,
    describe,
    loadState
  });
  app.diagnostics?.register?.('content-packs', describe);
})(globalThis);
