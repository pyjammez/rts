import fs from 'node:fs';
import path from 'node:path';

export const CONTENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const FALLBACK_FILES = Object.freeze({
  abilities: 'abilities.json',
  weapons: 'weapons.json',
  rulesets: 'rulesets.json',
  factions: 'factions.json',
  units: 'units.json',
  unitPacks: 'unit-packs.json',
  buildings: 'buildings.json',
  assets: 'assets.json',
  terrainPresets: 'terrain-presets.json',
  modes: 'game-modes.json'
});

const KNOWN_MANIFEST_KEYS = new Set(Object.keys(FALLBACK_FILES));
const REQUIRED_MANIFEST_KEYS = ['abilities', 'weapons', 'rulesets', 'factions', 'units', 'buildings', 'terrainPresets', 'modes'];
const ABILITY_TYPES = new Set(['active', 'passive', 'job']);
const MOVEMENT_TYPES = new Set(['ground', 'air', 'water', 'amphibious']);
const MODE_SECTIONS = new Set([
  'map',
  'forces',
  'wildlife',
  'defense',
  'comparison',
  'comparison_left',
  'comparison_right',
  'map_builder'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function isSafeDataPath(filePath) {
  return typeof filePath === 'string'
    && !path.isAbsolute(filePath)
    && !filePath.split(/[\\/]+/).includes('..')
    && filePath.startsWith('assets/data/');
}

function manifestFilePath(root, manifest, key) {
  const fallback = `assets/data/${FALLBACK_FILES[key]}`;
  return path.join(root, manifest.files?.[key] || fallback);
}

function fallbackValueFor(key) {
  return key === 'unitPacks' ? {} : {};
}

function addIdError(errors, id, context) {
  if (!CONTENT_ID_PATTERN.test(id)) {
    errors.push(`${context} id "${id}" must match ${CONTENT_ID_PATTERN}`);
  }
}

function validateMap(errors, map, context) {
  if (!isPlainObject(map)) {
    errors.push(`${context} must be an object keyed by id`);
    return false;
  }
  for (const [id, entry] of Object.entries(map)) {
    addIdError(errors, id, context);
    if (!isPlainObject(entry)) {
      errors.push(`${context} "${id}" must be an object`);
      continue;
    }
    if (entry.id !== undefined && entry.id !== id) {
      errors.push(`${context} "${id}" has mismatched embedded id "${entry.id}"`);
    }
  }
  return true;
}

function validateString(errors, value, context, field, { required = false } = {}) {
  if (!hasValue(value)) {
    if (required) errors.push(`${context} needs a ${field}`);
    return;
  }
  if (typeof value !== 'string') errors.push(`${context} ${field} must be a string`);
}

function validateBoolean(errors, value, context, field) {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${context} ${field} must be a boolean`);
  }
}

function validateNumber(errors, value, context, field, { required = false, positive = false, integer = false, min = undefined, max = undefined } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${context} needs ${field}`);
    return;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${context} ${field} must be a finite number`);
    return;
  }
  if (integer && !Number.isInteger(number)) errors.push(`${context} ${field} must be an integer`);
  if (positive && number <= 0) errors.push(`${context} ${field} must be positive`);
  if (min !== undefined && number < min) errors.push(`${context} ${field} must be at least ${min}`);
  if (max !== undefined && number > max) errors.push(`${context} ${field} must be at most ${max}`);
}

function validateStringArray(errors, value, context, field, { ids = false } = {}) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${context} ${field} must be an array`);
    return [];
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string') errors.push(`${context} ${field}[${index}] must be a string`);
    if (ids && typeof item === 'string') addIdError(errors, item, `${context} ${field}`);
  });
  return value.filter(item => typeof item === 'string');
}

function requireEntry(errors, collection, id, context) {
  if (!id) return;
  if (!collection[id]) errors.push(`${context} references unknown id "${id}"`);
}

