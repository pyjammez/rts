const PLATFORM_CONFIG_PATHS = {
  manifest: 'assets/data/content-manifest.json',
  abilities: 'assets/data/abilities.json',
  weapons: 'assets/data/weapons.json',
  rulesets: 'assets/data/rulesets.json',
  factions: 'assets/data/factions.json',
  units: 'assets/data/units.json',
  unitPacks: 'assets/data/unit-packs.json',
  buildings: 'assets/data/buildings.json',
  modes: 'assets/data/game-modes.json',
  terrainPresets: 'assets/data/terrain-presets.json'
};

const DEFAULT_CONTENT_MANIFEST = {
  schemaVersion: 1,
  contentVersion: '0.2.0',
  name: 'Open RTS Core Content',
  description: 'Built-in fallback content manifest.',
  files: {
    abilities: PLATFORM_CONFIG_PATHS.abilities,
    weapons: PLATFORM_CONFIG_PATHS.weapons,
    rulesets: PLATFORM_CONFIG_PATHS.rulesets,
    factions: PLATFORM_CONFIG_PATHS.factions,
    units: PLATFORM_CONFIG_PATHS.units,
    unitPacks: PLATFORM_CONFIG_PATHS.unitPacks,
    buildings: PLATFORM_CONFIG_PATHS.buildings,
    terrainPresets: PLATFORM_CONFIG_PATHS.terrainPresets,
    modes: PLATFORM_CONFIG_PATHS.modes
  },
  required: ['abilities', 'weapons', 'rulesets', 'factions', 'units', 'buildings', 'terrainPresets', 'modes'],
  optional: ['unitPacks']
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

const DEFAULT_ABILITY_DEFINITIONS = {
  bash: {
    id: 'bash',
    name: 'Bash',
    type: 'passive',
    summary: 'Heavy melee hits can become a future short stun or knockback effect.',
    target: 'enemy',
    cooldown: 6,
    tags: ['melee', 'control']
  },
  heal: {
    id: 'heal',
    name: 'Heal',
    type: 'active',
    summary: 'Restores hit points to a friendly unit once the ability system is active.',
    target: 'friendly_unit',
    range: 130,
    cooldown: 8,
    tags: ['support', 'restoration']
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    type: 'active',
    summary: 'Launches a splash-damage projectile once the ability system is active.',
    target: 'enemy_or_ground',
    range: 170,
    cooldown: 10,
    effect: {
      damage: 28,
      splashRadius: 72
    },
    tags: ['caster', 'splash']
  },
  castle_upgrade: {
    id: 'castle_upgrade',
    name: 'Castle Upgrade',
    type: 'active',
    summary: 'Allows a king to improve a friendly castle.',
    target: 'friendly_castle',
    range: 120,
    cooldown: 1,
    tags: ['economy', 'building']
  },
  gather: {
    id: 'gather',
    name: 'Gather',
    type: 'job',
    summary: 'Allows a worker to collect gold, stone, wood, or food.',
    target: 'resource',
    tags: ['worker', 'economy']
  },
  build: {
    id: 'build',
    name: 'Build',
    type: 'job',
    summary: 'Allows a worker to construct buildings.',
    target: 'ground',
    tags: ['worker', 'construction']
  }
};

const DEFAULT_RULESET_DEFINITIONS = {
  open_rts_core: {
    id: 'open_rts_core',
    name: 'Open RTS Core Rules',
    summary: 'Default flexible rules vocabulary for Open RTS.',
    resources: {
      gold: { name: 'Gold', storage: 'stockpile', defaultStartingAmount: 140, gatherable: true },
      wood: { name: 'Wood', storage: 'stockpile', defaultStartingAmount: 160, gatherable: true },
      stone: { name: 'Stone', storage: 'stockpile', defaultStartingAmount: 0, gatherable: true },
      food: { name: 'Food', storage: 'stockpile', defaultStartingAmount: 0, gatherable: true },
      supply: { name: 'Supply', storage: 'capacity', defaultStartingAmount: 0, gatherable: false }
    },
    damageTypes: {
      normal: { name: 'Normal', modifiers: {} },
      piercing: { name: 'Piercing', modifiers: { light: 1.15, armored: 0.85 } },
      explosive: { name: 'Explosive', modifiers: { structure: 1.25, light: 0.75 } },
      energy: { name: 'Energy', modifiers: { mechanical: 1.1, biological: 0.95 } }
    },
    armorTags: {
      light: { name: 'Light' },
      armored: { name: 'Armored' },
      biological: { name: 'Biological' },
      mechanical: { name: 'Mechanical' },
      structure: { name: 'Structure' },
      air: { name: 'Air' },
      heroic: { name: 'Heroic' }
    },
    effectTypes: {
      damage: { name: 'Damage' },
      heal: { name: 'Heal' },
      buff: { name: 'Buff' },
      debuff: { name: 'Debuff' },
      summon: { name: 'Summon' },
      transform: { name: 'Transform' },
      research: { name: 'Research' },
      cloak: { name: 'Cloak' },
      detect: { name: 'Detect' }
    }
  },
  spacecraft_like: {
    id: 'spacecraft_like',
    name: 'SpaceCraft-Like Rules',
    summary: 'Example sci-fi RTS rules vocabulary.',
    extends: 'open_rts_core',
    resources: {
      crystals: { name: 'Crystals', storage: 'stockpile', defaultStartingAmount: 50, gatherable: true },
      gas: { name: 'Gas', storage: 'stockpile', defaultStartingAmount: 0, gatherable: true },
      supply: { name: 'Supply', storage: 'capacity', defaultStartingAmount: 10, gatherable: false },
      energy: { name: 'Energy', storage: 'unit_pool', defaultStartingAmount: 0, gatherable: false }
    },
    damageTypes: {
      kinetic: { name: 'Kinetic', modifiers: { light: 1.05 } },
      plasma: { name: 'Plasma', modifiers: { armored: 1.15, shielded: 1.1 } },
      explosive: { name: 'Explosive', modifiers: { structure: 1.3, light: 0.7 } },
      psionic: { name: 'Psionic', modifiers: { biological: 1.2, mechanical: 0.7 } }
    },
    armorTags: {
      light: { name: 'Light' },
      armored: { name: 'Armored' },
      biological: { name: 'Biological' },
      mechanical: { name: 'Mechanical' },
      structure: { name: 'Structure' },
      air: { name: 'Air' },
      shielded: { name: 'Shielded' },
      massive: { name: 'Massive' }
    }
  }
};

const DEFAULT_FACTION_DEFINITIONS = {
  kingdoms: {
    id: 'kingdoms',
    name: 'Kingdoms',
    summary: 'Default castle-age faction for Open RTS testing.',
    ruleset: 'open_rts_core',
    theme: 'medieval',
    color: '#c93a32',
    startingResources: { gold: 140, wood: 160, stone: 0, food: 0 },
    startingUnits: { king: 0, worker: 5 },
    startingBuildings: { home: 1 },
    units: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
    buildings: ['home', 'tower'],
    techTree: { rootBuildings: ['home'], unlocks: { home: ['worker', 'king'], tower: [] } },
    production: {
      home: { train: ['worker', 'king'], research: ['castle_upgrade'] },
      tower: { train: [], research: [] }
    }
  },
  stellar_union: {
    id: 'stellar_union',
    name: 'Stellar Union',
    summary: 'Example original sci-fi faction for StarCraft-like mods.',
    ruleset: 'spacecraft_like',
    theme: 'sci_fi',
    color: '#3f7cff',
    startingResources: { crystals: 50, gas: 0, supply: 10 },
    startingUnits: { worker: 6, gunman: 0 },
    startingBuildings: { home: 1 },
    units: ['worker', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
    buildings: ['home', 'tower'],
    techTree: { rootBuildings: ['home'], unlocks: { home: ['worker', 'tower'], tower: ['gunman', 'crossbowman'] } },
    production: {
      home: { train: ['worker'], research: [] },
      tower: { train: ['gunman', 'crossbowman'], research: [] }
    }
  }
};

const DEFAULT_UNIT_DEFINITIONS = {
  king: {
    id: 'king',
    name: 'King',
    hp: 180,
    speed: 88,
    size: 24,
    weapon: 'sword',
    role: 'Royal commander and castle upgrader',
    model: 'king',
    maxPerTeam: 1
  },
  worker: {
    id: 'worker',
    name: 'Worker',
    hp: 74,
    speed: 104,
    size: 18,
    weapon: 'sword',
    role: 'Builder and resource gatherer',
    model: 'worker'
  },
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
    model: 'archer',
    canTargetAir: true
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
    model: 'gunman',
    canTargetAir: true
  },
  crossbowman: {
    id: 'crossbowman',
    name: 'Crossbowman',
    hp: 92,
    speed: 88,
    size: 20,
    weapon: 'crossbow',
    role: 'Heavy ranged infantry',
    model: 'crossbowman',
    canTargetAir: true
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
  },
  balloon: {
    id: 'balloon',
    name: 'Balloon',
    hp: 90,
    speed: 118,
    size: 22,
    weapon: 'shortbow',
    role: 'Light air scout that ignores terrain and water',
    model: 'balloon',
    movementType: 'air',
    flightHeight: 2.35,
    canTargetGround: true,
    canTargetAir: false
  }
};

const DEFAULT_UNIT_PACKS = {
  frontier_eras: {
    id: 'frontier_eras',
    name: 'Frontier Eras Sample Pack',
    summary: 'Sample moddable units across ancient, medieval, modern, future, and fantasy themes.',
    units: {
      cave_clubber: {
        name: 'Cave Clubber',
        hp: 118,
        speed: 92,
        size: 22,
        weapon: 'sword',
        role: 'Slow ancient bruiser',
        model: 'soldier',
        era: 'ancient',
        tags: ['caveman', 'melee', 'starter'],
        abilities: ['bash']
      },
      cave_slinger: {
        name: 'Cave Slinger',
        hp: 66,
        speed: 106,
        size: 18,
        weapon: 'sling',
        role: 'Primitive ranged skirmisher',
        model: 'scout',
        era: 'ancient',
        tags: ['caveman', 'ranged'],
        canTargetAir: true
      },
      medieval_spearman: {
        name: 'Spearman',
        hp: 106,
        speed: 96,
        size: 20,
        weapon: 'lance',
        role: 'Reach infantry for holding lines',
        model: 'soldier',
        era: 'medieval',
        tags: ['melee', 'anti-cavalry']
      },
      modern_rifleman: {
        name: 'Rifleman',
        hp: 88,
        speed: 104,
        size: 19,
        weapon: 'pistol',
        damage: 12,
        range: 190,
        role: 'Modern line infantry',
        model: 'gunman',
        era: 'modern',
        tags: ['gunpowder', 'ranged'],
        canTargetAir: true
      },
      field_medic: {
        name: 'Field Medic',
        hp: 70,
        speed: 112,
        size: 18,
        weapon: 'sling',
        damage: 2,
        role: 'Support unit placeholder for future healing rules',
        model: 'worker',
        era: 'modern',
        tags: ['support', 'healer'],
        abilities: ['heal']
      },
      future_laser_trooper: {
        name: 'Laser Trooper',
        hp: 96,
        speed: 110,
        size: 20,
        weapon: 'crossbow',
        damage: 16,
        range: 215,
        projectileColor: '#85f7ff',
        projectileType: 'bullet',
        role: 'Future precision infantry',
        model: 'crossbowman',
        era: 'future',
        tags: ['energy', 'ranged'],
        canTargetAir: true
      },
      hover_scout: {
        name: 'Hover Scout',
        hp: 72,
        speed: 164,
        size: 19,
        weapon: 'shortbow',
        role: 'Fast air unit for future scenarios',
        model: 'balloon',
        era: 'future',
        tags: ['air', 'scout'],
        movementType: 'air',
        flightHeight: 1.65,
        canTargetGround: true,
        canTargetAir: false
      },
      fire_mage: {
        name: 'Fire Mage',
        hp: 76,
        speed: 90,
        size: 19,
        weapon: 'grenade',
        damage: 18,
        range: 150,
        projectileColor: '#ff7a2f',
        role: 'Fantasy splash caster',
        model: 'grenademan',
        era: 'fantasy',
        tags: ['caster', 'splash'],
        abilities: ['fireball']
      }
    }
  }
};

const DEFAULT_BUILDING_DEFINITIONS = {
  home: {
    id: 'home',
    name: 'Castle',
    width: 9,
    height: 9,
    hp: 1250,
    size: 340,
    range: 360,
    damage: 11,
    attackCooldown: 1.05,
    projectileSpeed: 300,
    projectileColor: '#f0cf68',
    model: 'castle',
    canTargetGround: true,
    canTargetAir: true
  },
  tower: {
    id: 'tower',
    name: 'Arrow Tower',
    width: 2,
    height: 2,
    hp: 260,
    size: 70,
    weapon: 'tower_arrow',
    model: 'arrow_tower',
    canTargetGround: true,
    canTargetAir: true
  }
};

const DEFAULT_TERRAIN_PRESETS = {
  coastal_grassland: {
    id: 'coastal_grassland',
    name: 'Coastal Grassland',
    waterLevel: 10,
    rockCount: 20,
    treeCount: 30,
    sheepCount: 10,
    duckCount: 5,
    goldMineCount: 5
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
  },
  volcanic_lava: {
    id: 'volcanic_lava',
    name: 'Volcanic Lava Flats',
    waterLevel: 18,
    rockCount: 60,
    treeCount: 0,
    sheepCount: 0,
    duckCount: 0,
    goldMineCount: 4,
    houseCount: 0
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
    allowedUnits: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
    defaults: {
      enabledUnits: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
      unitOverrides: {},
      unitCatalogFilters: { query: '', era: 'all' },
      mapStyle: 'coastal_grassland',
      mapSize: 'default_large',
      waterLevel: 10,
      rockCount: 20,
      treeCount: 30,
      sheepCount: 10,
      duckCount: 5,
      goldMineCount: 5,
      houseCount: 1,
      startingGold: 140,
      startingWood: 160,
      startingFood: 0,
      playersPerTeam: 1,
      playerCount: 2,
      playerSlots: [
        { id: 'slot-1', name: 'You', controller: 'human', flag: 'red', ready: true },
        { id: 'slot-2', name: 'AI Opponent', controller: 'ai', flag: 'blue', ready: true }
      ],
      startingUnitsPerTeam: 8,
      towersPerTeam: 0,
      homesPerTeam: 1,
      unitRoster: {
        king: 0,
        worker: 5,
        soldier: 0,
        archer: 0,
        knight: 0,
        scout: 0,
        gunman: 0,
        crossbowman: 0,
        grenademan: 0,
        balloon: 0
      }
    },
    sections: ['map', 'forces', 'wildlife']
  },
  tower_defense: {
    id: 'tower_defense',
    shortName: 'TD',
    name: 'Tower Defense',
    summary: 'Defend your castle from simple timed enemy waves.',
    playable: true,
    startLabel: 'Create Defense Room',
    teams: ['red', 'blue'],
    allowedUnits: ['king', 'worker', 'soldier', 'archer', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
    defaults: {
      enabledUnits: ['king', 'worker', 'soldier', 'archer', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
      mapStyle: 'defense_pass',
      waterLevel: 4,
      rockCount: 24,
      treeCount: 65,
      sheepCount: 4,
      houseCount: 8,
      startingGold: 250,
      startingWood: 220,
      startingFood: 0,
      waveCount: 10,
      pathComplexity: 55,
      towerSlots: 6,
      homesPerTeam: 1,
      towersPerTeam: 2,
      unitRoster: {
        king: 1,
        worker: 2,
        soldier: 2,
        archer: 2
      }
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
    allowedUnits: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
    defaults: {
      enabledUnits: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
      mapStyle: 'arena',
      waterLevel: 0,
      rockCount: 0,
      treeCount: 8,
      sheepCount: 0,
      duckCount: 0,
      leftUnitRoster: {
        soldier: 5
      },
      rightUnitRoster: {
        soldier: 5
      },
      homesPerTeam: 0,
      towersPerTeam: 0,
      arenaSize: 50
    },
    sections: ['comparison_left', 'comparison_right']
  },
  map_builder: {
    id: 'map_builder',
    shortName: 'Builder',
    name: 'Map Builder',
    summary: 'Paint terrain, resources, cliffs, houses, and other map objects, then save the map for reuse.',
    playable: true,
    startLabel: 'Open Map Builder',
    teams: ['red'],
    allowedUnits: [],
    defaults: {
      mapStyle: 'coastal_grassland',
      mapBuilderSize: 'medium',
      waterLevel: 10,
      rockCount: 8,
      treeCount: 20,
      sheepCount: 0,
      duckCount: 0,
      houseCount: 4,
      homesPerTeam: 0,
      towersPerTeam: 0
    },
    sections: ['map_builder']
  }
};

let CONTENT_MANIFEST = structuredClone(DEFAULT_CONTENT_MANIFEST);
let ABILITY_DEFINITIONS = structuredClone(DEFAULT_ABILITY_DEFINITIONS);
let WEAPON_DEFINITIONS = structuredClone(DEFAULT_WEAPON_DEFINITIONS);
let RULESET_DEFINITIONS = structuredClone(DEFAULT_RULESET_DEFINITIONS);
let FACTION_DEFINITIONS = structuredClone(DEFAULT_FACTION_DEFINITIONS);
let BASE_UNIT_DEFINITIONS = structuredClone(DEFAULT_UNIT_DEFINITIONS);
let UNIT_PACKS = structuredClone(DEFAULT_UNIT_PACKS);
let UNIT_DEFINITIONS = mergeUnitDefinitions(BASE_UNIT_DEFINITIONS, UNIT_PACKS);
let BUILDING_DEFINITIONS = structuredClone(DEFAULT_BUILDING_DEFINITIONS);
let TERRAIN_PRESETS = structuredClone(DEFAULT_TERRAIN_PRESETS);
let GAME_MODES = structuredClone(DEFAULT_GAME_MODES);
let CONTENT_INDEX = null;

const configLoadState = {
  loaded: false,
  usedFallback: false,
  errors: [],
  manifest: CONTENT_MANIFEST,
  contentVersion: CONTENT_MANIFEST.contentVersion,
  activeGamePackage: null
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

function normalizeContentManifest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('content manifest must be an object');
  }

  const files = data.files && typeof data.files === 'object' && !Array.isArray(data.files)
    ? { ...DEFAULT_CONTENT_MANIFEST.files, ...data.files }
    : { ...DEFAULT_CONTENT_MANIFEST.files };
  const required = Array.isArray(data.required) ? data.required.filter(Boolean).map(String) : [...DEFAULT_CONTENT_MANIFEST.required];
  const optional = Array.isArray(data.optional) ? data.optional.filter(Boolean).map(String) : [...DEFAULT_CONTENT_MANIFEST.optional];

  for (const key of required) {
    if (!files[key]) throw new Error(`content manifest required file "${key}" is missing`);
  }

  return {
    ...structuredClone(DEFAULT_CONTENT_MANIFEST),
    ...data,
    schemaVersion: Number(data.schemaVersion) || DEFAULT_CONTENT_MANIFEST.schemaVersion,
    contentVersion: String(data.contentVersion || DEFAULT_CONTENT_MANIFEST.contentVersion),
    files,
    required,
    optional
  };
}

async function loadContentManifest() {
  try {
    const response = await fetch(PLATFORM_CONFIG_PATHS.manifest, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${PLATFORM_CONFIG_PATHS.manifest} returned ${response.status}`);
    CONTENT_MANIFEST = normalizeContentManifest(await response.json());
  } catch (error) {
    configLoadState.usedFallback = true;
    configLoadState.errors.push(`content manifest: ${error.message}`);
    console.warn('Using built-in content manifest fallback.', error);
    CONTENT_MANIFEST = structuredClone(DEFAULT_CONTENT_MANIFEST);
  }

  configLoadState.manifest = CONTENT_MANIFEST;
  configLoadState.contentVersion = CONTENT_MANIFEST.contentVersion;
  return CONTENT_MANIFEST;
}

function getConfigPath(key) {
  return CONTENT_MANIFEST.files?.[key] || PLATFORM_CONFIG_PATHS[key];
}

function normalizeUnitDefinition(id, definition = {}, pack = null) {
  const tags = Array.isArray(definition.tags) ? definition.tags.filter(Boolean).map(String) : [];
  const abilities = Array.isArray(definition.abilities) ? definition.abilities.filter(Boolean).map(String) : [];
  return {
    ...definition,
    id: definition.id || id,
    pack: definition.pack || pack?.id || 'core',
    packName: definition.packName || pack?.name || 'Core Units',
    era: definition.era || 'core',
    tags,
    abilities
  };
}

function normalizeUnitPacks(data, fallback = DEFAULT_UNIT_PACKS) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('unit packs must be an object keyed by id');
  }

  const normalized = {};
  for (const [packId, pack] of Object.entries(data)) {
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) continue;
    const units = {};
    for (const [unitId, unit] of Object.entries(pack.units || {})) {
      if (!unit || typeof unit !== 'object' || Array.isArray(unit)) continue;
      units[unitId] = normalizeUnitDefinition(unitId, unit, { id: pack.id || packId, name: pack.name || packId });
    }
    if (Object.keys(units).length > 0) {
      normalized[packId] = {
        ...pack,
        id: pack.id || packId,
        name: pack.name || packId,
        units
      };
    }
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error('unit packs did not contain any usable units');
  }

  return { ...structuredClone(fallback), ...normalized };
}

function mergeUnitDefinitions(baseUnits, unitPacks) {
  const merged = {};
  for (const [unitId, unit] of Object.entries(baseUnits || {})) {
    merged[unitId] = normalizeUnitDefinition(unitId, unit, { id: 'core', name: 'Core Units' });
  }

  for (const pack of Object.values(unitPacks || {})) {
    for (const [unitId, unit] of Object.entries(pack.units || {})) {
      merged[unitId] = normalizeUnitDefinition(unitId, unit, pack);
    }
  }

  return merged;
}

function refreshUnitDefinitions() {
  UNIT_DEFINITIONS = mergeUnitDefinitions(BASE_UNIT_DEFINITIONS, UNIT_PACKS);
}

function rebuildContentIndex() {
  if (!OpenRTS.config.createContentIndex) {
    CONTENT_INDEX = null;
    return CONTENT_INDEX;
  }

  CONTENT_INDEX = OpenRTS.config.createContentIndex({
    abilities: ABILITY_DEFINITIONS,
    weapons: WEAPON_DEFINITIONS,
    rulesets: RULESET_DEFINITIONS,
    factions: FACTION_DEFINITIONS,
    units: UNIT_DEFINITIONS,
    buildings: BUILDING_DEFINITIONS,
    terrainPresets: TERRAIN_PRESETS,
    modes: GAME_MODES
  });
  return CONTENT_INDEX;
}

async function loadJsonConfig(key, fallback, label) {
  const path = getConfigPath(key);
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const json = await response.json();
  if (key === 'unitPacks') return normalizeUnitPacks(json, fallback);
  return normalizeDefinitionMap(json, fallback, label);
}

function publishGameDefinitions() {
  rebuildContentIndex();
  const registry = OpenRTS.config.definitions || {};
  registry.manifest = CONTENT_MANIFEST;
  registry.abilities = ABILITY_DEFINITIONS;
  registry.weapons = WEAPON_DEFINITIONS;
  registry.rulesets = RULESET_DEFINITIONS;
  registry.factions = FACTION_DEFINITIONS;
  registry.units = UNIT_DEFINITIONS;
  registry.baseUnits = BASE_UNIT_DEFINITIONS;
  registry.unitPacks = UNIT_PACKS;
  registry.buildings = BUILDING_DEFINITIONS;
  registry.terrainPresets = TERRAIN_PRESETS;
  registry.modes = GAME_MODES;
  registry.contentIndex = CONTENT_INDEX;
  registry.loadState = configLoadState;
  registry.activeGamePackage = configLoadState.activeGamePackage;
  OpenRTS.config.definitions = registry;

  // Compatibility adapters for systems that have not migrated to OpenRTS yet.
  window.ABILITY_DEFINITIONS = ABILITY_DEFINITIONS;
  window.WEAPON_DEFINITIONS = WEAPON_DEFINITIONS;
  window.RULESET_DEFINITIONS = RULESET_DEFINITIONS;
  window.FACTION_DEFINITIONS = FACTION_DEFINITIONS;
  window.UNIT_DEFINITIONS = UNIT_DEFINITIONS;
  window.UNIT_PACKS = UNIT_PACKS;
  window.BUILDING_DEFINITIONS = BUILDING_DEFINITIONS;
  window.TERRAIN_PRESETS = TERRAIN_PRESETS;
  window.GAME_MODES = GAME_MODES;
  window.gameDefinitionLoadState = configLoadState;
  window.CONTENT_MANIFEST = CONTENT_MANIFEST;
}

function describeConfigDefinitions() {
  return {
    manifest: {
      name: CONTENT_MANIFEST.name,
      schemaVersion: CONTENT_MANIFEST.schemaVersion,
      contentVersion: CONTENT_MANIFEST.contentVersion,
      required: [...(CONTENT_MANIFEST.required || [])],
      optional: [...(CONTENT_MANIFEST.optional || [])]
    },
    loaded: !!configLoadState.loaded,
    usedFallback: !!configLoadState.usedFallback,
    errors: [...configLoadState.errors],
    activeGamePackage: configLoadState.activeGamePackage,
    counts: {
      abilities: Object.keys(ABILITY_DEFINITIONS).length,
      weapons: Object.keys(WEAPON_DEFINITIONS).length,
      rulesets: Object.keys(RULESET_DEFINITIONS).length,
      factions: Object.keys(FACTION_DEFINITIONS).length,
      units: Object.keys(UNIT_DEFINITIONS).length,
      baseUnits: Object.keys(BASE_UNIT_DEFINITIONS).length,
      unitPacks: Object.keys(UNIT_PACKS).length,
      buildings: Object.keys(BUILDING_DEFINITIONS).length,
      terrainPresets: Object.keys(TERRAIN_PRESETS).length,
      modes: Object.keys(GAME_MODES).length
    }
  };
}

async function applySelectedGamePackage() {
  const packages = OpenRTS.config.gamePackages;
  if (!packages?.loadSelectedGamePackage || !packages?.applyGamePackage) return;
  try {
    const gamePackage = await packages.loadSelectedGamePackage(window.location);
    if (!gamePackage) return;
    const merged = packages.applyGamePackage({
      abilities: ABILITY_DEFINITIONS,
      weapons: WEAPON_DEFINITIONS,
      rulesets: RULESET_DEFINITIONS,
      factions: FACTION_DEFINITIONS,
      units: BASE_UNIT_DEFINITIONS,
      unitPacks: UNIT_PACKS,
      buildings: BUILDING_DEFINITIONS,
      terrainPresets: TERRAIN_PRESETS,
      modes: GAME_MODES
    }, gamePackage);
    if (merged.abilities) ABILITY_DEFINITIONS = merged.abilities;
    if (merged.weapons) WEAPON_DEFINITIONS = merged.weapons;
    if (merged.rulesets) RULESET_DEFINITIONS = merged.rulesets;
    if (merged.factions) FACTION_DEFINITIONS = merged.factions;
    if (merged.units) BASE_UNIT_DEFINITIONS = merged.units;
    if (merged.unitPacks) UNIT_PACKS = merged.unitPacks;
    if (merged.buildings) BUILDING_DEFINITIONS = merged.buildings;
    if (merged.terrainPresets) TERRAIN_PRESETS = merged.terrainPresets;
    if (merged.modes) GAME_MODES = merged.modes;
    refreshUnitDefinitions();
    configLoadState.activeGamePackage = merged.activeGamePackage || null;
    if (gamePackage.errors?.length) {
      configLoadState.usedFallback = true;
      configLoadState.errors.push(...gamePackage.errors.map(error => `game package ${gamePackage.id}: ${error}`));
    }
  } catch (error) {
    configLoadState.usedFallback = true;
    configLoadState.errors.push(`game package: ${error.message}`);
    console.warn('Unable to load selected game package.', error);
  }
}

async function loadGameDefinitions() {
  await loadContentManifest();

  const loaders = [
    ['abilities', DEFAULT_ABILITY_DEFINITIONS, 'abilities'],
    ['weapons', DEFAULT_WEAPON_DEFINITIONS, 'weapons'],
    ['rulesets', DEFAULT_RULESET_DEFINITIONS, 'rulesets'],
    ['factions', DEFAULT_FACTION_DEFINITIONS, 'factions'],
    ['units', DEFAULT_UNIT_DEFINITIONS, 'units'],
    ['unitPacks', DEFAULT_UNIT_PACKS, 'unit packs'],
    ['buildings', DEFAULT_BUILDING_DEFINITIONS, 'buildings'],
    ['terrainPresets', DEFAULT_TERRAIN_PRESETS, 'terrain presets'],
    ['modes', DEFAULT_GAME_MODES, 'game modes']
  ];

  for (const [key, fallback, label] of loaders) {
    try {
      const loaded = await loadJsonConfig(key, fallback, label);
      if (key === 'abilities') ABILITY_DEFINITIONS = loaded;
      if (key === 'weapons') WEAPON_DEFINITIONS = loaded;
      if (key === 'rulesets') RULESET_DEFINITIONS = loaded;
      if (key === 'factions') FACTION_DEFINITIONS = loaded;
      if (key === 'units') {
        BASE_UNIT_DEFINITIONS = loaded;
        refreshUnitDefinitions();
      }
      if (key === 'unitPacks') {
        UNIT_PACKS = loaded;
        refreshUnitDefinitions();
      }
      if (key === 'buildings') BUILDING_DEFINITIONS = loaded;
      if (key === 'terrainPresets') TERRAIN_PRESETS = loaded;
      if (key === 'modes') GAME_MODES = loaded;
    } catch (error) {
      configLoadState.usedFallback = true;
      configLoadState.errors.push(`${label}: ${error.message}`);
      console.warn(`Using built-in ${label} fallback.`, error);
    }
  }

  await applySelectedGamePackage();
  configLoadState.loaded = true;
  publishGameDefinitions();
  OpenRTS.events.emit(OpenRTS.events.types.CONFIG_LOADED, {
    usedFallback: configLoadState.usedFallback,
    errors: [...configLoadState.errors]
  });
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

function getRulesetDefinition(rulesetId) {
  return RULESET_DEFINITIONS[rulesetId] || RULESET_DEFINITIONS.open_rts_core;
}

function getFactionDefinition(factionId) {
  return FACTION_DEFINITIONS[factionId] || FACTION_DEFINITIONS.kingdoms;
}

function getAbilityDefinition(abilityId) {
  if (CONTENT_INDEX) return CONTENT_INDEX.getAbility(abilityId);
  return ABILITY_DEFINITIONS[abilityId] || null;
}

function resolveAbilityDefinitions(abilityIds = []) {
  if (!Array.isArray(abilityIds)) return [];
  return abilityIds
    .map(abilityId => getAbilityDefinition(abilityId) || {
      id: String(abilityId),
      name: titleCaseAbility(abilityId),
      type: 'custom',
      summary: 'Custom ability defined by a mod or match override.',
      tags: []
    })
    .filter(Boolean);
}

function titleCaseAbility(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function resolveWeaponStats(definition) {
  const weapon = definition.weapon ? getWeaponDefinition(definition.weapon) : {};
  const abilities = Array.isArray(definition.abilities) ? definition.abilities.filter(Boolean).map(String) : [];
  return {
    ...definition,
    abilities,
    abilityDefinitions: resolveAbilityDefinitions(abilities),
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
  if (CONTENT_INDEX) return CONTENT_INDEX.getUnit(unitType);
  const definition = UNIT_DEFINITIONS[unitType] || UNIT_DEFINITIONS.soldier;
  return resolveWeaponStats(definition);
}

function getUnitCatalog() {
  if (CONTENT_INDEX) return CONTENT_INDEX.listUnits();
  return Object.entries(UNIT_DEFINITIONS)
    .map(([unitId, definition]) => resolveWeaponStats(normalizeUnitDefinition(unitId, definition)))
    .sort((a, b) => {
      const eraSort = String(a.era || '').localeCompare(String(b.era || ''));
      if (eraSort !== 0) return eraSort;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
}

function getUnitCatalogFacets() {
  if (CONTENT_INDEX) return CONTENT_INDEX.getFacets();
  const units = getUnitCatalog();
  const eras = [...new Set(units.map(unit => unit.era || 'core'))].sort();
  const packs = [...new Map(units.map(unit => [unit.pack || 'core', unit.packName || unit.pack || 'Core Units'])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const roles = [...new Set(units.map(unit => unit.role).filter(Boolean))].sort();
  return { eras, packs, roles };
}

function searchUnitCatalog(filters = {}) {
  if (CONTENT_INDEX) return CONTENT_INDEX.searchUnits(filters);
  const query = String(filters.query || '').trim().toLowerCase();
  const era = filters.era && filters.era !== 'all' ? String(filters.era) : '';
  const pack = filters.pack && filters.pack !== 'all' ? String(filters.pack) : '';
  const role = filters.role && filters.role !== 'all' ? String(filters.role) : '';
  const allowedIds = Array.isArray(filters.allowedIds) ? new Set(filters.allowedIds) : null;

  return getUnitCatalog().filter(unit => {
    if (allowedIds && !allowedIds.has(unit.id)) return false;
    if (era && unit.era !== era) return false;
    if (pack && unit.pack !== pack) return false;
    if (role && unit.role !== role) return false;
    if (!query) return true;

    const haystack = [
      unit.id,
      unit.name,
      unit.role,
      unit.era,
      unit.packName,
      ...(unit.tags || []),
      ...(unit.abilities || [])
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
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
window.getAbilityDefinition = getAbilityDefinition;
window.getWeaponDefinition = getWeaponDefinition;
window.getRulesetDefinition = getRulesetDefinition;
window.getFactionDefinition = getFactionDefinition;
window.getUnitDefinition = getUnitDefinition;
window.getUnitCatalog = getUnitCatalog;
window.getUnitCatalogFacets = getUnitCatalogFacets;
window.searchUnitCatalog = searchUnitCatalog;
window.getBuildingDefinition = getBuildingDefinition;
window.describeConfigDefinitions = describeConfigDefinitions;

OpenRTS.config.loadDefinitions = loadGameDefinitions;
OpenRTS.config.describeDefinitions = describeConfigDefinitions;
OpenRTS.config.getMode = getGameModeDefinition;
OpenRTS.config.getModeDefaults = getDefaultModeSettings;
OpenRTS.config.getTerrainPreset = getTerrainPreset;
OpenRTS.config.getAbility = getAbilityDefinition;
OpenRTS.config.getWeapon = getWeaponDefinition;
OpenRTS.config.getRuleset = getRulesetDefinition;
OpenRTS.config.getFaction = getFactionDefinition;
OpenRTS.config.getUnit = getUnitDefinition;
OpenRTS.config.getUnitCatalog = getUnitCatalog;
OpenRTS.config.searchUnits = searchUnitCatalog;
OpenRTS.config.getBuilding = getBuildingDefinition;
OpenRTS.diagnostics?.register?.('config', describeConfigDefinitions);
