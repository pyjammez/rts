const DEFAULT_MODE_ID = 'versus';
const PLAYER_FLAG_OPTIONS = [
  { id: 'red', name: 'Red', color: '#c63c3c' },
  { id: 'blue', name: 'Blue', color: '#3e69d7' },
  { id: 'green', name: 'Green', color: '#3f9b55' },
  { id: 'yellow', name: 'Yellow', color: '#d8b235' },
  { id: 'purple', name: 'Purple', color: '#8a58c8' },
  { id: 'orange', name: 'Orange', color: '#d77a32' },
  { id: 'teal', name: 'Teal', color: '#2e9fa0' },
  { id: 'black', name: 'Black', color: '#34302a' }
];

let selectedModeId = '';

var mapConfig = {
  modeId: DEFAULT_MODE_ID,
  modeName: getGameModeDefinition(DEFAULT_MODE_ID).name,
  savedMapId: '',
  loadedMap: null,
  mapSize: 'default_large',
  generatedMapSize: '1v1',
  generatedLandscape: 'flat',
  generatedTerrain: 'grass',
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
  startingUnitsPerTeam: 8,
  towersPerTeam: 0,
  homesPerTeam: 1,
  enabledUnits: ['king', 'worker', 'soldier', 'archer', 'knight', 'scout', 'gunman', 'crossbowman', 'grenademan', 'balloon'],
  unitOverrides: {},
  unitCatalogFilters: {
    query: '',
    era: 'all'
  },
  unitRoster: {
    king: 1,
    worker: 5,
    soldier: 0,
    archer: 0,
    knight: 0,
    scout: 0,
    gunman: 0,
    crossbowman: 0,
    grenademan: 0,
    balloon: 0
  },
  playerCount: 2,
  playerSlots: createDefaultPlayerSlots(2),
  mapStyle: 'coastal_grassland',
  terrain: {}
};

window.mapConfig = mapConfig;

const SETTING_FIELDS = {
  map: [
    { key: 'savedMapId', label: 'Saved Map', type: 'select', options: getSavedMapOptions },
    { key: 'generatedMapSize', label: 'Generated Size', type: 'select', options: getGeneratedMapSizeOptions, generatedOnly: true },
    { key: 'generatedLandscape', label: 'Landscape', type: 'select', options: getGeneratedLandscapeOptions, generatedOnly: true },
    { key: 'generatedTerrain', label: 'Terrain', type: 'select', options: getGeneratedTerrainOptions, generatedOnly: true }
  ],
  wildlife: [],
  forces: [
    { key: 'unitCatalog', label: 'Unit Catalog', type: 'unitCatalog' },
    { key: 'unitLoadout', label: 'Unit Stats And Starting Counts', type: 'unitLoadout' }
  ],
  defense: [
    { key: 'startingGold', label: 'Starting Gold', type: 'range', min: 0, max: 1000, step: 25 },
    { key: 'waveCount', label: 'Waves', type: 'range', min: 1, max: 50 },
    { key: 'pathComplexity', label: 'Path Complexity', type: 'range', min: 0, max: 100, suffix: '%' },
    { key: 'towerSlots', label: 'Tower Slots', type: 'range', min: 1, max: 20 }
  ],
  comparison: [
    { key: 'redUnitCount', label: 'Red Units', type: 'range', min: 1, max: 80 },
    { key: 'blueUnitCount', label: 'Blue Units', type: 'range', min: 1, max: 80 },
    { key: 'redUnitType', label: 'Red Unit Type', type: 'select', options: getUnitOptions },
    { key: 'blueUnitType', label: 'Blue Unit Type', type: 'select', options: getUnitOptions },
    { key: 'arenaSize', label: 'Arena Size', type: 'range', min: 20, max: 100, suffix: '%' }
  ],
  comparison_left: [
    { key: 'leftUnitRoster', rosterKey: 'leftUnitRoster', label: 'Left Team Units', type: 'unitRoster', allowZeroRequired: true }
  ],
  comparison_right: [
    { key: 'rightUnitRoster', rosterKey: 'rightUnitRoster', label: 'Right Team Units', type: 'unitRoster', allowZeroRequired: true }
  ],
  map_builder: [
    { key: 'mapBuilderSize', label: 'Map Size', type: 'select', options: getMapBuilderSizeOptions },
    { key: 'mapStyle', label: 'Starting Terrain', type: 'select', options: getTerrainPresetOptions }
  ]
};

const SECTION_TITLES = {
  map: 'Map',
  wildlife: 'Wildlife',
  forces: 'Starting Forces',
  forces_available: 'Available Units',
  forces_loadout: 'Unit Stats And Starting Counts',
  defense: 'Defense Rules',
  comparison: 'Comparison Rules',
  comparison_left: 'Left Team',
  comparison_right: 'Right Team',
  map_builder: 'Builder Setup'
};

const SECTION_COLUMNS = {
  map: 'map',
  wildlife: 'map',
  forces: 'players',
  defense: 'players',
  comparison: 'players',
  comparison_left: 'left',
  comparison_right: 'right',
  map_builder: 'map'
};