function validateManifest(errors, manifest, root) {
  if (!isPlainObject(manifest)) {
    errors.push('content-manifest.json must be an object');
    return;
  }
  if (Number(manifest.schemaVersion) !== 1) errors.push('content-manifest.json must set schemaVersion to 1');
  validateString(errors, manifest.contentVersion, 'content-manifest.json', 'contentVersion', { required: true });
  validateString(errors, manifest.name, 'content-manifest.json', 'name');
  validateString(errors, manifest.description, 'content-manifest.json', 'description');

  if (!isPlainObject(manifest.files)) {
    errors.push('content-manifest.json needs a files object');
    return;
  }

  for (const key of Object.keys(manifest.files)) {
    if (!KNOWN_MANIFEST_KEYS.has(key)) errors.push(`content-manifest.json declares unknown file key "${key}"`);
    const declaredPath = manifest.files[key];
    if (!isSafeDataPath(declaredPath)) {
      errors.push(`content-manifest.json file "${key}" must stay under assets/data/`);
      continue;
    }
    const filePath = path.join(root, declaredPath);
    if (!fs.existsSync(filePath)) errors.push(`content-manifest.json file "${key}" does not exist at ${declaredPath}`);
  }

  const required = validateStringArray(errors, manifest.required, 'content-manifest.json', 'required', { ids: false });
  const optional = validateStringArray(errors, manifest.optional, 'content-manifest.json', 'optional', { ids: false });
  for (const key of [...required, ...optional]) {
    if (!KNOWN_MANIFEST_KEYS.has(key)) errors.push(`content-manifest.json references unknown manifest key "${key}"`);
  }
  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (!manifest.files[key]) errors.push(`content-manifest.json must declare "${key}" in files`);
  }
  for (const key of required) {
    if (!manifest.files[key]) errors.push(`content-manifest.json required key "${key}" is not declared in files`);
  }
}

function validateAbilityList(errors, abilities, abilityIds, context) {
  const ids = validateStringArray(errors, abilityIds, context, 'abilities', { ids: true });
  ids.forEach(abilityId => requireEntry(errors, abilities, abilityId, context));
}

function validateAbility(errors, abilityId, ability) {
  const context = `ability "${abilityId}"`;
  if (!isPlainObject(ability)) return;
  validateString(errors, ability.name, context, 'name', { required: true });
  validateString(errors, ability.summary, context, 'summary');
  if (!ABILITY_TYPES.has(ability.type)) errors.push(`${context} type must be one of ${Array.from(ABILITY_TYPES).join(', ')}`);
  validateString(errors, ability.target, context, 'target');
  validateNumber(errors, ability.range, context, 'range', { min: 0 });
  validateNumber(errors, ability.cooldown, context, 'cooldown', { min: 0 });
  validateResourceBundle(errors, ability.cost, null, `${context} cost`);
  validateStringArray(errors, ability.tags, context, 'tags');

  const effects = ability.effects !== undefined
    ? ability.effects
    : ability.effect !== undefined
      ? [ability.effect]
      : [];
  if (!Array.isArray(effects)) {
    errors.push(`${context} effects must be an array`);
  } else {
    effects.forEach((effect, index) => {
      const effectContext = `${context} effect[${index}]`;
      if (!isPlainObject(effect)) {
        errors.push(`${effectContext} must be an object`);
        return;
      }
      validateString(errors, effect.type, effectContext, 'type');
      validateString(errors, effect.stat, effectContext, 'stat');
      validateString(errors, effect.target, effectContext, 'target');
      validateNumber(errors, effect.amount, effectContext, 'amount');
      validateNumber(errors, effect.damage, effectContext, 'damage', { min: 0 });
      validateNumber(errors, effect.duration, effectContext, 'duration', { min: 0 });
      validateNumber(errors, effect.splashRadius, effectContext, 'splashRadius', { min: 0 });
    });
  }
}

function validateResourceBundle(errors, bundle, resources, context) {
  if (bundle === undefined) return;
  if (!isPlainObject(bundle)) {
    errors.push(`${context} must be an object keyed by resource id`);
    return;
  }
  for (const [resourceId, amount] of Object.entries(bundle)) {
    addIdError(errors, resourceId, context);
    if (resources && !resources[resourceId]) errors.push(`${context} references unknown resource "${resourceId}"`);
    validateNumber(errors, amount, context, `${resourceId} amount`, { min: 0 });
  }
}

