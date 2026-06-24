let activeSetupStep = 'map';

function getModeStepSections(mode, step) {
  const sections = Array.isArray(mode.sections) ? mode.sections : [];
  const mapSections = sections.filter(sectionId => (SECTION_COLUMNS[sectionId] || 'players') === 'map');
  const playerSections = sections.filter(sectionId => (SECTION_COLUMNS[sectionId] || 'players') !== 'map');

  if (step === 'map') return mapSections.length ? mapSections : playerSections;
  return playerSections.length ? playerSections : mapSections;
}

function modeHasPlayerSetup(mode) {
  return getModeStepSections(mode, 'players').some(sectionId => (SECTION_COLUMNS[sectionId] || 'players') !== 'map');
}

function modeHasMapSetup(mode) {
  return getModeStepSections(mode, 'map').some(sectionId => (SECTION_COLUMNS[sectionId] || 'players') === 'map');
}

function getVisibleSetupStep(mode) {
  if (activeSetupStep === 'map' && !modeHasMapSetup(mode) && modeHasPlayerSetup(mode)) return 'players';
  if (activeSetupStep === 'players' && !modeHasPlayerSetup(mode)) return 'map';
  return activeSetupStep;
}

function getSetupStepTitle(mode, step) {
  const suffix = step === 'map' ? 'Map Setup' : 'Player Settings';
  return `${mode.name} - ${suffix}`;
}

function appendConfigColumn(columns, sectionsRoot, columnId, title) {
  let column = columns[columnId];
  if (column) return column;

  column = document.createElement('div');
  column.className = `config-column config-column-${columnId}`;

  const columnTitle = document.createElement('h2');
  columnTitle.className = 'config-column-title';
  columnTitle.textContent = title || COLUMN_TITLES[columnId] || columnId;
  column.appendChild(columnTitle);

  columns[columnId] = column;
  sectionsRoot.appendChild(column);
  return column;
}

function appendConfigSection(column, sectionTitleText, fields) {
  const section = document.createElement('section');
  section.className = 'config-section';

  const sectionTitle = document.createElement('h3');
  sectionTitle.textContent = sectionTitleText;
  section.appendChild(sectionTitle);

  const grid = document.createElement('div');
  grid.className = 'settings-grid';
  for (const field of fields) {
    grid.appendChild(createSettingControl(field));
  }
  section.appendChild(grid);
  column.appendChild(section);
}

function appendForcesSetup(columns, sectionsRoot) {
  const availableColumn = appendConfigColumn(columns, sectionsRoot, 'available_units', 'Available Units');
  const tuningColumn = appendConfigColumn(columns, sectionsRoot, 'unit_tuning', 'Unit Settings');
  appendConfigSection(availableColumn, SECTION_TITLES.forces_available || 'Available Units', [
    { key: 'unitCatalog', label: 'Available Units', type: 'unitCatalog' }
  ]);
  appendConfigSection(tuningColumn, SECTION_TITLES.forces_loadout || 'Unit Stats And Starting Counts', [
    { key: 'unitLoadout', label: 'Hitpoints, Damage, Abilities, And Starting Count', type: 'unitLoadout' }
  ]);
}

function continueFromSetup() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  if (!mode.playable) return;

  const step = getVisibleSetupStep(mode);
  if (step === 'map' && modeHasPlayerSetup(mode)) {
    activeSetupStep = 'players';
    renderConfigPanel(mapConfig.modeId);
    return;
  }

  if (mapConfig.modeId === 'map_builder') {
    setPanelVisible(document.getElementById('configPanel'), false);
    setPanelVisible(document.getElementById('waitingRoomPanel'), false);
    if (typeof initializeGame === 'function') initializeGame();
    return;
  }

  renderWaitingRoom();
}

function goBackFromSetup() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  const step = getVisibleSetupStep(mode);
  const hasMapSetup = modeHasMapSetup(mode);

  if (step === 'players' && hasMapSetup) {
    activeSetupStep = 'map';
    renderConfigPanel(mapConfig.modeId);
    return;
  }

  setPanelVisible(document.getElementById('configPanel'), false);
  setPanelVisible(document.getElementById('waitingRoomPanel'), false);
  setPanelVisible(document.getElementById('modePanel'), true);
}

function renderConfigPanel(modeId) {
  const mode = getGameModeDefinition(modeId);
  const step = getVisibleSetupStep(mode);
  const title = document.getElementById('configTitle');
  const summary = document.getElementById('configSummary');
  const sectionsRoot = document.getElementById('configSections');
  const startButton = document.getElementById('startButton');
  const backToModes = document.getElementById('backToModes');

  if (title) title.textContent = getSetupStepTitle(mode, step);
  if (summary) {
    summary.textContent = step === 'map'
      ? 'Choose the battlefield, terrain, resources, wildlife, and map objects before configuring players.'
      : 'Choose the units, armies, defenses, and player-facing rules for this match.';
  }
  if (sectionsRoot) {
    sectionsRoot.innerHTML = '';
    sectionsRoot.className = 'config-columns';
    const columns = {};
    const visibleSections = getModeStepSections(mode, step);

    for (const sectionId of visibleSections) {
      if (step === 'players' && sectionId === 'forces') {
        appendForcesSetup(columns, sectionsRoot);
        continue;
      }

      const fields = SETTING_FIELDS[sectionId] || [];
      const columnId = SECTION_COLUMNS[sectionId] || 'players';
      const column = appendConfigColumn(columns, sectionsRoot, columnId);
      appendConfigSection(column, SECTION_TITLES[sectionId] || sectionId, fields);
    }
  }

  if (startButton) {
    startButton.textContent = step === 'map' && modeHasPlayerSetup(mode)
      ? 'Next: Player Settings'
      : mode.startLabel;
    startButton.disabled = !mode.playable;
    startButton.title = mode.playable ? '' : 'This mode has setup controls now. Gameplay rules are the next implementation step.';
  }

  if (backToModes) {
    backToModes.textContent = step === 'players' && modeHasMapSetup(mode) ? 'Back to Map Setup' : 'Back to Modes';
  }
}

function openConfigForMode(modeId) {
  setSelectedModeId(modeId);
  mergeModeDefaults(modeId);
  activeSetupStep = 'map';
  updateModeButtons();
  renderConfigPanel(modeId);
  setPanelVisible(document.getElementById('modePanel'), false);
  setPanelVisible(document.getElementById('configPanel'), true);
}

function initGameSetupScreen() {
  const configPanel = document.getElementById('configPanel');
  const waitingRoomPanel = document.getElementById('waitingRoomPanel');
  const modePanel = document.getElementById('modePanel');
  const startButton = document.getElementById('startButton');
  const backToModes = document.getElementById('backToModes');

  if (backToModes) {
    backToModes.addEventListener('click', goBackFromSetup);
  }

  if (startButton) {
    startButton.addEventListener('click', continueFromSetup);
  }
}

window.renderConfigPanel = renderConfigPanel;
window.openConfigForMode = openConfigForMode;
window.initGameSetupScreen = initGameSetupScreen;