const COLUMN_TITLES = {
  map: 'Map Settings',
  players: 'Player Settings',
  left: 'Left Team',
  right: 'Right Team'
};

function getSelectedModeId() {
  return selectedModeId;
}

function setSelectedModeId(modeId) {
  selectedModeId = modeId;
}

function getUnitOptions(modeId = selectedModeId) {
  return getAvailableUnitIds(modeId)
    .map(unitId => getUnitDefinition(unitId))
    .filter(Boolean)
    .map(unit => ({ value: unit.id, label: unit.name }));
}

function getFactionCatalog(modeId = selectedModeId) {
  const mode = getGameModeDefinition(modeId);
  const allowedUnits = new Set(Array.isArray(mode.allowedUnits) && mode.allowedUnits.length
    ? mode.allowedUnits
    : Object.keys(UNIT_DEFINITIONS || {}));
  return Object.entries(FACTION_DEFINITIONS || {})
    .map(([id, faction]) => ({ ...faction, id: faction.id || id }))
    .filter(faction => {
      const units = Array.isArray(faction.units) ? faction.units : [];
      return units.length === 0 || units.some(unitId => allowedUnits.has(unitId));
    });
}

function getDefaultFactionId(index = 0, modeId = selectedModeId) {
  const factions = getFactionCatalog(modeId);
  return factions[index % Math.max(1, factions.length)]?.id || 'kingdoms';
}

function getSelectedFactionIds(config = mapConfig, modeId = config.modeId || selectedModeId) {
  const valid = new Set(getFactionCatalog(modeId).map(faction => faction.id));
  return normalizePlayerSlots(config)
    .filter(slot => slot.controller !== 'open')
    .map(slot => slot.factionId)
    .filter(factionId => valid.has(factionId));
}

function getFactionUnitIds(factionId) {
  const faction = getFactionDefinition(factionId);
  return Array.isArray(faction?.units) ? faction.units : [];
}

function getAvailableUnitIds(modeId = selectedModeId) {
  const mode = getGameModeDefinition(modeId);
  const modeUnits = Array.isArray(mode.allowedUnits) && mode.allowedUnits.length
    ? mode.allowedUnits
    : Object.keys(UNIT_DEFINITIONS || {});
  const selectedFactionIds = getSelectedFactionIds(mapConfig, modeId);
  const factionUnits = new Set(selectedFactionIds.flatMap(getFactionUnitIds));
  const baseUnits = factionUnits.size > 0
    ? modeUnits.filter(unitId => factionUnits.has(unitId))
    : modeUnits;
  const enabledUnits = Array.isArray(mapConfig.enabledUnits) && mapConfig.enabledUnits.length
    ? mapConfig.enabledUnits.filter(unitId => baseUnits.includes(unitId))
    : baseUnits;
  return enabledUnits.filter(unitId => !!(window.UNIT_DEFINITIONS || {})[unitId]);
}

function getTerrainPresetOptions() {
  return Object.entries(TERRAIN_PRESETS).map(([id, preset]) => ({
    value: preset.id || id,
    label: preset.name || titleCase(preset.id || id)
  }));
}

function getGeneratedMapSizeOptions() {
  return [
    { value: '1v1', label: '1v1' },
    { value: '2v2', label: '2v2' },
    { value: '3v3', label: '3v3' },
    { value: '4v4', label: '4v4' }
  ];
}

function getGeneratedLandscapeOptions() {
  return [
    { value: 'flat', label: 'Flat' },
    { value: 'hilly', label: 'Hilly' },
    { value: 'cliffs', label: 'Cliffs' },
    { value: 'lakes', label: 'Lakes' },
    { value: 'forest', label: 'Forest' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'city', label: 'City' }
  ];
}

function getGeneratedTerrainOptions() {
  return [
    { value: 'sand', label: 'Sand' },
    { value: 'grass', label: 'Grass' },
    { value: 'swamp', label: 'Swamp' },
    { value: 'desert', label: 'Desert' },
    { value: 'volcanic', label: 'Volcanic' },
    { value: 'metal', label: 'Metal' }
  ];
}

function getMapBuilderSizeOptions() {
  return [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ];
}

const SAVED_MAPS_STORAGE_KEY = 'open-rts.savedMaps.v1';

function getSavedMaps() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MAPS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveCustomMap(mapData) {
  const maps = getSavedMaps().filter(map => map.id !== mapData.id);
  maps.push(mapData);
  localStorage.setItem(SAVED_MAPS_STORAGE_KEY, JSON.stringify(maps.slice(-30)));
  return mapData;
}

function getSavedMapById(id) {
  return getSavedMaps().find(map => String(map.id) === String(id)) || null;
}

function getSavedMapOptions() {
  return [
    { value: '', label: 'Generated Map' },
    ...getSavedMaps().map(map => ({
      value: map.id,
      label: `${map.name} (${map.columns}x${map.rows})`
    }))
  ];
}

