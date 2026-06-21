const PLATFORM_CONFIG_PATHS = {
  weapons: 'assets/data/weapons.json',
  units: 'assets/data/units.json',
  buildings: 'assets/data/buildings.json',
  modes: 'assets/data/game-modes.json',
  terrainPresets: 'assets/data/terrain-presets.json'
};

const DEFAULT_WEAPON_DEFINITIONS = {
  sword: {
    id: 'sword',
    name: 'Sword',
    damage: 9,
    movingDamage: 6,
    range: 46,
    stopRange: 62,
    fireRate: 1.35,
    melee: true
  },
  shortbow: {
    id: 'shortbow',
    name: 'Shortbow',
    damage: 8,
    movingDamage: 4,
    range: 120,
    stopRange: 150,
    fireRate: 1.2,
    projectileSpeed: 200,
    projectileColor: '#f0c35a'
  },
  longbow: {
    id: 'longbow',
    name: 'Longbow',
    damage: 7,
    movingDamage: 3,
    range: 185,
    stopRange: 220,
    fireRate: 1.45,
    projectileSpeed: 235,
    projectileColor: '#f3d47b'
  },
  lance: {
    id: 'lance',
    name: 'Lance',
    damage: 12,
    movingDamage: 7,
    range: 72,
    stopRange: 95,
    fireRate: 0.9,
    projectileSpeed: 190,
    projectileColor: '#d8d3bd'
  },
  sling: {
    id: 'sling',
    name: 'Sling',
    damage: 5,
    movingDamage: 3,
    range: 95,
    stopRange: 125,
    fireRate: 1.8,
    projectileSpeed: 260,
    projectileColor: '#d6c39a'
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    damage: 14,
    movingDamage: 8,
    range: 145,
    stopRange: 175,
    fireRate: 1.65,
    projectileSpeed: 430,
    projectileColor: '#ffd27a',
    projectileType: 'bullet'
  },
  crossbow: {
    id: 'crossbow',
    name: 'Crossbow',
    damage: 18,
    movingDamage: 9,
    range: 165,
    stopRange: 195,
    fireRate: 0.72,
    projectileSpeed: 300,
    projectileColor: '#d8c09a',
    projectileType: 'bolt'
  },
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    damage: 22,
    movingDamage: 14,
    range: 125,
    stopRange: 155,
    fireRate: 0.55,
    projectileSpeed: 145,
    projectileColor: '#454b37',
    projectileType: 'grenade',
    splashRadius: 72
  },
  tower_arrow: {
    id: 'tower_arrow',
    name: 'Tower Arrow',
    damage: 12,
    range: 245,
    attackCooldown: 1.15,
    projectileSpeed: 260,
    projectileColor: '#f3d06e'
  }
};

const DEFAULT_UNIT_DEFINITIONS = {
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    hp: 100,
    speed: 100,
    size: 20,
    weapon: 'sword',
    role: 'Sword infantry',
    model: 'soldier'
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    hp: 72,
    speed: 96,
    size: 18,
    weapon: 'longbow',
    role: 'Long range, fragile',
    model: 'archer'
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    hp: 155,
    speed: 82,
    size: 24,
    weapon: 'sword',
    role: 'Durable sword fighter',
    model: 'knight'
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    hp: 64,
    speed: 150,
    size: 17,
    weapon: 'sling',
    role: 'Fast skirmisher',
    model: 'scout'
  },
  gunman: {
    id: 'gunman',
    name: 'Gunman',
    hp: 82,
    speed: 98,
    size: 19,
    weapon: 'pistol',
    role: 'Fast-firing pistol infantry',
    model: 'gunman'
  },
  crossbowman: {
    id: 'crossbowman',
    name: 'Crossbowman',
    hp: 92,
    speed: 88,
    size: 20,
    weapon: 'crossbow',
    role: 'Heavy ranged infantry',
    model: 'crossbowman'
  },
  grenademan: {
    id: 'grenademan',
    name: 'Grenademan',
    hp: 105,
    speed: 84,
    size: 21,
    weapon: 'grenade',
    role: 'Splash-damage specialist',
    model: 'grenademan'
  }
};

const DEFAULT_BUILDING_DEFINITIONS = {
  home: {
    id: 'home',
    name: 'Castle',
    width: 7,
    height: 7,
    hp: 1250,
    size: 260,
    range: 360,
    damage: 11,
    attackCooldown: 1.05,
    projectileSpeed: 300,
    projectileColor: '#f0cf68',
    model: 'castle'
  },
  tower: {
    id: 'tower',
    name: 'Arrow Tower',
    width: 2,
    height: 2,
    hp: 260,
    size: 70,
    weapon: 'tower_arrow',
    model: 'arrow_tower'
  }
};

