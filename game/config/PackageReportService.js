(function registerPackageReportService(global) {
  'use strict';

  const app = global.OpenRTS = global.OpenRTS || {};
  app.config = app.config || {};

  const RECOMMENDED_FILE_KEYS = Object.freeze([
    'rulesets',
    'factions',
    'units',
    'buildings',
    'weapons',
    'terrainPresets',
    'modes'
  ]);

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function keysOf(value) {
    return isPlainObject(value) ? Object.keys(value).sort() : [];
  }

  function countRecords(content, key) {
    return keysOf(content?.[key]).length;
  }

  function sortedValues(values) {
    return [...new Set(values.filter(value => value !== undefined && value !== null).map(String).filter(Boolean))].sort();
  }

  function collectResourceTypes(rulesets = {}) {
    return sortedValues(Object.values(rulesets).flatMap(ruleset => keysOf(ruleset.resources)));
  }

  function collectRulesetFields(rulesets = {}, field) {
    return sortedValues(Object.values(rulesets).flatMap(ruleset => keysOf(ruleset[field])));
  }

  function collectUnitCapabilities(units = {}) {
    const records = Object.values(units).filter(isPlainObject);
    return {
      eras: sortedValues(records.map(unit => unit.era)),
      roles: sortedValues(records.map(unit => unit.role)),
      weapons: sortedValues(records.map(unit => unit.weapon)),
      armorTypes: sortedValues(records.map(unit => unit.armorType)),
      movementTypes: sortedValues(records.map(unit => unit.movementType || 'ground')),
      models: sortedValues(records.map(unit => unit.model)),
      tags: sortedValues(records.flatMap(unit => Array.isArray(unit.tags) ? unit.tags : [])),
      hasAirUnits: records.some(unit => unit.movementType === 'air' || Number(unit.flightHeight) > 0),
      hasWorkers: records.some(unit => {
        const haystack = `${unit.role || ''} ${(unit.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes('worker') || haystack.includes('builder');
      }),
      hasSplashUnits: records.some(unit => Number(unit.splashRadius || unit.areaRadius || 0) > 0)
    };
  }

  function collectBuildingCapabilities(buildings = {}) {
    const records = Object.values(buildings).filter(isPlainObject);
    return {
      models: sortedValues(records.map(building => building.model || building.type)),
      tags: sortedValues(records.flatMap(building => Array.isArray(building.tags) ? building.tags : [])),
      hasProduction: records.some(building => Array.isArray(building.produces) && building.produces.length > 0),
      hasDefense: records.some(building => Number(building.damage || building.range || 0) > 0),
      hasResourceDropoff: records.some(building => {
        const haystack = `${building.role || ''} ${(building.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes('dropoff') || haystack.includes('resource');
      })
    };
  }

  function validateCrossReferences(content = {}) {
    const diagnostics = [];
    const units = content.units || {};
    const buildings = content.buildings || {};
    const weapons = content.weapons || {};
    const factions = content.factions || {};
    const modes = content.modes || {};
    const unitIds = new Set(keysOf(units));
    const buildingIds = new Set(keysOf(buildings));
    const weaponIds = new Set(keysOf(weapons));

    for (const [unitId, unit] of Object.entries(units)) {
      if (unit.weapon && weaponIds.size > 0 && !weaponIds.has(unit.weapon)) {
        diagnostics.push({ level: 'error', code: 'missing_unit_weapon', message: `unit "${unitId}" references missing weapon "${unit.weapon}"` });
      }
    }

    for (const [factionId, faction] of Object.entries(factions)) {
      for (const unitId of Array.isArray(faction.units) ? faction.units : []) {
        if (!unitIds.has(unitId)) diagnostics.push({ level: 'error', code: 'missing_faction_unit', message: `faction "${factionId}" references missing unit "${unitId}"` });
      }
      for (const buildingId of Array.isArray(faction.buildings) ? faction.buildings : []) {
        if (!buildingIds.has(buildingId)) diagnostics.push({ level: 'error', code: 'missing_faction_building', message: `faction "${factionId}" references missing building "${buildingId}"` });
      }
    }

    for (const [modeId, mode] of Object.entries(modes)) {
      for (const unitId of Array.isArray(mode.allowedUnits) ? mode.allowedUnits : []) {
        if (!unitIds.has(unitId)) diagnostics.push({ level: 'warning', code: 'missing_mode_unit', message: `mode "${modeId}" allows unit "${unitId}" that is not in this package` });
      }
    }

    return diagnostics;
  }

  function createDiagnostics(gamePackage, content) {
    const diagnostics = [];
    const files = gamePackage?.files || {};
    for (const key of RECOMMENDED_FILE_KEYS) {
      if (!files[key]) diagnostics.push({ level: 'warning', code: 'missing_recommended_file', message: `package does not declare recommended file "${key}"` });
    }
    for (const error of gamePackage?.errors || []) {
      diagnostics.push({ level: 'error', code: 'load_error', message: String(error) });
    }
    if (countRecords(content, 'rulesets') === 0) diagnostics.push({ level: 'warning', code: 'no_rulesets', message: 'package does not define rulesets' });
    if (countRecords(content, 'factions') === 0) diagnostics.push({ level: 'warning', code: 'no_factions', message: 'package does not define factions' });
    if (countRecords(content, 'units') === 0) diagnostics.push({ level: 'warning', code: 'no_units', message: 'package does not define units' });
    if (app.config.contentSchemas?.validatePackageContent) {
      diagnostics.push(...app.config.contentSchemas.validatePackageContent(content, { warnUnknownFields: false }).map(diagnostic => ({
        level: diagnostic.level,
        code: `schema_${diagnostic.schemaId}`,
        message: diagnostic.field
          ? `${diagnostic.schemaId} "${diagnostic.recordId}" ${diagnostic.message}`
          : `${diagnostic.schemaId} "${diagnostic.recordId}" ${diagnostic.message}`
      })));
    }
    diagnostics.push(...validateCrossReferences(content));
    return diagnostics;
  }

  function summarizeDiagnostics(diagnostics) {
    return {
      errors: diagnostics.filter(item => item.level === 'error').length,
      warnings: diagnostics.filter(item => item.level === 'warning').length,
      info: diagnostics.filter(item => item.level === 'info').length
    };
  }

  function createPackageReport(gamePackage) {
    const content = gamePackage?.content || {};
    const diagnostics = createDiagnostics(gamePackage, content);
    const report = {
      schemaVersion: 1,
      package: {
        id: String(gamePackage?.id || ''),
        name: String(gamePackage?.name || gamePackage?.id || ''),
        version: String(gamePackage?.version || ''),
        engineVersion: String(gamePackage?.engineVersion || ''),
        mergeMode: String(gamePackage?.mergeMode || 'merge'),
        manifestPath: String(gamePackage?.manifestPath || ''),
        fingerprint: String(gamePackage?.fingerprint || '')
      },
      summary: {
        rulesets: countRecords(content, 'rulesets'),
        factions: countRecords(content, 'factions'),
        units: countRecords(content, 'units'),
        buildings: countRecords(content, 'buildings'),
        weapons: countRecords(content, 'weapons'),
        abilities: countRecords(content, 'abilities'),
        terrainPresets: countRecords(content, 'terrainPresets'),
        modes: countRecords(content, 'modes'),
        scenarios: countRecords(content, 'scenarios')
      },
      files: keysOf(gamePackage?.files).map(key => ({ key, file: String(gamePackage.files[key] || '') })),
      capabilities: {
        resources: collectResourceTypes(content.rulesets),
        damageTypes: collectRulesetFields(content.rulesets, 'damageTypes'),
        armorTags: collectRulesetFields(content.rulesets, 'armorTags'),
        effectTypes: collectRulesetFields(content.rulesets, 'effectTypes'),
        units: collectUnitCapabilities(content.units),
        buildings: collectBuildingCapabilities(content.buildings),
        modes: keysOf(content.modes),
        terrainPresets: keysOf(content.terrainPresets)
      },
      diagnostics,
      diagnosticSummary: summarizeDiagnostics(diagnostics)
    };
    return Object.freeze(report);
  }

  function createIndexReport(index, loadedPackages = []) {
    const packages = index?.packages || [];
    const loadedById = new Map((Array.isArray(loadedPackages) ? loadedPackages : []).map(gamePackage => [gamePackage.id, gamePackage]));
    return Object.freeze({
      schemaVersion: 1,
      indexPath: String(index?.indexPath || ''),
      packageCount: packages.length,
      categories: sortedValues(packages.map(entry => entry.category)),
      tags: sortedValues(packages.flatMap(entry => entry.tags || [])),
      featured: packages.filter(entry => entry.featured).map(entry => entry.id),
      packages: packages.map(entry => {
        const loaded = loadedById.get(entry.id);
        return {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          style: entry.style,
          tags: [...entry.tags],
          featured: entry.featured,
          loaded: !!loaded,
          diagnostics: loaded?.report?.diagnosticSummary || null
        };
      })
    });
  }

  app.config.packageReports = Object.freeze({
    RECOMMENDED_FILE_KEYS,
    createPackageReport,
    createIndexReport,
    collectResourceTypes,
    collectUnitCapabilities,
    collectBuildingCapabilities,
    validateCrossReferences
  });
})(globalThis);