function getFlagOption(flagId) {
  return PLAYER_FLAG_OPTIONS.find(flag => flag.id === flagId) || PLAYER_FLAG_OPTIONS[0];
}

function getTeamColor(team) {
  return getFlagOption(team).color;
}

function createDefaultPlayerSlots(count = 2, options = {}) {
  const playerCount = Math.max(2, Math.min(8, Math.floor(Number(count) || 2)));
  const modeId = options.modeId || selectedModeId;
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `slot-${index + 1}`,
    name: index === 0 ? 'You' : index === 1 ? 'AI Opponent' : `Open Slot ${index + 1}`,
    controller: index === 0 ? 'human' : index === 1 ? 'ai' : 'open',
    flag: PLAYER_FLAG_OPTIONS[index]?.id || PLAYER_FLAG_OPTIONS[0].id,
    factionId: getDefaultFactionId(index, modeId),
    ready: index < 2
  }));
}

function normalizePlayerSlots(config = mapConfig) {
  const requestedCount = Math.max(2, Math.min(8, Math.floor(Number(config.playerCount) || 2)));
  const sourceSlots = Array.isArray(config.playerSlots) ? config.playerSlots : [];
  const modeId = config.modeId || selectedModeId;
  const factionOptions = getFactionCatalog(modeId);
  const validFactions = new Set(factionOptions.map(faction => faction.id));
  const usedFlags = new Set();
  const slots = [];

  for (let index = 0; index < requestedCount; index++) {
    const source = sourceSlots[index] || {};
    const fallback = PLAYER_FLAG_OPTIONS[index] || PLAYER_FLAG_OPTIONS[0];
    let flag = PLAYER_FLAG_OPTIONS.some(option => option.id === source.flag) ? source.flag : fallback.id;
    if (usedFlags.has(flag)) {
      flag = PLAYER_FLAG_OPTIONS.find(option => !usedFlags.has(option.id))?.id || fallback.id;
    }
    usedFlags.add(flag);

    const controller = ['human', 'ai', 'open'].includes(source.controller)
      ? source.controller
      : index === 0 ? 'human' : index === 1 ? 'ai' : 'open';
    const factionId = validFactions.has(source.factionId)
      ? source.factionId
      : getDefaultFactionId(index, modeId);

    slots.push({
      id: source.id || `slot-${index + 1}`,
      name: source.name || (index === 0 ? 'You' : controller === 'ai' ? `AI ${index + 1}` : `Open Slot ${index + 1}`),
      controller,
      flag,
      factionId,
      ready: controller !== 'open'
    });
  }

  config.playerCount = requestedCount;
  config.playerSlots = slots;
  config.teams = slots
    .filter(slot => slot.controller !== 'open')
    .map(slot => slot.flag);
  return slots;
}

function setPlayerCount(count) {
  mapConfig.playerCount = Math.max(2, Math.min(8, Math.floor(Number(count) || 2)));
  normalizePlayerSlots(mapConfig);
  window.mapConfig = mapConfig;
}

function setPlayerSlotController(slotIndex, controller) {
  normalizePlayerSlots(mapConfig);
  const slot = mapConfig.playerSlots[slotIndex];
  if (!slot || !['human', 'ai', 'open'].includes(controller)) return;
  if (slotIndex === 0 && controller === 'open') controller = 'human';
  slot.controller = controller;
  slot.ready = controller !== 'open';
  if (controller === 'human') {
    slot.name = slotIndex === 0 ? 'You' : `Human ${slotIndex + 1}`;
  } else if (controller === 'ai') {
    slot.name = `AI ${slotIndex + 1}`;
  } else {
    slot.name = `Open Slot ${slotIndex + 1}`;
  }
  normalizePlayerSlots(mapConfig);
}

function setPlayerSlotFlag(slotIndex, flag) {
  normalizePlayerSlots(mapConfig);
  const slot = mapConfig.playerSlots[slotIndex];
  if (!slot || !PLAYER_FLAG_OPTIONS.some(option => option.id === flag)) return;
  slot.flag = flag;
  normalizePlayerSlots(mapConfig);
}

function setPlayerSlotFaction(slotIndex, factionId) {
  normalizePlayerSlots(mapConfig);
  const slot = mapConfig.playerSlots[slotIndex];
  const validFactions = new Set(getFactionCatalog(mapConfig.modeId).map(faction => faction.id));
  if (!slot || !validFactions.has(factionId)) return;
  slot.factionId = factionId;
  normalizeEnabledUnits();
  normalizePlayerSlots(mapConfig);
}

function getActivePlayerSlots(config = mapConfig) {
  return normalizePlayerSlots(config).filter(slot => slot.controller !== 'open');
}

function generatedSizeFromMapSize(sizeId) {
  if (['1v1', '2v2', '3v3', '4v4'].includes(sizeId)) return sizeId;
  return '1v1';
}