function validateRuleset(errors, rulesetId, ruleset, content) {
  const context = `ruleset "${rulesetId}"`;
  if (!isPlainObject(ruleset)) return;
  validateString(errors, ruleset.name, context, 'name', { required: true });
  validateString(errors, ruleset.summary, context, 'summary');
  if (ruleset.extends) requireEntry(errors, content.rulesets, ruleset.extends, context);
  for (const field of ['resources', 'damageTypes', 'armorTags', 'effectTypes']) {
    if (ruleset[field] !== undefined && !isPlainObject(ruleset[field])) errors.push(`${context} ${field} must be an object keyed by id`);
  }
  for (const [resourceId, resource] of Object.entries(ruleset.resources || {})) {
    addIdError(errors, resourceId, `${context} resource`);
    if (!isPlainObject(resource)) {
      errors.push(`${context} resource "${resourceId}" must be an object`);
      continue;
    }
    validateString(errors, resource.name, `${context} resource "${resourceId}"`, 'name', { required: true });
    validateString(errors, resource.storage, `${context} resource "${resourceId}"`, 'storage');
    validateNumber(errors, resource.defaultStartingAmount, `${context} resource "${resourceId}"`, 'defaultStartingAmount', { min: 0 });
    validateBoolean(errors, resource.gatherable, `${context} resource "${resourceId}"`, 'gatherable');
  }
  for (const [damageTypeId, damageType] of Object.entries(ruleset.damageTypes || {})) {
    addIdError(errors, damageTypeId, `${context} damage type`);
    if (!isPlainObject(damageType)) {
      errors.push(`${context} damage type "${damageTypeId}" must be an object`);
      continue;
    }
    validateString(errors, damageType.name, `${context} damage type "${damageTypeId}"`, 'name', { required: true });
    if (damageType.modifiers !== undefined && !isPlainObject(damageType.modifiers)) {
      errors.push(`${context} damage type "${damageTypeId}" modifiers must be an object`);
    }
    for (const [armorTag, multiplier] of Object.entries(damageType.modifiers || {})) {
      addIdError(errors, armorTag, `${context} damage type "${damageTypeId}" modifier`);
      validateNumber(errors, multiplier, `${context} damage type "${damageTypeId}"`, `${armorTag} multiplier`, { min: 0 });
    }
  }
  for (const [tagId, tag] of Object.entries(ruleset.armorTags || {})) {
    addIdError(errors, tagId, `${context} armor tag`);
    if (!isPlainObject(tag)) errors.push(`${context} armor tag "${tagId}" must be an object`);
  }
}

function validateProductionMap(errors, production, content, context) {
  if (production === undefined) return;
  if (!isPlainObject(production)) {
    errors.push(`${context} must be an object keyed by producer building id`);
    return;
  }
  for (const [buildingId, queue] of Object.entries(production)) {
    addIdError(errors, buildingId, context);
    requireEntry(errors, content.buildings, buildingId, context);
    if (!isPlainObject(queue)) {
      errors.push(`${context} "${buildingId}" must be an object`);
      continue;
    }
    validateStringArray(errors, queue.train, `${context} "${buildingId}"`, 'train', { ids: true })
      .forEach(unitId => requireEntry(errors, content.catalogUnits, unitId, `${context} "${buildingId}" train`));
    validateStringArray(errors, queue.research, `${context} "${buildingId}"`, 'research', { ids: true })
      .forEach(abilityId => requireEntry(errors, content.abilities, abilityId, `${context} "${buildingId}" research`));
  }
}

