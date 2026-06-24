(function registerDynamicWorldComposer(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function addOne(group, item, counts, key) {
    if (!group || !item) return;
    group.add(item);
    if (counts && key) counts[key] = (counts[key] || 0) + 1;
  }

  function compose({
    group,
    sources = {},
    roasts = [],
    impactEffects = [],
    selectedObject = null,
    factories = {}
  } = {}) {
    if (!group) return null;
    if (typeof group.clear === 'function') group.clear();
    const counts = {};

    for (const unit of sources.units || []) {
      if (!unit.hiddenInHouse) addOne(group, factories.createUnit?.(unit), counts, 'units');
    }
    for (const sheep of sources.sheep || []) {
      if (!sheep.isMounted) addOne(group, factories.createSheep?.(sheep), counts, 'sheep');
    }
    for (const roast of roasts || []) addOne(group, factories.createRoast?.(roast), counts, 'roasts');
    for (const duck of sources.ducks || []) addOne(group, factories.createDuck?.(duck), counts, 'ducks');
    for (const horse of sources.horses || []) {
      if (!horse.isDead) addOne(group, factories.createHorse?.(horse), counts, 'horses');
    }
    for (const item of sources.items || []) {
      if (!item.isDead && !item.isPickedUp) addOne(group, factories.createWorldItem?.(item), counts, 'items');
    }

    addOne(group, factories.createSelectedObjectMarker?.(selectedObject), counts, 'selectionMarkers');

    for (const projectile of sources.projectiles || []) {
      if (!projectile.dead) addOne(group, factories.createProjectile?.(projectile), counts, 'projectiles');
    }
    for (const effect of impactEffects || []) addOne(group, factories.createImpactEffect?.(effect), counts, 'impactEffects');

    return counts;
  }

  app.rendering.dynamicWorldComposer = Object.freeze({
    compose
  });
})(globalThis);