function inferGeneratedTerrain(defaults = {}) {
  const style = String(defaults.mapStyle || defaults.visualStyle || '').toLowerCase();
  if (style.includes('lava') || style.includes('volcanic')) return 'volcanic';
  if (style.includes('metal')) return 'metal';
  if (style.includes('desert') || style.includes('arabia') || style.includes('dry')) return 'desert';
  if (style.includes('swamp')) return 'swamp';
  if (style.includes('sand')) return 'sand';
  return 'grass';
}

function setPanelVisible(panel, visible) {
  if (panel) panel.style.display = visible ? 'block' : 'none';
}

function mergeModeDefaults(modeId) {
  const mode = getGameModeDefinition(modeId);
  const defaults = getDefaultModeSettings(modeId);
  const enabledUnits = Array.isArray(defaults.enabledUnits)
    ? structuredClone(defaults.enabledUnits)
    : Array.isArray(mode.allowedUnits) ? structuredClone(mode.allowedUnits) : [];
  mapConfig = {
    ...defaults,
    modeId: mode.id,
    modeName: mode.name,
    savedMapId: '',
    loadedMap: null,
    teams: [...mode.teams],
    enabledUnits,
    unitOverrides: structuredClone(defaults.unitOverrides || {}),
    unitCatalogFilters: {
      query: '',
      era: 'all',
      ...(defaults.unitCatalogFilters || {})
    },
    generatedMapSize: generatedSizeFromMapSize(defaults.generatedMapSize || defaults.mapSize),
    generatedLandscape: defaults.generatedLandscape || 'flat',
    generatedTerrain: defaults.generatedTerrain || inferGeneratedTerrain(defaults),
    themeDefaultMapStyle: defaults.mapStyle,
    themeDefaultVisualStyle: defaults.visualStyle,
    themeDefaultHouseCount: Math.max(0, Math.floor(Number(defaults.houseCount) || 0)),
    themeDefaultSheepCount: Math.max(0, Math.floor(Number(defaults.sheepCount) || 0)),
    themeDefaultDuckCount: Math.max(0, Math.floor(Number(defaults.duckCount) || 0)),
    playerCount: defaults.playerCount || mode.teams.length || 2,
    playerSlots: Array.isArray(defaults.playerSlots)
      ? structuredClone(defaults.playerSlots)
      : createDefaultPlayerSlots(defaults.playerCount || mode.teams.length || 2, { modeId: mode.id }),
    terrain: {}
  };
  normalizePlayerSlots(mapConfig);
  applyGeneratedMapSettings();
  window.mapConfig = mapConfig;
}

function createSettingControl(field) {
  const value = mapConfig[field.key];
  const row = document.createElement('div');
  row.className = 'setting-row';
  if (field.generatedOnly && mapConfig.loadedMap) {
    row.style.display = 'none';
  }

  const label = document.createElement('label');
  label.htmlFor = `setting-${field.key}`;
  row.appendChild(label);

  const valueText = document.createElement('span');
  valueText.textContent = `${value}${field.suffix || ''}`;
  label.textContent = `${field.label}: `;
  label.appendChild(valueText);

  if (field.type === 'unitRoster') {
    valueText.textContent = '';
    row.appendChild(createUnitRosterControl(field));
    return row;
  }

  if (field.type === 'unitCatalog') {
    valueText.textContent = '';
    row.appendChild(createUnitCatalogControl(field));
    return row;
  }

  if (field.type === 'unitLoadout') {
    valueText.textContent = '';
    row.appendChild(createUnitLoadoutControl(field));
    return row;
  }

  if (field.type === 'select') {
    const select = document.createElement('select');
    select.id = `setting-${field.key}`;
    const options = typeof field.options === 'function' ? field.options() : field.options;

    for (const option of options) {
      const optionEl = document.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      optionEl.selected = option.value === value;
      select.appendChild(optionEl);
    }

    select.addEventListener('change', event => {
      mapConfig[field.key] = event.target.value;
      const selected = options.find(option => option.value === event.target.value);
      valueText.textContent = selected ? selected.label : event.target.value;

      if (field.key === 'mapStyle') {
        applyTerrainPreset(event.target.value);
        renderConfigPanel(mapConfig.modeId);
      } else if (field.key === 'savedMapId') {
        mapConfig.loadedMap = event.target.value ? getSavedMapById(event.target.value) : null;
        if (!mapConfig.loadedMap) applyGeneratedMapSettings();
        renderConfigPanel(mapConfig.modeId);
      } else if (['generatedMapSize', 'generatedLandscape', 'generatedTerrain'].includes(field.key)) {
        applyGeneratedMapSettings();
      }
    });

    row.appendChild(select);
    valueText.textContent = options.find(option => option.value === value)?.label || value;
    return row;
  }

  const input = document.createElement('input');
  input.id = `setting-${field.key}`;
  input.type = 'range';
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step || 1);
  input.value = String(value);
  input.addEventListener('input', event => {
    mapConfig[field.key] = parseInt(event.target.value, 10);
    valueText.textContent = `${mapConfig[field.key]}${field.suffix || ''}`;
  });
  row.appendChild(input);

  if (field.hint) {
    const hint = document.createElement('div');
    hint.className = 'spectrum-hint';
    hint.textContent = field.hint;
    row.appendChild(hint);
  }

  return row;
}

