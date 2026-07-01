(function registerDynamicWorldComposer(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function addOne(group, item, counts, key) {
    if (!group || !item) return;
    group.add(item);
    if (counts && key) counts[key] = (counts[key] || 0) + 1;
  }

  function defaultIdFor(kind, source, index = 0) {
    return source?.id !== undefined && source?.id !== null
      ? `${kind}:${source.id}`
      : `${kind}:anonymous:${index}`;
  }

  function visualKeyFor(kind, source) {
    if (!source) return `${kind}:empty`;
    const attackAnimation = Number(source.attackAnimationTime) > 0 && Number(source.attackAnimationDuration) > 0
      ? Math.ceil((Number(source.attackAnimationTime) / Number(source.attackAnimationDuration)) * 6)
      : '';
    return [
      kind,
      source.unitType || source.type || source.objectType || source.displayName || '',
      source.model || '',
      source.team || '',
      source.selected ? 'selected' : '',
      source.isDead ? 'dead' : '',
      source.isMounted ? 'mounted' : '',
      source.isPickedUp ? 'picked' : '',
      source.hiddenInHouse ? 'hidden' : '',
      source.mountType || '',
      attackAnimation ? `attack:${attackAnimation}` : ''
    ].join('|');
  }

  function syncDefaultTransform(item, source, deps = {}) {
    if (!item || !source) return;
    const position = typeof deps.worldToScene === 'function'
      ? deps.worldToScene(source.x, source.y, source)
      : null;
    if (position && item.position?.set) {
      item.position.set(
        Number(position.x) || 0,
        Number.isFinite(Number(position.y)) ? Number(position.y) : item.position.y || 0,
        Number(position.z) || 0
      );
    }
    if (Number.isFinite(source.heading) && item.rotation) item.rotation.y = -source.heading;
  }

  function removePooledItem(group, entry) {
    if (!entry?.item || !group) return;
    if (typeof group.remove === 'function') group.remove(entry.item);
    else if (Array.isArray(group.children)) {
      const index = group.children.indexOf(entry.item);
      if (index >= 0) group.children.splice(index, 1);
    }
  }

  function createDynamicPool() {
    const entries = new Map();
    return {
      entries,
      reset(group) {
        entries.clear();
        if (typeof group?.clear === 'function') group.clear();
      },
      describe() {
        return {
          schemaVersion: 1,
          size: entries.size,
          keys: [...entries.keys()].sort()
        };
      }
    };
  }

  function addPooled(group, pool, source, counts, key, create, options = {}) {
    if (!group || !source || typeof create !== 'function') return;
    const id = options.id || defaultIdFor(key, source, options.index);
    const visualKey = options.visualKey || visualKeyFor(key, source);
    let entry = pool?.entries?.get(id);
    if (!entry || entry.visualKey !== visualKey) {
      if (entry) removePooledItem(group, entry);
      const item = create(source);
      if (!item) return;
      entry = { id, item, visualKey, seen: false };
      pool.entries.set(id, entry);
      group.add(item);
      if (counts) counts.created = (counts.created || 0) + 1;
    } else if (counts) {
      counts.reused = (counts.reused || 0) + 1;
    }
    entry.seen = true;
    if (typeof options.sync === 'function') options.sync(entry.item, source, key);
    else syncDefaultTransform(entry.item, source, options);
    if (counts && key) counts[key] = (counts[key] || 0) + 1;
  }

  function prunePool(group, pool, counts) {
    if (!pool?.entries) return;
    for (const [id, entry] of pool.entries) {
      if (entry.seen) {
        entry.seen = false;
        continue;
      }
      removePooledItem(group, entry);
      pool.entries.delete(id);
      if (counts) counts.removed = (counts.removed || 0) + 1;
    }
  }

  function shouldRender(source, key, isVisible, counts) {
    if (typeof isVisible !== 'function') return true;
    const visible = isVisible(source, key);
    if (!visible && counts) {
      counts.culled = (counts.culled || 0) + 1;
      counts[`${key}Culled`] = (counts[`${key}Culled`] || 0) + 1;
    }
    return visible;
  }

  function addVisiblePooled(group, pool, source, counts, key, create, options = {}) {
    if (!shouldRender(source, key, options.isVisible, counts)) return;
    addPooled(group, pool, source, counts, key, create, options);
  }

  function addVisibleOne(group, source, counts, key, create, options = {}) {
    if (!shouldRender(source, key, options.isVisible, counts)) return;
    addOne(group, create?.(source), counts, key);
  }

  function compose({
    group,
    sources = {},
    roasts = [],
    impactEffects = [],
    selectedObject = null,
    factories = {},
    pool = null,
    worldToScene = null,
    syncTransform = null,
    isVisible = null
  } = {}) {
    if (!group) return null;
    const counts = {};
    const transformOptions = { worldToScene, sync: syncTransform, isVisible };
    if (!pool?.entries) {
      if (typeof group.clear === 'function') group.clear();
    }

    if (pool?.entries) {
      (sources.units || []).forEach((unit, index) => {
        if (!unit.hiddenInHouse) addVisiblePooled(group, pool, unit, counts, 'units', factories.createUnit, { ...transformOptions, index });
      });
      (sources.sheep || []).forEach((sheep, index) => {
        if (!sheep.isMounted) addVisiblePooled(group, pool, sheep, counts, 'sheep', factories.createSheep, { ...transformOptions, index });
      });
      (roasts || []).forEach((roast, index) => addVisiblePooled(group, pool, roast, counts, 'roasts', factories.createRoast, { ...transformOptions, index }));
      (sources.ducks || []).forEach((duck, index) => addVisiblePooled(group, pool, duck, counts, 'ducks', factories.createDuck, { ...transformOptions, index }));
      (sources.horses || []).forEach((horse, index) => {
        if (!horse.isDead) addVisiblePooled(group, pool, horse, counts, 'horses', factories.createHorse, { ...transformOptions, index });
      });
      (sources.items || []).forEach((item, index) => {
        if (!item.isDead && !item.isPickedUp) addVisiblePooled(group, pool, item, counts, 'items', factories.createWorldItem, { ...transformOptions, index });
      });
      for (const projectile of sources.projectiles || []) {
        if (!projectile.dead) addVisiblePooled(group, pool, projectile, counts, 'projectiles', factories.createProjectile, { ...transformOptions });
      }
      (impactEffects || []).forEach((effect, index) => addVisiblePooled(group, pool, effect, counts, 'impactEffects', factories.createImpactEffect, { ...transformOptions, index }));
      if (selectedObject && shouldRender(selectedObject, 'selectionMarkers', isVisible, counts)) {
        addPooled(group, pool, selectedObject, counts, 'selectionMarkers', factories.createSelectedObjectMarker, {
          ...transformOptions,
          id: 'selection:current',
          visualKey: `selection:${selectedObject.objectType || ''}:${selectedObject.id || ''}:${selectedObject.x || 0}:${selectedObject.y || 0}:${selectedObject.obstacleType || ''}`
        });
      }
    } else {
      for (const unit of sources.units || []) {
        if (!unit.hiddenInHouse) addVisibleOne(group, unit, counts, 'units', factories.createUnit, transformOptions);
      }
      for (const sheep of sources.sheep || []) {
        if (!sheep.isMounted) addVisibleOne(group, sheep, counts, 'sheep', factories.createSheep, transformOptions);
      }
      for (const roast of roasts || []) addVisibleOne(group, roast, counts, 'roasts', factories.createRoast, transformOptions);
      for (const duck of sources.ducks || []) addVisibleOne(group, duck, counts, 'ducks', factories.createDuck, transformOptions);
      for (const horse of sources.horses || []) {
        if (!horse.isDead) addVisibleOne(group, horse, counts, 'horses', factories.createHorse, transformOptions);
      }
      for (const item of sources.items || []) {
        if (!item.isDead && !item.isPickedUp) addVisibleOne(group, item, counts, 'items', factories.createWorldItem, transformOptions);
      }
      for (const projectile of sources.projectiles || []) {
        if (!projectile.dead) addVisibleOne(group, projectile, counts, 'projectiles', factories.createProjectile, transformOptions);
      }
      for (const effect of impactEffects || []) addVisibleOne(group, effect, counts, 'impactEffects', factories.createImpactEffect, transformOptions);
      if (selectedObject) addVisibleOne(group, selectedObject, counts, 'selectionMarkers', factories.createSelectedObjectMarker, transformOptions);
    }
    prunePool(group, pool, counts);

    return counts;
  }

  app.rendering.dynamicWorldComposer = Object.freeze({
    createDynamicPool,
    visualKeyFor,
    compose
  });
})(globalThis);