function validateFaction(errors, factionId, faction, content) {
  const context = `faction "${factionId}"`;
  if (!isPlainObject(faction)) return;
  validateString(errors, faction.name, context, 'name', { required: true });
  validateString(errors, faction.summary, context, 'summary');
  validateString(errors, faction.theme, context, 'theme');
  validateString(errors, faction.color, context, 'color');
  requireEntry(errors, content.rulesets, faction.ruleset, context);
  const rulesetResources = content.rulesets[faction.ruleset]?.resources || null;
  validateResourceBundle(errors, faction.startingResources, rulesetResources, `${context} startingResources`);
  validateRoster(errors, faction.startingUnits, content, `${context} startingUnits`);
  if (faction.startingBuildings !== undefined) {
    if (!isPlainObject(faction.startingBuildings)) errors.push(`${context} startingBuildings must be an object keyed by building id`);
    for (const [buildingId, count] of Object.entries(faction.startingBuildings || {})) {
      addIdError(errors, buildingId, `${context} startingBuildings`);
      requireEntry(errors, content.buildings, buildingId, `${context} startingBuildings`);
      validateNumber(errors, count, `${context} startingBuildings`, `${buildingId} count`, { integer: true, min: 0 });
    }
  }
  validateStringArray(errors, faction.units, context, 'units', { ids: true })
    .forEach(unitId => requireEntry(errors, content.catalogUnits, unitId, context));
  validateStringArray(errors, faction.buildings, context, 'buildings', { ids: true })
    .forEach(buildingId => requireEntry(errors, content.buildings, buildingId, context));
  validateProductionMap(errors, faction.production, content, `${context} production`);
  if (faction.techTree !== undefined && !isPlainObject(faction.techTree)) errors.push(`${context} techTree must be an object`);
  validateStringArray(errors, faction.techTree?.rootBuildings, `${context} techTree`, 'rootBuildings', { ids: true })
    .forEach(buildingId => requireEntry(errors, content.buildings, buildingId, `${context} techTree rootBuildings`));
}

function validateAssets(errors, assets) {
  if (assets === undefined) return;
  if (!isPlainObject(assets)) {
    errors.push('assets must be an object');
    return;
  }
  validateNumber(errors, assets.schemaVersion, 'assets', 'schemaVersion', { required: true, positive: true, integer: true });
  for (const group of ['models', 'textures', 'sounds']) {
    if (assets[group] === undefined) continue;
    if (!isPlainObject(assets[group])) {
      errors.push(`assets ${group} must be an object keyed by id`);
      continue;
    }
    for (const [assetId, asset] of Object.entries(assets[group])) {
      if (!/^[a-z][a-z0-9_.-]*$/.test(assetId)) {
        errors.push(`assets ${group} id "${assetId}" must use lowercase stable asset keys`);
      }
      if (!isPlainObject(asset)) {
        errors.push(`assets ${group} "${assetId}" must be an object`);
        continue;
      }
      validateString(errors, asset.url, `assets ${group} "${assetId}"`, 'url');
      validateString(errors, asset.kind, `assets ${group} "${assetId}"`, 'kind');
      validateString(errors, asset.renderer, `assets ${group} "${assetId}"`, 'renderer');
      validateString(errors, asset.factory, `assets ${group} "${assetId}"`, 'factory');
    }
  }
}

function validateWeapon(errors, weaponId, weapon) {
  const context = `weapon "${weaponId}"`;
  if (!isPlainObject(weapon)) return;
  validateString(errors, weapon.name, context, 'name', { required: true });
  validateNumber(errors, weapon.damage, context, 'damage', { required: true, min: 0 });
  validateNumber(errors, weapon.movingDamage, context, 'movingDamage', { min: 0 });
  validateNumber(errors, weapon.range, context, 'range', { required: true, positive: true });
  validateNumber(errors, weapon.stopRange, context, 'stopRange', { min: 0 });
  validateNumber(errors, weapon.fireRate, context, 'fireRate', { min: 0 });
  validateNumber(errors, weapon.attackCooldown, context, 'attackCooldown', { min: 0 });
  validateNumber(errors, weapon.projectileSpeed, context, 'projectileSpeed', { min: 0 });
  validateNumber(errors, weapon.splashRadius, context, 'splashRadius', { min: 0 });
  validateString(errors, weapon.projectileColor, context, 'projectileColor');
  validateString(errors, weapon.projectileType, context, 'projectileType');
  validateString(errors, weapon.damageType, context, 'damageType');
  validateBoolean(errors, weapon.melee, context, 'melee');
}