function createUnitRosterControl(field) {
  const roster = mapConfig[field.key] && typeof mapConfig[field.key] === 'object'
    ? { ...mapConfig[field.key] }
    : {};
  const options = getUnitOptions(mapConfig.modeId);
  const list = document.createElement('div');
  list.className = 'unit-roster-grid';
  mapConfig[field.key] = roster;

  for (const option of options) {
    if (!Number.isFinite(Number(roster[option.value]))) {
      roster[option.value] = 0;
    }

    const item = document.createElement('label');
    item.className = 'unit-roster-row';
    item.htmlFor = `setting-${field.key}-${option.value}`;

    const name = document.createElement('span');
    name.textContent = option.label;

    const input = document.createElement('input');
    const unitDefinition = getUnitDefinition(option.value);
    const requiredCount = unitDefinition.requiredPerTeam && !field.allowZeroRequired ? 1 : 0;
    const maximumCount = Number.isFinite(Number(unitDefinition.maxPerTeam))
      ? Math.max(requiredCount, Math.floor(Number(unitDefinition.maxPerTeam)))
      : 80;
    input.id = `setting-${field.key}-${option.value}`;
    input.type = 'number';
    input.min = String(requiredCount);
    input.max = String(maximumCount);
    input.step = '1';
    const initialCount = Math.max(requiredCount, Math.min(maximumCount, Math.floor(Number(roster[option.value]) || 0)));
    roster[option.value] = initialCount;
    input.value = String(initialCount);
    input.disabled = !!unitDefinition.requiredPerTeam && maximumCount === requiredCount;
    input.addEventListener('input', event => {
      roster[option.value] = Math.max(requiredCount, Math.min(maximumCount, Math.floor(Number(event.target.value) || 0)));
      mapConfig[field.key] = roster;
    });

    item.appendChild(name);
    item.appendChild(input);
    list.appendChild(item);
  }

  return list;
}

function createUnitLoadoutControl(field) {
  const rosterKey = field.rosterKey || 'unitRoster';
  const roster = mapConfig[rosterKey] && typeof mapConfig[rosterKey] === 'object'
    ? { ...mapConfig[rosterKey] }
    : {};
  const options = getUnitOptions(mapConfig.modeId);
  const list = document.createElement('div');
  list.className = 'unit-loadout-grid';
  mapConfig[rosterKey] = roster;
  mapConfig.unitOverrides = mapConfig.unitOverrides && typeof mapConfig.unitOverrides === 'object'
    ? mapConfig.unitOverrides
    : {};

  for (const option of options) {
    const unit = getUnitDefinition(option.value);
    if (!unit) continue;
    if (!Number.isFinite(Number(roster[option.value]))) roster[option.value] = 0;
    list.appendChild(createUnitLoadoutCard(unit, roster, field));
  }

  if (options.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'spectrum-hint';
    empty.textContent = 'Choose units from the available catalog first.';
    list.appendChild(empty);
  }

  return list;
}

function createUnitLoadoutCard(unit, roster, field) {
  const overrides = mapConfig.unitOverrides[unit.id] || {};
  const card = document.createElement('div');
  card.className = 'unit-loadout-card';

  const header = document.createElement('div');
  header.className = 'unit-loadout-header';
  const title = document.createElement('strong');
  title.textContent = unit.name || unit.id;
  const meta = document.createElement('span');
  meta.textContent = `${titleCase(unit.era || 'core')} / ${unit.weaponName || unit.weapon || 'Weapon'}`;
  header.appendChild(title);
  header.appendChild(meta);
  card.appendChild(header);

  const controls = document.createElement('div');
  controls.className = 'unit-loadout-controls';
  controls.appendChild(createStartingCountInput(unit, roster, field));
  controls.appendChild(createUnitOverrideNumber(unit.id, 'hp', 'HP', overrides.hp ?? unit.hp, 1, 5000));
  controls.appendChild(createUnitOverrideNumber(unit.id, 'damage', 'Damage', overrides.damage ?? unit.damage, 0, 1000));
  controls.appendChild(createUnitOverrideText(unit.id, 'abilities', 'Abilities', overrides.abilities ?? (unit.abilities || []).join(', ')));
  card.appendChild(controls);

  if (unit.role) {
    const role = document.createElement('div');
    role.className = 'unit-catalog-role';
    role.textContent = unit.role;
    card.appendChild(role);
  }

  return card;
}

