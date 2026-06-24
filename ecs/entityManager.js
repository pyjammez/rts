(function registerAuthoritativeEntityRegistry(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  const CATEGORY_COLLECTIONS = Object.freeze({
    buildings: 'building',
    sheep: 'wildlife',
    ducks: 'wildlife',
    horses: 'wildlife',
    items: 'item',
    goldMines: 'resource',
    houses: 'house',
    obstacleEntities: 'obstacle',
    projectiles: 'projectile'
  });

  function entityKey(category, id) {
    return `${category}:${String(id)}`;
  }

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function inferLifecycle(source) {
    if (!source) return 'missing';
    if (source.isPickedUp) return 'carried';
    if (source.hiddenInHouse || source.hiddenInCastle) return 'garrisoned';
    if (source.isWreck) return 'wreck';
    if (source.isDead || source.dead) return 'dead';
    if (source.burning) return 'burning';
    return 'alive';
  }

  function inferSelectable(source) {
    if (!source) return false;
    if (source.isPickedUp) return false;
    if (source.dead || source.isDead) return true;
    return source.selectable !== false;
  }

  function normalizeEntity({ category, id, source, kind = category, collection = null, index = 0 }) {
    const stableId = id ?? source?.id ?? `${collection || category}-${index}`;
    const key = entityKey(category, stableId);
    const maxHp = finite(source?.maxHp, finite(source?.hp, 0));
    const hp = finite(source?.hp, maxHp);
    return {
      key,
      id: stableId,
      category,
      kind,
      collection,
      source,
      team: source?.team || 'neutral',
      x: finite(source?.x),
      y: finite(source?.y),
      size: finite(source?.size, 0),
      hp,
      maxHp,
      selectable: inferSelectable(source),
      selected: !!source?.selected,
      lifecycle: inferLifecycle(source),
      tags: new Set(),
      components: Object.create(null)
    };
  }

  class EntityManager {
    constructor() {
      this.entities = new Map();
      this.byCategory = new Map();
      this.revision = 0;
      this.lastSyncFrame = -1;
    }

    clear() {
      this.entities.clear();
      this.byCategory.clear();
      this.revision++;
    }

    upsert(entity) {
      if (!entity || entity.id === undefined || !entity.category) return null;
      const key = entity.key || entityKey(entity.category, entity.id);
      const existing = this.entities.get(key);
      const next = existing ? Object.assign(existing, entity, { key }) : { ...entity, key };
      if (!(next.tags instanceof Set)) next.tags = new Set(next.tags || []);
      if (!next.components) next.components = Object.create(null);
      this.entities.set(key, next);
      if (!this.byCategory.has(next.category)) this.byCategory.set(next.category, new Set());
      this.byCategory.get(next.category).add(key);
      this.revision++;
      return next;
    }

    upsertSource(category, source, options = {}) {
      if (!source) return null;
      const entity = normalizeEntity({
        category,
        id: options.id ?? source.id,
        source,
        kind: options.kind || source.objectType || source.type || category,
        collection: options.collection || null,
        index: options.index || 0
      });
      this.attachStandardComponents(entity);
      return this.upsert(entity);
    }

    upsertUnit(unit) {
      if (!unit || typeof unit.id === 'undefined') return null;
      return this.upsertSource('unit', unit, {
        id: unit.id,
        kind: unit.unitType || 'unit',
        collection: 'units'
      });
    }

    remove(category, id) {
      const key = entityKey(category, id);
      const entity = this.entities.get(key);
      if (!entity) return false;
      this.entities.delete(key);
      this.byCategory.get(category)?.delete(key);
      this.revision++;
      return true;
    }

    removeUnitById(id) {
      return this.remove('unit', id);
    }

    get(category, id) {
      return this.entities.get(entityKey(category, id)) || null;
    }

    getByKey(key) {
      return this.entities.get(key) || null;
    }

    findBySource(source) {
      if (!source) return null;
      for (const entity of this.entities.values()) {
        if (entity.source === source) return entity;
      }
      return null;
    }

    query(filter = {}) {
      const categories = filter.category
        ? new Set(Array.isArray(filter.category) ? filter.category : [filter.category])
        : null;
      const team = filter.team === undefined ? null : String(filter.team);
      const lifecycle = filter.lifecycle
        ? new Set(Array.isArray(filter.lifecycle) ? filter.lifecycle : [filter.lifecycle])
        : null;
      const selectable = filter.selectable;
      const result = [];

      for (const entity of this.entities.values()) {
        if (categories && !categories.has(entity.category)) continue;
        if (team !== null && String(entity.team) !== team) continue;
        if (lifecycle && !lifecycle.has(entity.lifecycle)) continue;
        if (selectable !== undefined && !!entity.selectable !== !!selectable) continue;
        if (typeof filter.predicate === 'function' && !filter.predicate(entity)) continue;
        result.push(entity);
      }

      return result.sort((a, b) => String(a.key).localeCompare(String(b.key), 'en', { numeric: true }));
    }

    getUnits() {
      return this.query({ category: 'unit' }).map(entity => entity.source);
    }

    getAliveUnits() {
      return this.query({ category: 'unit', lifecycle: 'alive' }).map(entity => entity.source);
    }

    syncUnits(units = []) {
      return this.syncAll({ units });
    }

    syncAll({ units = [], collections = {}, projectiles = [], frame = -1 } = {}) {
      const seen = new Set();
      for (const unit of Array.isArray(units) ? units : []) {
        const entity = this.upsertUnit(unit);
        if (entity) seen.add(entity.key);
      }

      const sourceCollections = { ...collections };
      if (Array.isArray(projectiles)) sourceCollections.projectiles = projectiles;
      for (const [collectionName, collection] of Object.entries(sourceCollections)) {
        const category = CATEGORY_COLLECTIONS[collectionName];
        if (!category || !Array.isArray(collection)) continue;
        collection.forEach((source, index) => {
          const id = source?.id ?? `${collectionName}-${index}`;
          const entity = this.upsertSource(category, source, {
            id,
            collection: collectionName,
            index,
            kind: source?.objectType || source?.type || category
          });
          if (entity) seen.add(entity.key);
        });
      }

      for (const key of [...this.entities.keys()]) {
        if (!seen.has(key)) {
          const entity = this.entities.get(key);
          this.byCategory.get(entity.category)?.delete(key);
          this.entities.delete(key);
          this.revision++;
        }
      }

      this.lastSyncFrame = frame;
      return this.describe();
    }

    attachStandardComponents(entity) {
      const source = entity.source || {};
      entity.components.transform = {
        x: entity.x,
        y: entity.y,
        size: entity.size,
        heading: finite(source.heading)
      };
      if (entity.hp || entity.maxHp || source.takeDamage) {
        entity.components.health = {
          hp: entity.hp,
          maxHp: entity.maxHp,
          dead: entity.lifecycle === 'dead' || entity.lifecycle === 'wreck'
        };
      }
      if (entity.category === 'unit') {
        entity.components.movement = {
          speed: finite(source.speed),
          movementType: source.movementType || 'ground',
          hasPath: !!(source.path && source.path.length > 0),
          destination: source.destination ? { x: finite(source.destination.x), y: finite(source.destination.y) } : null,
          pathIndex: finite(source.pathIndex)
        };
        entity.components.combat = {
          hp: entity.hp,
          maxHp: entity.maxHp,
          team: entity.team,
          isDead: entity.lifecycle === 'dead',
          damage: finite(source.damage),
          range: finite(source.shootRange ?? source.range),
          cooldown: finite(source.fireCooldown),
          fireCooldown: finite(source.fireCooldown),
          targetId: source.attackOrderTarget?.id ?? source.currentEnemy?.id ?? null
        };
        entity.components.inventory = {
          itemId: source.inventoryItem?.id || null,
          carrying: !!source.inventoryItem,
          pendingPickupId: source.pendingPickupItem?.id || null,
          pendingDropPoint: source.pendingDropPoint
            ? { x: finite(source.pendingDropPoint.x), y: finite(source.pendingDropPoint.y) }
            : null
        };
        entity.components.mount = {
          type: source.mountType || null,
          targetId: source.mountTarget?.id || null,
          mountedAnimalId: source.mountedAnimalId || null
        };
        entity.components.garrison = {
          hiddenInHouse: !!source.hiddenInHouse,
          hiddenInCastle: !!source.hiddenInCastle,
          houseId: source.houseId || null,
          castleId: source.castleId || null,
          rampartBuildingId: source.rampartBuildingId || null
        };
        entity.components.commands = {
          queueLength: Array.isArray(source.commandQueue) ? source.commandQueue.length : 0,
          activeType: source.activeCommand?.type || null,
          attackMove: !!source.attackMove,
          fireStance: source.fireStance || 'attack_at_will'
        };
      }
      if (entity.category === 'unit' || entity.category === 'building') {
        const baseVision = entity.category === 'building'
          ? (source.type === 'home' ? 520 : 380)
          : source.unitType === 'scout'
            ? 360
            : source.movementType === 'air'
              ? 420
              : 280;
        entity.components.vision = {
          radius: finite(source.visionRadius, baseVision),
          revealRadius: finite(source.revealRadius, baseVision * 0.5),
          team: entity.team
        };
      }
      if (entity.selectable) {
        entity.components.selectable = {
          selected: entity.selected,
          displayName: source.displayName || source.name || source.type || source.objectType || entity.kind,
          description: source.description || ''
        };
      }
      entity.components.render = {
        visible: entity.lifecycle !== 'carried' && entity.lifecycle !== 'garrisoned',
        selected: entity.selected,
        model: source.model || source.unitType || source.objectType || source.type || entity.kind,
        assetId: source.assetId || `${entity.category}.${source.model || source.unitType || source.objectType || source.type || entity.kind}`
      };
    }

    componentMap(componentName, filter = {}) {
      const map = new Map();
      for (const entity of this.query(filter)) {
        if (entity.components?.[componentName]) {
          map.set(entity.id, { ...entity.components[componentName] });
        }
      }
      return map;
    }

    snapshot() {
      return this.query().map(entity => ({
        key: entity.key,
        id: entity.id,
        category: entity.category,
        kind: entity.kind,
        team: entity.team,
        x: Math.round(entity.x * 1000) / 1000,
        y: Math.round(entity.y * 1000) / 1000,
        hp: Math.round(entity.hp * 1000) / 1000,
        maxHp: Math.round(entity.maxHp * 1000) / 1000,
        lifecycle: entity.lifecycle,
        selectable: entity.selectable
      }));
    }

    describe() {
      const counts = {};
      for (const entity of this.entities.values()) {
        counts[entity.category] = (counts[entity.category] || 0) + 1;
      }
      return {
        schemaVersion: 1,
        entityCount: this.entities.size,
        counts,
        revision: this.revision,
        lastSyncFrame: this.lastSyncFrame
      };
    }
  }

  const manager = root.entityManager instanceof EntityManager
    ? root.entityManager
    : new EntityManager();

  app.entities.EntityManager = EntityManager;
  app.entities.registry = manager;
  root.entityManager = manager;

  app.diagnostics?.register?.('entities', () => manager.describe());
})(globalThis);
