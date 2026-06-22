const DEFAULT_MODE_ID = 'versus';

let selectedModeId = DEFAULT_MODE_ID;

var mapConfig = {
  modeId: DEFAULT_MODE_ID,
  modeName: getGameModeDefinition(DEFAULT_MODE_ID).name,
  waterLevel: 10,
  rockCount: 15,
  treeCount: 30,
  sheepCount: 12,
  duckCount: 5,
  startingUnitsPerTeam: 8,
  towersPerTeam: 0,
  homesPerTeam: 1,
  unitRoster: {
    king: 1,
    soldier: 1,
    archer: 1,
    knight: 1,
    scout: 1,
    gunman: 1,
    crossbowman: 1,
    grenademan: 1
  },
  mapStyle: 'coastal_grassland',
  terrain: {}
};

window.mapConfig = mapConfig;

const SETTING_FIELDS = {
  map: [
    { key: 'mapStyle', label: 'Terrain Preset', type: 'select', options: getTerrainPresetOptions },
    { key: 'waterLevel', label: 'Water Coverage', type: 'range', min: 0, max: 100, suffix: '%', hint: 'Sand auto-surrounds water edges' },
    { key: 'rockCount', label: 'Rocks', type: 'range', min: 0, max: 150 },
    { key: 'treeCount', label: 'Trees', type: 'range', min: 0, max: 300 }
  ],
  wildlife: [
    { key: 'sheepCount', label: 'Sheep', type: 'range', min: 0, max: 80 },
    { key: 'duckCount', label: 'Ducks', type: 'range', min: 0, max: 80 }
  ],
  forces: [
    { key: 'unitRoster', label: 'Starting Units Per Team', type: 'unitRoster' }
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
  ]
};

const SECTION_TITLES = {
  map: 'Map',
  wildlife: 'Wildlife',
  forces: 'Starting Forces',
  defense: 'Defense Rules',
  comparison: 'Comparison Rules'
};

const SECTION_COLUMNS = {
  map: 'map',
  wildlife: 'map',
  forces: 'players',
  defense: 'players',
  comparison: 'players'
};

const COLUMN_TITLES = {
  map: 'Map Settings',
  players: 'Player Settings'
};

function getSelectedModeId() {
  return selectedModeId;
}

function setSelectedModeId(modeId) {
  selectedModeId = modeId;
}

function getUnitOptions(modeId = selectedModeId) {
  const mode = getGameModeDefinition(modeId);
  const allowedUnits = Array.isArray(mode.allowedUnits) && mode.allowedUnits.length
    ? mode.allowedUnits
    : Object.keys(UNIT_DEFINITIONS);

  return allowedUnits
    .map(unitId => getUnitDefinition(unitId))
    .filter(Boolean)
    .map(unit => ({ value: unit.id, label: unit.name }));
}

function getTerrainPresetOptions() {
  return Object.values(TERRAIN_PRESETS).map(preset => ({ value: preset.id, label: preset.name }));
}

function setPanelVisible(panel, visible) {
  if (panel) panel.style.display = visible ? 'block' : 'none';
}

function mergeModeDefaults(modeId) {
  const mode = getGameModeDefinition(modeId);
  const defaults = getDefaultModeSettings(modeId);
  mapConfig = {
    ...defaults,
    modeId: mode.id,
    modeName: mode.name,
    teams: [...mode.teams],
    terrain: {}
  };
  window.mapConfig = mapConfig;
}

function createSettingControl(field) {
  const value = mapConfig[field.key];
  const row = document.createElement('div');
  row.className = 'setting-row';

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
    const requiredCount = unitDefinition.requiredPerTeam ? 1 : 0;
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

function applyTerrainPreset(presetId) {
  const preset = getTerrainPreset(presetId);
  mapConfig.mapStyle = preset.id;
  mapConfig.waterLevel = preset.waterLevel;
  mapConfig.rockCount = preset.rockCount;
  mapConfig.treeCount = preset.treeCount;
  mapConfig.sheepCount = preset.sheepCount;
  mapConfig.duckCount = preset.duckCount || 0;
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
  getTerrainPresetOptions,
  setPanelVisible,
  mergeModeDefaults,
  createSettingControl,
  applyTerrainPreset,
  hideConfigPanel
});