function createStartingCountInput(unit, roster, field) {
  const label = document.createElement('label');
  label.className = 'unit-override-field';
  const text = document.createElement('span');
  text.textContent = 'Start';
  const input = document.createElement('input');
  const requiredCount = unit.requiredPerTeam && !field.allowZeroRequired ? 1 : 0;
  const maximumCount = Number.isFinite(Number(unit.maxPerTeam))
    ? Math.max(requiredCount, Math.floor(Number(unit.maxPerTeam)))
    : 80;
  const initialCount = Math.max(requiredCount, Math.min(maximumCount, Math.floor(Number(roster[unit.id]) || 0)));
  roster[unit.id] = initialCount;
  input.type = 'number';
  input.min = String(requiredCount);
  input.max = String(maximumCount);
  input.step = '1';
  input.value = String(initialCount);
  input.disabled = !!unit.requiredPerTeam && maximumCount === requiredCount;
  input.addEventListener('input', event => {
    roster[unit.id] = Math.max(requiredCount, Math.min(maximumCount, Math.floor(Number(event.target.value) || 0)));
    mapConfig[field.rosterKey || 'unitRoster'] = roster;
  });
  label.appendChild(text);
  label.appendChild(input);
  return label;
}

function normalizeEnabledUnits() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  const selectedFactionIds = getSelectedFactionIds(mapConfig, mapConfig.modeId);
  const factionUnits = new Set(selectedFactionIds.flatMap(getFactionUnitIds));
  const modeUnits = Array.isArray(mode.allowedUnits) && mode.allowedUnits.length
    ? mode.allowedUnits
    : Object.keys(UNIT_DEFINITIONS || {});
  const fallback = factionUnits.size > 0
    ? modeUnits.filter(unitId => factionUnits.has(unitId))
    : modeUnits;
  const enabled = new Set(Array.isArray(mapConfig.enabledUnits) && mapConfig.enabledUnits.length ? mapConfig.enabledUnits : fallback);

  for (const unit of typeof getUnitCatalog === 'function' ? getUnitCatalog() : []) {
    if (unit.requiredPerTeam && fallback.includes(unit.id)) enabled.add(unit.id);
  }

  mapConfig.enabledUnits = [...enabled].filter(unitId => fallback.includes(unitId) && !!(window.UNIT_DEFINITIONS || {})[unitId]);
  mapConfig.unitOverrides = mapConfig.unitOverrides && typeof mapConfig.unitOverrides === 'object'
    ? mapConfig.unitOverrides
    : {};
  mapConfig.unitCatalogFilters = {
    query: '',
    era: 'all',
    ...(mapConfig.unitCatalogFilters || {})
  };
  delete mapConfig.unitCatalogFilters.pack;
  return new Set(mapConfig.enabledUnits);
}

function createUnitCatalogControl() {
  const selectedUnits = normalizeEnabledUnits();
  const filters = mapConfig.unitCatalogFilters;
  const facets = typeof getUnitCatalogFacets === 'function'
    ? getUnitCatalogFacets()
    : { eras: [] };
  const wrapper = document.createElement('div');
  wrapper.className = 'unit-catalog';

  const controls = document.createElement('div');
  controls.className = 'unit-catalog-controls';

  const search = document.createElement('input');
  search.type = 'search';
  search.id = 'unit-catalog-search';
  search.placeholder = 'Search units, eras, weapons, abilities...';
  search.value = filters.query || '';
  search.addEventListener('input', event => {
    mapConfig.unitCatalogFilters.query = event.target.value;
    rerenderConfigPreservingFocus(search.id, event.target.selectionStart);
  });
  controls.appendChild(search);

  const eraSelect = createCatalogSelect('Era', filters.era || 'all', [
    { value: 'all', label: 'All eras' },
    ...facets.eras.map(era => ({ value: era, label: titleCase(era) }))
  ], value => {
    mapConfig.unitCatalogFilters.era = value;
    renderConfigPanel(mapConfig.modeId);
  });
  controls.appendChild(eraSelect);
  wrapper.appendChild(controls);

  const units = typeof searchUnitCatalog === 'function'
    ? searchUnitCatalog(filters)
    : Object.keys(UNIT_DEFINITIONS || {}).map(unitId => getUnitDefinition(unitId));
  const visibleUnits = units.slice(0, 80);
  const list = document.createElement('div');
  list.className = 'unit-catalog-list';

  for (const unit of visibleUnits) {
    list.appendChild(createUnitCatalogCard(unit, selectedUnits));
  }

  wrapper.appendChild(list);

  const summary = document.createElement('div');
  summary.className = 'spectrum-hint';
  summary.textContent = `${selectedUnits.size} selected for this match. Showing ${visibleUnits.length} of ${units.length} catalog units.`;
  wrapper.appendChild(summary);

  return wrapper;
}

function rerenderConfigPreservingFocus(elementId, cursorIndex = null) {
  renderConfigPanel(mapConfig.modeId);
  requestAnimationFrame(() => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.focus();
    if (Number.isFinite(Number(cursorIndex)) && typeof element.setSelectionRange === 'function') {
      element.setSelectionRange(cursorIndex, cursorIndex);
    }
  });
}

function createCatalogSelect(labelText, value, options, onChange) {
  const label = document.createElement('label');
  label.className = 'unit-catalog-filter';
  const text = document.createElement('span');
  text.textContent = labelText;
  const select = document.createElement('select');
  for (const option of options) {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    optionEl.selected = option.value === value;
    select.appendChild(optionEl);
  }
  select.addEventListener('change', event => onChange(event.target.value));
  label.appendChild(text);
  label.appendChild(select);
  return label;
}

