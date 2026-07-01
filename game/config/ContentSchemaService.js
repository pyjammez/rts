(function registerContentSchemaService(global) {
  'use strict';

  const app = global.OpenRTS = global.OpenRTS || {};
  app.config = app.config || {};

  const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
  const FIELD_TYPES = Object.freeze({
    string: value => typeof value === 'string',
    number: value => Number.isFinite(Number(value)),
    integer: value => Number.isInteger(Number(value)),
    boolean: value => typeof value === 'boolean',
    object: value => !!value && typeof value === 'object' && !Array.isArray(value),
    array: value => Array.isArray(value),
    stringArray: value => Array.isArray(value) && value.every(item => typeof item === 'string'),
    id: value => typeof value === 'string' && ID_PATTERN.test(value),
    idArray: value => Array.isArray(value) && value.every(item => typeof item === 'string' && ID_PATTERN.test(item)),
    resourceBundle: value => !!value && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(value).every(([key, amount]) => ID_PATTERN.test(key) && Number.isFinite(Number(amount)) && Number(amount) >= 0)
  });

  const SCHEMAS = Object.freeze({
    abilities: Object.freeze({
      id: 'abilities',
      label: 'Abilities',
      required: ['name', 'type'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        type: { type: 'string', required: true, values: ['active', 'passive', 'job'] },
        summary: { type: 'string' },
        target: { type: 'string' },
        range: { type: 'number', min: 0 },
        cooldown: { type: 'number', min: 0 },
        cost: { type: 'resourceBundle' },
        tags: { type: 'stringArray' },
        effects: { type: 'array' }
      })
    }),
    weapons: Object.freeze({
      id: 'weapons',
      label: 'Weapons',
      required: ['name', 'damage', 'range'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        damage: { type: 'number', required: true, min: 0 },
        movingDamage: { type: 'number', min: 0 },
        range: { type: 'number', required: true, min: 0 },
        stopRange: { type: 'number', min: 0 },
        fireRate: { type: 'number', min: 0 },
        attackCooldown: { type: 'number', min: 0 },
        projectileSpeed: { type: 'number', min: 0 },
        projectileColor: { type: 'string' },
        projectileType: { type: 'string' },
        splashRadius: { type: 'number', min: 0 },
        melee: { type: 'boolean' }
      })
    }),
    units: Object.freeze({
      id: 'units',
      label: 'Units',
      required: ['name', 'hp', 'speed', 'size'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        hp: { type: 'number', required: true, min: 1 },
        speed: { type: 'number', required: true, min: 0 },
        size: { type: 'number', required: true, min: 1 },
        weapon: { type: 'id' },
        role: { type: 'string' },
        model: { type: 'string' },
        era: { type: 'string' },
        armorType: { type: 'string' },
        movementType: { type: 'string', values: ['ground', 'air', 'water', 'amphibious'] },
        flightHeight: { type: 'number', min: 0 },
        maxPerTeam: { type: 'integer', min: 1 },
        cost: { type: 'resourceBundle' },
        trainTime: { type: 'number', min: 0 },
        abilities: { type: 'idArray' },
        tags: { type: 'stringArray' },
        canTargetAir: { type: 'boolean' },
        canTargetGround: { type: 'boolean' }
      })
    }),
    buildings: Object.freeze({
      id: 'buildings',
      label: 'Buildings',
      required: ['name', 'hp'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        hp: { type: 'number', required: true, min: 1 },
        width: { type: 'number', min: 1 },
        height: { type: 'number', min: 1 },
        size: { type: 'number', min: 1 },
        weapon: { type: 'id' },
        damage: { type: 'number', min: 0 },
        range: { type: 'number', min: 0 },
        attackCooldown: { type: 'number', min: 0 },
        model: { type: 'string' },
        role: { type: 'string' },
        cost: { type: 'resourceBundle' },
        produces: { type: 'idArray' },
        tags: { type: 'stringArray' },
        canTargetAir: { type: 'boolean' },
        canTargetGround: { type: 'boolean' }
      })
    }),
    rulesets: Object.freeze({
      id: 'rulesets',
      label: 'Rulesets',
      required: ['name'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        summary: { type: 'string' },
        extends: { type: 'id' },
        resources: { type: 'object' },
        damageTypes: { type: 'object' },
        armorTags: { type: 'object' },
        effectTypes: { type: 'object' }
      })
    }),
    factions: Object.freeze({
      id: 'factions',
      label: 'Factions',
      required: ['name', 'ruleset'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        summary: { type: 'string' },
        theme: { type: 'string' },
        color: { type: 'string' },
        ruleset: { type: 'id', required: true },
        startingResources: { type: 'resourceBundle' },
        startingUnits: { type: 'object' },
        startingBuildings: { type: 'object' },
        units: { type: 'idArray' },
        buildings: { type: 'idArray' },
        production: { type: 'object' },
        techTree: { type: 'object' }
      })
    }),
    terrainPresets: Object.freeze({
      id: 'terrainPresets',
      label: 'Terrain Presets',
      required: ['name'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        description: { type: 'string' },
        terrain: { type: 'object' },
        waterLevel: { type: 'number', min: 0, max: 100 },
        lava: { type: 'boolean' },
        colors: { type: 'object' }
      })
    }),
    modes: Object.freeze({
      id: 'modes',
      label: 'Game Modes',
      required: ['name'],
      fields: Object.freeze({
        name: { type: 'string', required: true },
        summary: { type: 'string' },
        playable: { type: 'boolean' },
        sections: { type: 'stringArray' },
        allowedUnits: { type: 'idArray' },
        defaults: { type: 'object' },
        rules: { type: 'object' }
      })
    })
  });

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneSchema(schema) {
    return JSON.parse(JSON.stringify(schema));
  }

  function normalizeDiagnostic(level, schemaId, recordId, field, message) {
    return Object.freeze({ level, schemaId, recordId: String(recordId || ''), field: field || '', message });
  }

  function validateField(schemaId, recordId, fieldName, rule, value) {
    const diagnostics = [];
    if (value === undefined || value === null || value === '') {
      if (rule.required) diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, fieldName, `${fieldName} is required`));
      return diagnostics;
    }

    const validator = FIELD_TYPES[rule.type];
    if (validator && !validator(value)) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, fieldName, `${fieldName} must be ${rule.type}`));
      return diagnostics;
    }

    if (Array.isArray(rule.values) && !rule.values.includes(value)) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, fieldName, `${fieldName} must be one of ${rule.values.join(', ')}`));
    }
    if (rule.min !== undefined && Number(value) < Number(rule.min)) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, fieldName, `${fieldName} must be at least ${rule.min}`));
    }
    if (rule.max !== undefined && Number(value) > Number(rule.max)) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, fieldName, `${fieldName} must be at most ${rule.max}`));
    }
    return diagnostics;
  }

  function validateRecord(schemaId, recordId, record, options = {}) {
    const schema = SCHEMAS[schemaId];
    if (!schema) return [normalizeDiagnostic('error', schemaId, recordId, '', `unknown schema "${schemaId}"`)];
    const diagnostics = [];
    if (!ID_PATTERN.test(String(recordId || ''))) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, 'id', `id must match ${ID_PATTERN}`));
    }
    if (!isPlainObject(record)) {
      diagnostics.push(normalizeDiagnostic('error', schemaId, recordId, '', 'record must be an object'));
      return diagnostics;
    }

    for (const [fieldName, rule] of Object.entries(schema.fields)) {
      diagnostics.push(...validateField(schemaId, recordId, fieldName, rule, record[fieldName]));
    }

    if (options.warnUnknownFields !== false) {
      for (const fieldName of Object.keys(record)) {
        if (fieldName !== 'id' && !schema.fields[fieldName]) {
          diagnostics.push(normalizeDiagnostic('warning', schemaId, recordId, fieldName, `${fieldName} is not part of the current ${schemaId} schema`));
        }
      }
    }
    return diagnostics;
  }

  function validateCatalog(schemaId, catalog, options = {}) {
    if (!isPlainObject(catalog)) {
      return [normalizeDiagnostic('error', schemaId, '', '', `${schemaId} catalog must be an object keyed by id`)];
    }
    return Object.entries(catalog).flatMap(([recordId, record]) => validateRecord(schemaId, recordId, record, options));
  }

  function validatePackageContent(content = {}, options = {}) {
    return Object.keys(SCHEMAS).flatMap(schemaId => {
      if (content[schemaId] === undefined) return [];
      return validateCatalog(schemaId, content[schemaId], options);
    });
  }

  function listSchemas() {
    return Object.keys(SCHEMAS).sort().map(schemaId => describeSchema(schemaId));
  }

  function describeSchema(schemaId) {
    const schema = SCHEMAS[schemaId];
    return schema ? cloneSchema(schema) : null;
  }

  app.config.contentSchemas = Object.freeze({
    ID_PATTERN,
    FIELD_TYPES: Object.freeze(Object.keys(FIELD_TYPES).sort()),
    listSchemas,
    describeSchema,
    validateRecord,
    validateCatalog,
    validatePackageContent
  });
})(globalThis);