const DEFAULT_TERRAIN_PRESETS = {
  coastal_grassland: {
    id: 'coastal_grassland',
    name: 'Coastal Grassland',
    waterLevel: 10,
    rockCount: 15,
    treeCount: 30,
    sheepCount: 12,
    duckCount: 5
  },
  defense_pass: {
    id: 'defense_pass',
    name: 'Defense Pass',
    waterLevel: 4,
    rockCount: 24,
    treeCount: 65,
    sheepCount: 4
  },
  arena: {
    id: 'arena',
    name: 'Open Arena',
    waterLevel: 0,
    rockCount: 0,
    treeCount: 8,
    sheepCount: 0
  }
};

const DEFAULT_GAME_MODES = {
  versus: {
    id: 'versus',
    shortName: 'Versus',
    name: 'Versus',
    summary: 'Player-versus-player battle with configurable teams and room settings.',
    playable: true,
    startLabel: 'Create Versus Room',
    teams: ['red', 'blue'],
    allowedUnits: ['soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan'],
    defaults: {
      mapStyle: 'coastal_grassland',
      waterLevel: 10,
      rockCount: 15,
      treeCount: 30,
      sheepCount: 12,
      duckCount: 5,
      playersPerTeam: 1,
      startingUnitsPerTeam: 7,
      towersPerTeam: 0,
      homesPerTeam: 1,
      unitRoster: {
        soldier: 1,
        archer: 1,
        knight: 1,
        scout: 1,
        gunman: 1,
        crossbowman: 1,
        grenademan: 1
      }
    },
    sections: ['map', 'forces', 'wildlife']
  },
  tower_defense: {
    id: 'tower_defense',
    shortName: 'TD',
    name: 'Tower Defense',
    summary: 'Defend a base from waves. Setup is scaffolded; wave gameplay comes next.',
    playable: false,
    startLabel: 'Tower Defense Coming Soon',
    teams: ['red'],
    allowedUnits: ['soldier', 'archer', 'gunman', 'crossbowman', 'grenademan'],
    defaults: {
      mapStyle: 'defense_pass',
      waterLevel: 4,
      rockCount: 24,
      treeCount: 65,
      sheepCount: 4,
      startingGold: 250,
      waveCount: 10,
      pathComplexity: 55,
      towerSlots: 6
    },
    sections: ['map', 'defense']
  },
  unit_comparison: {
    id: 'unit_comparison',
    shortName: 'Compare',
    name: 'Unit Comparison',
    summary: 'Run an arena test where two configured groups spawn, close distance, and fight automatically.',
    playable: true,
    startLabel: 'Begin Comparison',
    teams: ['red', 'blue'],
    allowedUnits: ['soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan'],
    defaults: {
      mapStyle: 'arena',
      waterLevel: 0,
      rockCount: 0,
      treeCount: 8,
      sheepCount: 0,
      redUnitCount: 5,
      blueUnitCount: 5,
      redUnitType: 'soldier',
      blueUnitType: 'soldier',
      homesPerTeam: 0,
      towersPerTeam: 0,
      arenaSize: 50
    },
    sections: ['map', 'comparison']
  }
};

let WEAPON_DEFINITIONS = structuredClone(DEFAULT_WEAPON_DEFINITIONS);
let UNIT_DEFINITIONS = structuredClone(DEFAULT_UNIT_DEFINITIONS);
let BUILDING_DEFINITIONS = structuredClone(DEFAULT_BUILDING_DEFINITIONS);
let TERRAIN_PRESETS = structuredClone(DEFAULT_TERRAIN_PRESETS);
let GAME_MODES = structuredClone(DEFAULT_GAME_MODES);

const configLoadState = {
  loaded: false,
  usedFallback: false,
  errors: []
};