function createUnitCatalogCard(unit, selectedUnits) {
  const selected = selectedUnits.has(unit.id) || !!unit.requiredPerTeam;
  const card = document.createElement('div');
  card.className = `unit-catalog-card${selected ? ' is-selected' : ''}`;

  const header = document.createElement('label');
  header.className = 'unit-catalog-card-header';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selected;
  checkbox.disabled = !!unit.requiredPerTeam;
  checkbox.addEventListener('change', event => {
    const next = normalizeEnabledUnits();
    if (event.target.checked) {
      next.add(unit.id);
      if (!mapConfig.unitRoster) mapConfig.unitRoster = {};
      mapConfig.unitRoster[unit.id] = Math.max(0, Math.floor(Number(mapConfig.unitRoster[unit.id]) || 0));
    } else {
      next.delete(unit.id);
      if (mapConfig.unitRoster) mapConfig.unitRoster[unit.id] = 0;
      if (mapConfig.leftUnitRoster) mapConfig.leftUnitRoster[unit.id] = 0;
      if (mapConfig.rightUnitRoster) mapConfig.rightUnitRoster[unit.id] = 0;
    }
    mapConfig.enabledUnits = [...next];
    renderConfigPanel(mapConfig.modeId);
  });

  const title = document.createElement('span');
  title.textContent = unit.name || unit.id;
  header.appendChild(checkbox);
  header.appendChild(title);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'unit-catalog-meta';
  meta.textContent = `${titleCase(unit.era || 'core')} / ${unit.weaponName || unit.weapon || 'Weapon'} / HP ${unit.hp} / DMG ${unit.damage}`;
  card.appendChild(meta);

  const role = document.createElement('div');
  role.className = 'unit-catalog-role';
  role.textContent = unit.role || 'Custom unit';
  card.appendChild(role);

  return card;
}

function createUnitOverrideNumber(unitId, key, labelText, value, min, max) {
  const label = document.createElement('label');
  label.className = 'unit-override-field';
  const text = document.createElement('span');
  text.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  input.addEventListener('input', event => {
    const parsed = Math.max(min, Math.min(max, Math.floor(Number(event.target.value) || 0)));
    mapConfig.unitOverrides[unitId] = { ...(mapConfig.unitOverrides[unitId] || {}), [key]: parsed };
  });
  label.appendChild(text);
  label.appendChild(input);
  return label;
}

function createUnitOverrideText(unitId, key, labelText, value) {
  const label = document.createElement('label');
  label.className = 'unit-override-field unit-override-field-wide';
  const text = document.createElement('span');
  text.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = Array.isArray(value) ? value.join(', ') : String(value || '');
  input.addEventListener('input', event => {
    mapConfig.unitOverrides[unitId] = {
      ...(mapConfig.unitOverrides[unitId] || {}),
      [key]: event.target.value.split(',').map(item => item.trim()).filter(Boolean)
    };
  });
  label.appendChild(text);
  label.appendChild(input);
  return label;
}

function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function applyTerrainPreset(presetId) {
  const preset = getTerrainPreset(presetId);
  mapConfig.mapStyle = preset.id || presetId;
  mapConfig.waterLevel = preset.waterLevel;
  mapConfig.rockCount = preset.rockCount;
  mapConfig.treeCount = preset.treeCount;
  mapConfig.sheepCount = preset.sheepCount;
  mapConfig.duckCount = preset.duckCount || 0;
  if (Number.isFinite(Number(preset.goldMineCount))) mapConfig.goldMineCount = preset.goldMineCount;
  if (Number.isFinite(Number(preset.houseCount))) mapConfig.houseCount = preset.houseCount;
  window.mapConfig = mapConfig;
}

function getActiveThemeId() {
  const activePackage = typeof describeConfigDefinitions === 'function'
    ? describeConfigDefinitions().activeGamePackage
    : null;
  return activePackage?.id || OpenRTS.config.gamePackages?.loadState?.selectedGamePackageId || 'core';
}

function activeThemeAllowsWildlife() {
  return getActiveThemeId() === 'era_of_kingdoms';
}

function activeThemeAllowsNeutralHouses() {
  return getActiveThemeId() === 'modern_warlord';
}

