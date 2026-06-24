(function registerComponentSchemaRegistry(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  const schemas = new Map();

  function register(name, schema) {
    if (!name) throw new Error('Component schema needs a name');
    schemas.set(String(name), Object.freeze({ name: String(name), fields: { ...(schema?.fields || {}) } }));
    return schemas.get(String(name));
  }

  function get(name) {
    return schemas.get(String(name)) || null;
  }

  function list() {
    return [...schemas.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  register('transform', { fields: { x: 'number', y: 'number', size: 'number' } });
  register('movement', { fields: { speed: 'number', hasPath: 'boolean', movementType: 'string' } });
  register('combat', { fields: { hp: 'number', maxHp: 'number', team: 'string', isDead: 'boolean' } });
  register('render', { fields: { selected: 'boolean', assetId: 'string', visible: 'boolean' } });
  register('inventory', { fields: { itemId: 'string' } });
  register('vision', { fields: { radius: 'number' } });
  register('worker', { fields: { jobType: 'string', resourceType: 'string' } });

  app.entities.componentSchemas = Object.freeze({
    register,
    get,
    list,
    describe: () => ({ schemaVersion: 1, count: schemas.size, schemas: list() })
  });
  app.diagnostics?.register?.('component-schemas', () => app.entities.componentSchemas.describe());
})(globalThis);
