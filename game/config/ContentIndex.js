(function () {
  const root = window.OpenRTS = window.OpenRTS || {};
  root.config = root.config || {};

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function cloneMap(map) {
    const cloned = {};
    for (const [id, value] of Object.entries(map || {})) {
      cloned[id] = value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : value;
    }
    return cloned;
  }

  function resolveAbility(abilities, abilityId) {
    const ability = abilities[abilityId];
    if (ability) return { ...ability, id: ability.id || abilityId };
    return {
      id: String(abilityId),
      name: titleCase(abilityId),
      type: 'custom',
      summary: 'Custom ability defined by a mod or match override.',
      tags: []
    };
  }

  function resolveUnit(unitId, definition, weapons, abilities) {
    const unit = { ...definition, id: definition.id || unitId };
    const weapon = unit.weapon ? weapons[unit.weapon] || {} : {};
    const abilityIds = Array.isArray(unit.abilities) ? unit.abilities.filter(Boolean).map(String) : [];

    return {
      ...unit,
      abilities: abilityIds,
      abilityDefinitions: abilityIds.map(abilityId => resolveAbility(abilities, abilityId)),
      weaponDefinition: weapon,
      damage: unit.damage ?? weapon.damage ?? 8,
      movingDamage: unit.movingDamage ?? weapon.movingDamage ?? 4,
      range: unit.range ?? weapon.range,
      shootRange: unit.shootRange ?? weapon.range ?? 120,
      stopShootRange: unit.stopShootRange ?? weapon.stopRange ?? 150,
      fireRate: unit.fireRate ?? weapon.fireRate ?? 1.2,
      attackCooldown: unit.attackCooldown ?? weapon.attackCooldown,
      projectileSpeed: unit.projectileSpeed ?? weapon.projectileSpeed ?? 200,
      projectileColor: unit.projectileColor ?? weapon.projectileColor,
      projectileType: unit.projectileType ?? weapon.projectileType ?? 'arrow',
      splashRadius: unit.splashRadius ?? weapon.splashRadius ?? 0,
      melee: unit.melee ?? weapon.melee ?? false,
      weaponName: weapon.name || unit.weapon || 'Weapon',
      weaponId: unit.weapon || null
    };
  }

  function createContentIndex(definitions = {}) {
    const abilities = cloneMap(definitions.abilities);
    const weapons = cloneMap(definitions.weapons);
    const rulesets = cloneMap(definitions.rulesets);
    const factions = cloneMap(definitions.factions);
    const units = cloneMap(definitions.units);
    const buildings = cloneMap(definitions.buildings);
    const modes = cloneMap(definitions.modes);
    const terrainPresets = cloneMap(definitions.terrainPresets);

    const resolvedUnits = Object.entries(units)
      .map(([unitId, definition]) => resolveUnit(unitId, definition, weapons, abilities))
      .sort((a, b) => {
        const eraSort = String(a.era || '').localeCompare(String(b.era || ''));
        if (eraSort !== 0) return eraSort;
        return String(a.name || a.id).localeCompare(String(b.name || b.id));
      });
    const unitsById = new Map(resolvedUnits.map(unit => [unit.id, unit]));

    function getUnit(unitId, fallbackId = 'soldier') {
      return unitsById.get(unitId) || unitsById.get(fallbackId) || resolvedUnits[0] || null;
    }

    function listUnits(options = {}) {
      const allowedIds = Array.isArray(options.allowedIds) ? new Set(options.allowedIds) : null;
      const enabledIds = Array.isArray(options.enabledIds) ? new Set(options.enabledIds) : null;
      return resolvedUnits.filter(unit => {
        if (allowedIds && !allowedIds.has(unit.id)) return false;
        if (enabledIds && !enabledIds.has(unit.id)) return false;
        return true;
      });
    }

    function searchUnits(filters = {}) {
      const query = normalizeText(filters.query);
      const era = filters.era && filters.era !== 'all' ? String(filters.era) : '';
      const pack = filters.pack && filters.pack !== 'all' ? String(filters.pack) : '';
      const role = filters.role && filters.role !== 'all' ? String(filters.role) : '';
      const allowedIds = Array.isArray(filters.allowedIds) ? new Set(filters.allowedIds) : null;
      const enabledIds = Array.isArray(filters.enabledIds) ? new Set(filters.enabledIds) : null;

      return resolvedUnits.filter(unit => {
        if (allowedIds && !allowedIds.has(unit.id)) return false;
        if (enabledIds && !enabledIds.has(unit.id)) return false;
        if (era && unit.era !== era) return false;
        if (pack && unit.pack !== pack) return false;
        if (role && unit.role !== role) return false;
        if (!query) return true;

        const haystack = [
          unit.id,
          unit.name,
          unit.role,
          unit.era,
          unit.pack,
          unit.packName,
          unit.weaponId,
          unit.weaponName,
          ...(unit.tags || []),
          ...(unit.abilities || []),
          ...((unit.abilityDefinitions || []).map(ability => ability.name))
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }

    function getFacets() {
      const eras = [...new Set(resolvedUnits.map(unit => unit.era || 'core'))].sort();
      const packs = [...new Map(resolvedUnits.map(unit => [
        unit.pack || 'core',
        unit.packName || unit.pack || 'Core Units'
      ])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const roles = [...new Set(resolvedUnits.map(unit => unit.role).filter(Boolean))].sort();
      const weaponsFacet = [...new Map(resolvedUnits
        .filter(unit => unit.weaponId)
        .map(unit => [unit.weaponId, unit.weaponName || unit.weaponId])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { eras, packs, roles, weapons: weaponsFacet };
    }

    function getDamageMultiplier({ rulesetId = 'open_rts_core', damageType = 'normal', armorTags = [] } = {}) {
      const ruleset = rulesets[rulesetId] || rulesets.open_rts_core || {};
      const damage = ruleset.damageTypes?.[damageType] || {};
      const tags = Array.isArray(armorTags)
        ? armorTags
        : String(armorTags || '').split(/\s+/).filter(Boolean);
      return tags.reduce((multiplier, tag) => {
        const value = Number(damage.modifiers?.[tag]);
        return Number.isFinite(value) ? multiplier * value : multiplier;
      }, 1);
    }

    function describe() {
      return {
        schemaVersion: 1,
        counts: {
          abilities: Object.keys(abilities).length,
          weapons: Object.keys(weapons).length,
          rulesets: Object.keys(rulesets).length,
          factions: Object.keys(factions).length,
          units: resolvedUnits.length,
          buildings: Object.keys(buildings).length,
          terrainPresets: Object.keys(terrainPresets).length,
          modes: Object.keys(modes).length
        },
        facets: getFacets()
      };
    }

    return Object.freeze({
      getUnit,
      listUnits,
      searchUnits,
      getFacets,
      describe,
      getAbility: abilityId => abilities[abilityId] || null,
      getWeapon: weaponId => weapons[weaponId] || null,
      getRuleset: rulesetId => rulesets[rulesetId] || null,
      getFaction: factionId => factions[factionId] || null,
      listRulesets: () => Object.entries(rulesets).map(([id, ruleset]) => ({ ...ruleset, id: ruleset.id || id })),
      listFactions: () => Object.entries(factions).map(([id, faction]) => ({ ...faction, id: faction.id || id })),
      getDamageMultiplier,
      getBuilding: buildingId => buildings[buildingId] || null,
      getTerrainPreset: presetId => terrainPresets[presetId] || null,
      getMode: modeId => modes[modeId] || null
    });
  }

  root.config.createContentIndex = createContentIndex;
})();