function validateUnit(errors, unitId, unit, content, context) {
  if (!isPlainObject(unit)) return;
  validateString(errors, unit.name, context, 'name', { required: true });
  validateString(errors, unit.role, context, 'role');
  validateString(errors, unit.model, context, 'model');
  if (unit.model && content.assets?.models && !content.assets.models[`unit.${unit.model}`]) {
    errors.push(`${context} model "${unit.model}" is missing asset model "unit.${unit.model}"`);
  }
  validateString(errors, unit.era, context, 'era');
  validateString(errors, unit.armorType, context, 'armorType');
  validateString(errors, unit.damageType, context, 'damageType');
  validateNumber(errors, unit.hp, context, 'hp', { required: true, positive: true });
  validateNumber(errors, unit.speed, context, 'speed', { required: true, positive: true });
  validateNumber(errors, unit.size, context, 'size', { required: true, positive: true });
  validateNumber(errors, unit.maxPerTeam, context, 'maxPerTeam', { positive: true, integer: true });
  validateNumber(errors, unit.trainTime, context, 'trainTime', { min: 0 });
  validateNumber(errors, unit.buildTime, context, 'buildTime', { min: 0 });
  validateNumber(errors, unit.supply, context, 'supply', { min: 0 });
  validateResourceBundle(errors, unit.cost, null, `${context} cost`);
  validateNumber(errors, unit.damage, context, 'damage', { min: 0 });
  validateNumber(errors, unit.range, context, 'range', { min: 0 });
  validateNumber(errors, unit.flightHeight, context, 'flightHeight', { min: 0 });
  validateBoolean(errors, unit.requiredPerTeam, context, 'requiredPerTeam');
  validateBoolean(errors, unit.canTargetAir, context, 'canTargetAir');
  validateBoolean(errors, unit.canTargetGround, context, 'canTargetGround');
  validateStringArray(errors, unit.tags, context, 'tags');
  validateAbilityList(errors, content.abilities, unit.abilities, context);

  if (unit.weapon) requireEntry(errors, content.weapons, unit.weapon, context);
  if (unit.movementType !== undefined && !MOVEMENT_TYPES.has(unit.movementType)) {
    errors.push(`${context} movementType must be one of ${Array.from(MOVEMENT_TYPES).join(', ')}`);
  }
  if (unit.requiredPerTeam && Number(unit.maxPerTeam) !== 1) {
    errors.push(`required ${context} must set maxPerTeam to 1`);
  }
}

function validateBuilding(errors, buildingId, building, content) {
  const context = `building "${buildingId}"`;
  if (!isPlainObject(building)) return;
  validateString(errors, building.name, context, 'name', { required: true });
  validateString(errors, building.model, context, 'model');
  if (building.model && content.assets?.models && !content.assets.models[`building.${building.model}`]) {
    errors.push(`${context} model "${building.model}" is missing asset model "building.${building.model}"`);
  }
  validateNumber(errors, building.width, context, 'width', { required: true, positive: true, integer: true });
  validateNumber(errors, building.height, context, 'height', { required: true, positive: true, integer: true });
  validateNumber(errors, building.hp, context, 'hp', { required: true, positive: true });
  validateNumber(errors, building.size, context, 'size', { positive: true });
  validateNumber(errors, building.buildTime, context, 'buildTime', { min: 0 });
  validateNumber(errors, building.powerProvided, context, 'powerProvided');
  validateNumber(errors, building.powerRequired, context, 'powerRequired', { min: 0 });
  validateResourceBundle(errors, building.cost, null, `${context} cost`);
  validateNumber(errors, building.range, context, 'range', { min: 0 });
  validateNumber(errors, building.damage, context, 'damage', { min: 0 });
  validateNumber(errors, building.attackCooldown, context, 'attackCooldown', { min: 0 });
  validateNumber(errors, building.projectileSpeed, context, 'projectileSpeed', { min: 0 });
  validateString(errors, building.projectileColor, context, 'projectileColor');
  validateString(errors, building.armorType, context, 'armorType');
  validateBoolean(errors, building.canTargetAir, context, 'canTargetAir');
  validateBoolean(errors, building.canTargetGround, context, 'canTargetGround');
  if (building.weapon) requireEntry(errors, content.weapons, building.weapon, context);
}

function validateTerrainPreset(errors, presetId, preset) {
  const context = `terrain preset "${presetId}"`;
  if (!isPlainObject(preset)) return;
  validateString(errors, preset.name, context, 'name', { required: true });
  validateNumber(errors, preset.waterLevel, context, 'waterLevel', { required: true, min: 0, max: 100 });
  for (const field of ['rockCount', 'treeCount', 'sheepCount', 'duckCount', 'goldMineCount', 'houseCount']) {
    validateNumber(errors, preset[field], context, field, { min: 0, integer: true });
  }
}

