(function registerEntityQueries(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  const PICK_PRIORITY = Object.freeze([
    'unit',
    'wildlife',
    'resource',
    'house',
    'item',
    'obstacle',
    'building',
    'projectile'
  ]);

  function registry() {
    return app.entities.registry || root.entityManager || null;
  }

  function source(entity) {
    return entity?.source || null;
  }

  function radiusFor(entity) {
    const size = Number(entity?.size || entity?.source?.size || 0);
    if (entity?.category === 'unit') return Math.max(12, size * 0.55);
    if (entity?.category === 'building') return Math.max(20, size * 0.5);
    if (entity?.category === 'obstacle') return Math.max(18, size * 0.65);
    return Math.max(10, size * 0.6);
  }

  function categoryPriority(entity) {
    const index = PICK_PRIORITY.indexOf(entity?.category);
    return index === -1 ? PICK_PRIORITY.length : index;
  }

  function isVisibleTo(entity, team) {
    if (!team || entity?.team === team || entity?.team === 'neutral') return true;
    return app.systems?.vision?.isVisibleTo ? app.systems.vision.isVisibleTo(team, entity) : true;
  }

  function query(filter = {}) {
    const entityRegistry = registry();
    if (!entityRegistry?.query) return [];
    const visibilityTeam = filter.visibleTo;
    const results = entityRegistry.query(filter);
    return visibilityTeam ? results.filter(entity => isVisibleTo(entity, visibilityTeam)) : results;
  }

  function sources(filter = {}) {
    return query(filter).map(source).filter(Boolean);
  }

  function aliveUnits(filter = {}) {
    return sources({ ...filter, category: 'unit', lifecycle: 'alive' });
  }

  function selectedUnits(team = null) {
    return aliveUnits({
      predicate: entity => !!entity.source?.selected && (!team || entity.team === team)
    });
  }

  function entitiesInBox(bounds, filter = {}) {
    const minX = Math.min(bounds.minX, bounds.maxX);
    const maxX = Math.max(bounds.minX, bounds.maxX);
    const minY = Math.min(bounds.minY, bounds.maxY);
    const maxY = Math.max(bounds.minY, bounds.maxY);
    return query({
      ...filter,
      predicate: entity => {
        if (typeof filter.predicate === 'function' && !filter.predicate(entity)) return false;
        return entity.x >= minX && entity.x <= maxX && entity.y >= minY && entity.y <= maxY;
      }
    });
  }

  function pickAtPoint(worldX, worldY, options = {}) {
    const categories = options.category || options.categories || PICK_PRIORITY;
    const candidates = query({
      category: categories,
      selectable: options.selectableOnly === false ? undefined : true,
      visibleTo: options.visibleTo,
      predicate: entity => {
        if (entity.lifecycle === 'carried' || entity.lifecycle === 'garrisoned') return false;
        if (options.includeDead !== true && (entity.lifecycle === 'dead' || entity.lifecycle === 'wreck')) return false;
        if (typeof options.predicate === 'function' && !options.predicate(entity)) return false;
        const distance = Math.hypot(entity.x - worldX, entity.y - worldY);
        return distance <= radiusFor(entity);
      }
    });
    candidates.sort((left, right) => {
      const priority = categoryPriority(left) - categoryPriority(right);
      if (priority !== 0) return priority;
      return Math.hypot(left.x - worldX, left.y - worldY) - Math.hypot(right.x - worldX, right.y - worldY);
    });
    return candidates[0] || null;
  }

  function pickAllAtPoint(worldX, worldY, options = {}) {
    const picked = {};
    for (const category of PICK_PRIORITY) {
      const entity = pickAtPoint(worldX, worldY, { ...options, category });
      if (!entity) continue;
      picked[category] = entity;
      if (category === 'wildlife') {
        const objectType = entity.source?.displayName === 'Duck' ? 'duck'
          : entity.source?.displayName === 'Horse' ? 'horse'
          : 'sheep';
        picked[objectType] = entity;
      }
      if (category === 'resource') picked.goldMine = entity;
    }
    picked.primary = pickAtPoint(worldX, worldY, options);
    return picked;
  }

  function nearest(origin, filter = {}) {
    let best = null;
    let bestDistance = Infinity;
    for (const entity of query(filter)) {
      const distance = Math.hypot(entity.x - origin.x, entity.y - origin.y);
      if (distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }
    return best;
  }

  app.entities.query = Object.freeze({
    query,
    sources,
    aliveUnits,
    selectedUnits,
    entitiesInBox,
    pickAtPoint,
    pickAllAtPoint,
    nearest,
    source,
    isVisibleTo
  });
  app.entities.picker = Object.freeze({
    pickAtPoint,
    pickAllAtPoint,
    entitiesInBox
  });
})(globalThis);