function normalizeDefinitionMap(data, fallback, label) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} must be an object keyed by id`);
  }

  const normalized = {};
  for (const [id, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    normalized[id] = { ...value, id: value.id || id };
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error(`${label} did not contain any usable entries`);
  }

  return { ...structuredClone(fallback), ...normalized };
}

async function loadJsonConfig(key, fallback, label) {
  const path = PLATFORM_CONFIG_PATHS[key];
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const json = await response.json();
  return normalizeDefinitionMap(json, fallback, label);
}

function publishGameDefinitions() {
  window.WEAPON_DEFINITIONS = WEAPON_DEFINITIONS;
  window.UNIT_DEFINITIONS = UNIT_DEFINITIONS;
  window.BUILDING_DEFINITIONS = BUILDING_DEFINITIONS;
  window.TERRAIN_PRESETS = TERRAIN_PRESETS;
  window.GAME_MODES = GAME_MODES;
  window.gameDefinitionLoadState = configLoadState;
}

async function loadGameDefinitions() {
  const loaders = [
    ['weapons', DEFAULT_WEAPON_DEFINITIONS, 'weapons'],
    ['units', DEFAULT_UNIT_DEFINITIONS, 'units'],
    ['buildings', DEFAULT_BUILDING_DEFINITIONS, 'buildings'],
    ['terrainPresets', DEFAULT_TERRAIN_PRESETS, 'terrain presets'],
    ['modes', DEFAULT_GAME_MODES, 'game modes']
  ];

  for (const [key, fallback, label] of loaders) {
    try {
      const loaded = await loadJsonConfig(key, fallback, label);
      if (key === 'weapons') WEAPON_DEFINITIONS = loaded;
      if (key === 'units') UNIT_DEFINITIONS = loaded;
      if (key === 'buildings') BUILDING_DEFINITIONS = loaded;
      if (key === 'terrainPresets') TERRAIN_PRESETS = loaded;
      if (key === 'modes') GAME_MODES = loaded;
    } catch (error) {
      configLoadState.usedFallback = true;
      configLoadState.errors.push(`${label}: ${error.message}`);
      console.warn(`Using built-in ${label} fallback.`, error);
    }
  }

  configLoadState.loaded = true;
  publishGameDefinitions();
  return configLoadState;
}

function getGameModeDefinition(modeId) {
  return GAME_MODES[modeId] || GAME_MODES.versus;
}

function getTerrainPreset(presetId) {
  return TERRAIN_PRESETS[presetId] || TERRAIN_PRESETS.coastal_grassland;
}

function getDefaultModeSettings(modeId) {
  const mode = getGameModeDefinition(modeId);
  const terrainPreset = getTerrainPreset(mode.defaults?.mapStyle);
  return { ...terrainPreset, ...mode.defaults };
}

function getWeaponDefinition(weaponId) {
  return WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS.shortbow;
}

function resolveWeaponStats(definition) {
  const weapon = definition.weapon ? getWeaponDefinition(definition.weapon) : {};
  return {
    ...definition,
    weaponDefinition: weapon,
    damage: definition.damage ?? weapon.damage ?? 8,
    movingDamage: definition.movingDamage ?? weapon.movingDamage ?? 4,
    range: definition.range ?? weapon.range,
    shootRange: definition.shootRange ?? weapon.range ?? 120,
    stopShootRange: definition.stopShootRange ?? weapon.stopRange ?? 150,
    fireRate: definition.fireRate ?? weapon.fireRate ?? 1.2,
    attackCooldown: definition.attackCooldown ?? weapon.attackCooldown,
    projectileSpeed: definition.projectileSpeed ?? weapon.projectileSpeed ?? 200,
    projectileColor: definition.projectileColor ?? weapon.projectileColor,
    projectileType: definition.projectileType ?? weapon.projectileType ?? 'arrow',
    splashRadius: definition.splashRadius ?? weapon.splashRadius ?? 0,
    melee: definition.melee ?? weapon.melee ?? false,
    weaponName: weapon.name || definition.weapon || 'Weapon',
    weaponId: definition.weapon || null
  };
}

function getUnitDefinition(unitType) {
  const definition = UNIT_DEFINITIONS[unitType] || UNIT_DEFINITIONS.soldier;
  return resolveWeaponStats(definition);
}

function getBuildingDefinition(buildingType) {
  const definition = BUILDING_DEFINITIONS[buildingType] || BUILDING_DEFINITIONS.home;
  return resolveWeaponStats(definition);
}

publishGameDefinitions();

window.loadGameDefinitions = loadGameDefinitions;
window.getGameModeDefinition = getGameModeDefinition;
window.getDefaultModeSettings = getDefaultModeSettings;
window.getTerrainPreset = getTerrainPreset;
window.getWeaponDefinition = getWeaponDefinition;
window.getUnitDefinition = getUnitDefinition;
window.getBuildingDefinition = getBuildingDefinition;