function validateRoster(errors, roster, content, context) {
  if (roster === undefined) return;
  if (!isPlainObject(roster)) {
    errors.push(`${context} must be an object keyed by unit id`);
    return;
  }
  for (const [unitId, countValue] of Object.entries(roster)) {
    addIdError(errors, unitId, context);
    requireEntry(errors, content.catalogUnits, unitId, context);
    validateNumber(errors, countValue, context, `${unitId} count`, { integer: true, min: 0 });
    const maximum = Number(content.catalogUnits[unitId]?.maxPerTeam);
    if (Number.isFinite(maximum) && Number(countValue) > maximum) {
      errors.push(`${context} requests ${countValue} ${unitId} units; maximum is ${maximum}`);
    }
  }
}

function validateMode(errors, modeId, mode, content) {
  const context = `mode "${modeId}"`;
  if (!isPlainObject(mode)) return;
  validateString(errors, mode.shortName, context, 'shortName');
  validateString(errors, mode.name, context, 'name', { required: true });
  validateString(errors, mode.summary, context, 'summary');
  validateString(errors, mode.startLabel, context, 'startLabel');
  validateBoolean(errors, mode.playable, context, 'playable');
  validateStringArray(errors, mode.teams, context, 'teams');

  const sections = validateStringArray(errors, mode.sections, context, 'sections');
  sections.forEach(section => {
    if (!MODE_SECTIONS.has(section)) errors.push(`${context} declares unknown setup section "${section}"`);
  });

  const allowedUnits = validateStringArray(errors, mode.allowedUnits, context, 'allowedUnits', { ids: true });
  allowedUnits.forEach(unitId => requireEntry(errors, content.catalogUnits, unitId, context));
  const enabledUnits = validateStringArray(errors, mode.defaults?.enabledUnits, `${context} defaults`, 'enabledUnits', { ids: true });
  enabledUnits.forEach(unitId => requireEntry(errors, content.catalogUnits, unitId, `${context} enabledUnits`));

  if (!isPlainObject(mode.defaults)) {
    errors.push(`${context} needs defaults`);
    return;
  }
  requireEntry(errors, content.terrainPresets, mode.defaults.mapStyle, context);
  validateRoster(errors, mode.defaults.unitRoster, content, `${context} roster`);
  validateRoster(errors, mode.defaults.leftUnitRoster, content, `${context} left roster`);
  validateRoster(errors, mode.defaults.rightUnitRoster, content, `${context} right roster`);

  for (const field of [
    'waterLevel',
    'rockCount',
    'treeCount',
    'sheepCount',
    'duckCount',
    'goldMineCount',
    'houseCount',
    'startingGold',
    'startingWood',
    'startingFood',
    'playersPerTeam',
    'startingUnitsPerTeam',
    'towersPerTeam',
    'homesPerTeam',
    'waveCount',
    'pathComplexity',
    'towerSlots',
    'arenaSize'
  ]) {
    validateNumber(errors, mode.defaults[field], `${context} defaults`, field, { min: 0, integer: true });
  }
}

export function loadContent({ root = process.cwd() } = {}) {
  const manifestPath = path.join(root, 'assets/data/content-manifest.json');
  const manifest = readJson(manifestPath);
  const content = {
    root,
    manifest,
    manifestPath,
    filePaths: {},
    loadErrors: []
  };

  for (const key of Object.keys(FALLBACK_FILES)) {
    const filePath = manifestFilePath(root, manifest, key);
    content.filePaths[key] = filePath;
    const declaredPath = manifest.files?.[key] || `assets/data/${FALLBACK_FILES[key]}`;
    if (!isSafeDataPath(declaredPath)) {
      content.loadErrors.push(`content-manifest.json file "${key}" must stay under assets/data/`);
      content[key] = fallbackValueFor(key);
      continue;
    }
    if (!fs.existsSync(filePath)) {
      content.loadErrors.push(`content-manifest.json file "${key}" does not exist at ${declaredPath}`);
      content[key] = fallbackValueFor(key);
      continue;
    }
    try {
      content[key] = readJson(filePath);
    } catch (error) {
      content.loadErrors.push(`content-manifest.json file "${key}" could not be parsed: ${error.message}`);
      content[key] = fallbackValueFor(key);
    }
  }

  return content;
}