function generatedTerrainProfile(terrainId) {
  const profiles = {
    sand: { mapStyle: 'coastal_grassland', visualStyle: 'sand', waterLevel: 3, rockCount: 24, treeCount: 8, goldMineCount: 5 },
    grass: { mapStyle: 'coastal_grassland', visualStyle: 'grassland', waterLevel: 8, rockCount: 20, treeCount: 42, goldMineCount: 5 },
    swamp: { mapStyle: 'coastal_grassland', visualStyle: 'swamp', waterLevel: 22, rockCount: 14, treeCount: 72, goldMineCount: 4 },
    desert: { mapStyle: 'coastal_grassland', visualStyle: 'desert', waterLevel: 1, rockCount: 34, treeCount: 4, goldMineCount: 6 },
    volcanic: { mapStyle: 'volcanic_lava', visualStyle: 'volcanic', waterLevel: 18, rockCount: 64, treeCount: 0, goldMineCount: 4 },
    metal: { mapStyle: 'metal_plateau', visualStyle: 'metal_wasteland', waterLevel: 2, rockCount: 72, treeCount: 0, goldMineCount: 10 }
  };
  return profiles[terrainId] || profiles.grass;
}

function generatedLandscapeProfile(landscapeId) {
  const profiles = {
    flat: { waterLevelDelta: 0, rockDelta: 0, treeDelta: 0, houseDelta: 0 },
    hilly: { waterLevelDelta: 0, rockDelta: 10, treeDelta: 8, hilliness: 'hilly' },
    cliffs: { waterLevelDelta: 0, rockDelta: 30, treeDelta: -8, hilliness: 'cliffs' },
    lakes: { waterLevelDelta: 16, rockDelta: 0, treeDelta: 12 },
    forest: { waterLevelDelta: 2, rockDelta: -6, treeDelta: 90 },
    ocean: { waterLevelDelta: 34, rockDelta: 8, treeDelta: -12 },
    city: { waterLevelDelta: 0, rockDelta: -4, treeDelta: -20, houseDelta: 10 }
  };
  return profiles[landscapeId] || profiles.flat;
}

function generatedSizeMultiplier(sizeId) {
  return { '1v1': 1, '2v2': 1.55, '3v3': 2.05, '4v4': 2.55 }[sizeId] || 1;
}

function applyGeneratedMapSettings() {
  if (mapConfig.loadedMap) return;
  const terrain = generatedTerrainProfile(mapConfig.generatedTerrain || 'grass');
  const landscape = generatedLandscapeProfile(mapConfig.generatedLandscape || 'flat');
  const multiplier = generatedSizeMultiplier(mapConfig.generatedMapSize || '1v1');
  const preserveThemeStyle = getActiveThemeId() !== 'core';

  mapConfig.mapSize = mapConfig.generatedMapSize || '1v1';
  mapConfig.mapStyle = preserveThemeStyle && mapConfig.themeDefaultMapStyle ? mapConfig.themeDefaultMapStyle : terrain.mapStyle;
  mapConfig.visualStyle = preserveThemeStyle && mapConfig.themeDefaultVisualStyle ? mapConfig.themeDefaultVisualStyle : terrain.visualStyle;
  mapConfig.waterLevel = Math.max(0, Math.min(70, Math.round((terrain.waterLevel || 0) + (landscape.waterLevelDelta || 0))));
  mapConfig.rockCount = Math.max(0, Math.round(((terrain.rockCount || 0) + (landscape.rockDelta || 0)) * multiplier));
  mapConfig.treeCount = Math.max(0, Math.round(((terrain.treeCount || 0) + (landscape.treeDelta || 0)) * multiplier));
  mapConfig.goldMineCount = Math.max(0, Math.round((terrain.goldMineCount || 0) * multiplier));
  mapConfig.generatedHilliness = landscape.hilliness || mapConfig.generatedLandscape || 'flat';
  mapConfig.houseCount = activeThemeAllowsNeutralHouses()
    ? Math.max(0, Math.round((Number(mapConfig.themeDefaultHouseCount) || 0) + (landscape.houseDelta || 0)))
    : 0;
  if (activeThemeAllowsWildlife()) {
    mapConfig.sheepCount = Math.max(0, Math.floor(Number(mapConfig.themeDefaultSheepCount) || 0));
    mapConfig.duckCount = Math.max(0, Math.floor(Number(mapConfig.themeDefaultDuckCount) || 0));
  } else {
    mapConfig.sheepCount = 0;
    mapConfig.duckCount = 0;
  }
  window.mapConfig = mapConfig;
}

function hideConfigPanel() {
  setPanelVisible(document.getElementById('configPanel'), false);
  setPanelVisible(document.getElementById('waitingRoomPanel'), false);
}

Object.assign(window, {
  DEFAULT_MODE_ID,
  SETTING_FIELDS,
  SECTION_TITLES,
  SECTION_COLUMNS,
  COLUMN_TITLES,
  getSelectedModeId,
  setSelectedModeId,
  getUnitOptions,
  getFactionCatalog,
  getSelectedFactionIds,
  getAvailableUnitIds,
  getTerrainPresetOptions,
  PLAYER_FLAG_OPTIONS,
  getFlagOption,
  getTeamColor,
  createDefaultPlayerSlots,
  normalizePlayerSlots,
  setPlayerCount,
  setPlayerSlotController,
  setPlayerSlotFlag,
  setPlayerSlotFaction,
  getActivePlayerSlots,
  setPanelVisible,
  mergeModeDefaults,
  createSettingControl,
  applyTerrainPreset,
  hideConfigPanel
});
