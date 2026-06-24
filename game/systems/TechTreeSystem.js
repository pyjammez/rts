(function registerTechTreeSystem(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.systems = app.systems || {};

  function asSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value.filter(Boolean).map(String));
    return new Set();
  }

  function createTechTree({ faction = {}, units = {}, buildings = {}, abilities = {} } = {}) {
    const tree = faction.techTree || {};
    const production = faction.production || {};
    const rootBuildings = asSet(tree.rootBuildings);
    const unlocks = tree.unlocks && typeof tree.unlocks === 'object' ? tree.unlocks : {};

    function requirementIds(id, kind) {
      const definition = kind === 'building'
        ? buildings[id]
        : kind === 'ability'
          ? abilities[id]
          : units[id];
      const requires = definition?.requires ?? definition?.requiredBuildings ?? [];
      return Array.isArray(requires) ? requires.filter(Boolean).map(String) : [];
    }

    function isKnown(id) {
      return !!(units[id] || buildings[id] || abilities[id]);
    }

    function isExplicitlyUnlocked(id, ownedBuildings) {
      if (rootBuildings.has(id) && ownedBuildings.has(id)) return true;
      for (const buildingId of ownedBuildings) {
        const ids = Array.isArray(unlocks[buildingId]) ? unlocks[buildingId] : [];
        if (ids.map(String).includes(id)) return true;
      }
      return false;
    }

    function isUnlocked(id, state = {}) {
      return lockedReason(id, state).unlocked;
    }

    function lockedReason(id, state = {}) {
      const value = String(id || '');
      if (!value) return { unlocked: false, reason: 'missing id' };
      const ownedBuildings = asSet(state.ownedBuildings || tree.rootBuildings);
      const researched = asSet(state.researched);
      if (researched.has(value)) return { unlocked: true, reason: '' };
      if (!isKnown(value)) return { unlocked: false, reason: `unknown id "${value}"` };
      if (rootBuildings.has(value)) return { unlocked: true, reason: '' };
      if (isExplicitlyUnlocked(value, ownedBuildings)) return { unlocked: true, reason: '' };
      const kind = buildings[value] ? 'building' : abilities[value] ? 'ability' : 'unit';
      const requirements = requirementIds(value, kind);
      if (requirements.length === 0) return { unlocked: false, reason: `${value} is not unlocked by current tech` };
      const missing = requirements.filter(requirement => !ownedBuildings.has(requirement) && !researched.has(requirement));
      return missing.length === 0
        ? { unlocked: true, reason: '' }
        : { unlocked: false, reason: `missing ${missing.join(', ')}` };
    }

    function availableFromProducer(producerId, state = {}) {
      const queue = production[producerId] || {};
      return {
        train: (Array.isArray(queue.train) ? queue.train : []).filter(id => isUnlocked(id, state)),
        research: (Array.isArray(queue.research) ? queue.research : []).filter(id => isUnlocked(id, state))
      };
    }

    function describe() {
      return {
        schemaVersion: 1,
        factionId: faction.id || null,
        rootBuildings: [...rootBuildings],
        producers: Object.keys(production),
        unlocks: JSON.parse(JSON.stringify(unlocks))
      };
    }

    return Object.freeze({
      isUnlocked,
      lockedReason,
      availableFromProducer,
      allAvailable: state => ({
        units: Object.keys(units).filter(id => isUnlocked(id, state)),
        buildings: Object.keys(buildings).filter(id => isUnlocked(id, state)),
        research: Object.keys(abilities).filter(id => isUnlocked(id, state))
      }),
      describe
    });
  }

  app.systems.techTree = Object.freeze({ createTechTree });
})(globalThis);