export function validateContentData(content, { root = process.cwd() } = {}) {
  const errors = [...(content.loadErrors || [])];
  const normalized = {
    manifest: content.manifest || {},
    abilities: content.abilities || {},
    weapons: content.weapons || {},
    rulesets: content.rulesets || {},
    factions: content.factions || {},
    units: content.units || {},
    unitPacks: content.unitPacks || {},
    buildings: content.buildings || {},
    assets: content.assets || {},
    terrainPresets: content.terrainPresets || {},
    modes: content.modes || {},
    catalogUnits: {}
  };

  validateManifest(errors, normalized.manifest, root);
  validateMap(errors, normalized.abilities, 'abilities');
  validateMap(errors, normalized.weapons, 'weapons');
  validateMap(errors, normalized.rulesets, 'rulesets');
  validateMap(errors, normalized.factions, 'factions');
  validateMap(errors, normalized.units, 'units');
  validateMap(errors, normalized.unitPacks, 'unit packs');
  validateMap(errors, normalized.buildings, 'buildings');
  validateMap(errors, normalized.terrainPresets, 'terrain presets');
  validateMap(errors, normalized.modes, 'modes');
  validateAssets(errors, normalized.assets);

  for (const [abilityId, ability] of Object.entries(normalized.abilities)) validateAbility(errors, abilityId, ability);
  for (const [weaponId, weapon] of Object.entries(normalized.weapons)) validateWeapon(errors, weaponId, weapon);
  for (const [rulesetId, ruleset] of Object.entries(normalized.rulesets)) validateRuleset(errors, rulesetId, ruleset, normalized);
  for (const [unitId, unit] of Object.entries(normalized.units)) {
    validateUnit(errors, unitId, unit, normalized, `unit "${unitId}"`);
    normalized.catalogUnits[unitId] = unit;
  }
  for (const [packId, pack] of Object.entries(normalized.unitPacks)) {
    validateString(errors, pack.name, `unit pack "${packId}"`, 'name', { required: true });
    validateString(errors, pack.summary, `unit pack "${packId}"`, 'summary');
    if (!isPlainObject(pack.units)) {
      errors.push(`unit pack "${packId}" needs a units object`);
      continue;
    }
    for (const [unitId, unit] of Object.entries(pack.units)) {
      addIdError(errors, unitId, `unit pack "${packId}" unit`);
      if (!isPlainObject(unit)) {
        errors.push(`unit pack "${packId}" unit "${unitId}" must be an object`);
        continue;
      }
      if (normalized.catalogUnits[unitId]) errors.push(`unit id "${unitId}" is duplicated by unit pack "${packId}"`);
      validateUnit(errors, unitId, unit, normalized, `unit pack "${packId}" unit "${unitId}"`);
      normalized.catalogUnits[unitId] = unit;
    }
  }
  for (const [buildingId, building] of Object.entries(normalized.buildings)) validateBuilding(errors, buildingId, building, normalized);
  for (const [factionId, faction] of Object.entries(normalized.factions)) validateFaction(errors, factionId, faction, normalized);
  for (const [presetId, preset] of Object.entries(normalized.terrainPresets)) validateTerrainPreset(errors, presetId, preset);
  for (const [modeId, mode] of Object.entries(normalized.modes)) validateMode(errors, modeId, mode, normalized);

  if (!normalized.buildings.home) errors.push('buildings.json must define the home castle');

  const summary = {
    abilities: Object.keys(normalized.abilities).length,
    weapons: Object.keys(normalized.weapons).length,
    rulesets: Object.keys(normalized.rulesets).length,
    factions: Object.keys(normalized.factions).length,
    baseUnits: Object.keys(normalized.units).length,
    catalogUnits: Object.keys(normalized.catalogUnits).length,
    unitPacks: Object.keys(normalized.unitPacks).length,
    buildings: Object.keys(normalized.buildings).length,
    assetModels: Object.keys(normalized.assets?.models || {}).length,
    terrainPresets: Object.keys(normalized.terrainPresets).length,
    modes: Object.keys(normalized.modes).length,
    contentVersion: normalized.manifest.contentVersion || 'unknown'
  };

  return {
    valid: errors.length === 0,
    errors,
    summary
  };
}

export function validateContent(options = {}) {
  const root = options.root || process.cwd();
  const content = loadContent({ root });
  return validateContentData(content, { root });
}
