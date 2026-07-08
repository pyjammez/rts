function formatUnitRoster(roster) {
  const entries = Object.entries(roster || {})
    .map(([unitId, count]) => {
      const amount = Math.max(0, Math.floor(Number(count) || 0));
      if (amount <= 0) return null;
      const unit = getUnitDefinition(unitId);
      return `${amount} ${unit?.name || unitId}`;
    })
    .filter(Boolean);

  return entries.length ? entries.join(', ') : 'No starting units';
}

function formatBuildingRoster(roster) {
  const entries = Object.entries(roster || {})
    .map(([buildingId, count]) => {
      const amount = Math.max(0, Math.floor(Number(count) || 0));
      if (amount <= 0) return null;
      const building = typeof getBuildingDefinition === 'function' ? getBuildingDefinition(buildingId) : null;
      return `${amount} ${building?.name || buildingId}`;
    })
    .filter(Boolean);

  return entries.length ? entries.join(', ') : '';
}

function getFallbackBuildingRoster() {
  const roster = {};
  const homeCount = Math.max(0, Math.floor(Number(mapConfig.homesPerTeam) || 0));
  const towerCount = Math.max(0, Math.floor(Number(mapConfig.towersPerTeam) || 0));
  if (homeCount > 0) roster.home = homeCount;
  if (towerCount > 0) roster.tower = towerCount;
  return roster;
}

function getStartingUnitSummary(activeSlots) {
  const fallbackRoster = mapConfig.unitRoster || {};
  const summaries = (activeSlots || [])
    .map(slot => {
      const faction = typeof getFactionDefinition === 'function' ? getFactionDefinition(slot.factionId) : null;
      const roster = Object.keys(faction?.startingUnits || {}).length
        ? faction.startingUnits
        : fallbackRoster;
      return {
        team: getFlagOption(slot.flag).name,
        value: formatUnitRoster(roster)
      };
    })
    .filter(summary => summary.value && summary.value !== 'No starting units');

  if (!summaries.length) {
    const fallback = formatUnitRoster(fallbackRoster);
    return fallback && fallback !== 'No starting units' ? `${fallback} per team` : '';
  }

  const uniqueValues = new Set(summaries.map(summary => summary.value));
  if (uniqueValues.size === 1) return `${summaries[0].value} per team`;
  return summaries.map(summary => `${summary.team}: ${summary.value}`).join('; ');
}

function getStartingBuildingSummary(activeSlots) {
  const fallbackRoster = getFallbackBuildingRoster();
  const summaries = (activeSlots || [])
    .map(slot => {
      const faction = typeof getFactionDefinition === 'function' ? getFactionDefinition(slot.factionId) : null;
      const roster = Object.keys(faction?.startingBuildings || {}).length
        ? faction.startingBuildings
        : fallbackRoster;
      return {
        team: getFlagOption(slot.flag).name,
        value: formatBuildingRoster(roster)
      };
    })
    .filter(summary => summary.value);

  if (!summaries.length) {
    const fallback = formatBuildingRoster(fallbackRoster);
    return fallback ? `${fallback} per team` : '';
  }

  const uniqueValues = new Set(summaries.map(summary => summary.value));
  if (uniqueValues.size === 1) return `${summaries[0].value} per team`;
  return summaries.map(summary => `${summary.team}: ${summary.value}`).join('; ');
}

function getReviewRows(mode) {
  const terrain = getTerrainPreset(mapConfig.mapStyle);
  const mapLabel = mapConfig.loadedMap
    ? mapConfig.loadedMap.name || 'Saved Map'
    : `Generated ${String(mapConfig.generatedMapSize || '1v1').toUpperCase()} map`;
  const terrainLabel = mapConfig.loadedMap
    ? terrain.name
    : `${titleCase(mapConfig.generatedLandscape || 'flat')} ${titleCase(mapConfig.generatedTerrain || 'grass')}`;
  const activeSlots = typeof getActivePlayerSlots === 'function' ? getActivePlayerSlots(mapConfig) : [];
  const factionNames = activeSlots
    .map(slot => getFactionDefinition(slot.factionId)?.name || slot.factionId)
    .filter(Boolean);
  const rows = [
    ['Mode', mode.name],
    ['Players', `${activeSlots.length || mapConfig.playerCount || 2} of ${mapConfig.playerCount || 2} slots filled`],
    ['Teams', activeSlots.length ? activeSlots.map(slot => getFlagOption(slot.flag).name).join(' vs ') : 'Configured in room'],
    ['Factions', factionNames.length ? factionNames.join(' vs ') : 'Configured in room'],
    ['Map', mapLabel],
    ['Terrain', terrainLabel],
    ['Map Detail', `${mapConfig.waterLevel || 0}% ${mapConfig.mapStyle === 'volcanic_lava' ? 'lava' : 'water'}, ${mapConfig.rockCount || 0} rock outcrops, ${mapConfig.treeCount || 0} trees`]
  ];

  if ((Number(mapConfig.sheepCount) || 0) > 0 || (Number(mapConfig.duckCount) || 0) > 0) {
    rows.push(['Wildlife', `${mapConfig.sheepCount || 0} sheep, ${mapConfig.duckCount || 0} ducks`]);
  }

  if (mapConfig.unitRoster) {
    const unitSummary = getStartingUnitSummary(activeSlots);
    if (unitSummary) rows.push(['Starting Units', unitSummary]);
  }

  if (Number.isFinite(Number(mapConfig.homesPerTeam)) || Number.isFinite(Number(mapConfig.towersPerTeam))) {
    const buildingSummary = getStartingBuildingSummary(activeSlots);
    if (buildingSummary) rows.push(['Starting Buildings', buildingSummary]);
  }

  if (Number.isFinite(Number(mapConfig.redUnitCount)) && Number.isFinite(Number(mapConfig.blueUnitCount))) {
    const redUnit = getUnitDefinition(mapConfig.redUnitType);
    const blueUnit = getUnitDefinition(mapConfig.blueUnitType);
    rows.push(['Arena Forces', `Red: ${mapConfig.redUnitCount} ${redUnit?.name || mapConfig.redUnitType}; Blue: ${mapConfig.blueUnitCount} ${blueUnit?.name || mapConfig.blueUnitType}`]);
  }

  if (mapConfig.leftUnitRoster || mapConfig.rightUnitRoster) {
    rows.push(['Left Team', formatUnitRoster(mapConfig.leftUnitRoster)]);
    rows.push(['Right Team', formatUnitRoster(mapConfig.rightUnitRoster)]);
  }

  if (Number.isFinite(Number(mapConfig.waveCount))) {
    rows.push(['Defense Setup', `${mapConfig.waveCount} waves, ${mapConfig.startingGold || 0} starting gold, ${mapConfig.towerSlots || 0} tower slots`]);
  }

  return rows;
}

function createWaitingRoomRow(label, value) {
  const row = document.createElement('div');
  row.className = 'waiting-room-row';

  const labelEl = document.createElement('strong');
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function appendWaitingRoomChat(author, message) {
  const chatLog = document.getElementById('waitingRoomChatLog');
  if (!chatLog) return;

  const line = document.createElement('div');
  line.className = 'waiting-room-chat-line';
  line.textContent = `${author}: ${message}`;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function createPlayerCountControl() {
  const row = document.createElement('div');
  row.className = 'waiting-room-count-row';

  const label = document.createElement('label');
  label.htmlFor = 'waitingRoomPlayerCount';
  label.textContent = 'Players';

  const select = document.createElement('select');
  select.id = 'waitingRoomPlayerCount';
  for (let count = 2; count <= 8; count++) {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = String(count);
    option.selected = Number(mapConfig.playerCount) === count;
    select.appendChild(option);
  }

  select.addEventListener('change', event => {
    setPlayerCount(event.target.value);
    renderWaitingRoom();
  });

  row.appendChild(label);
  row.appendChild(select);
  return row;
}

function createFlagSwatch(flag) {
  const swatch = document.createElement('span');
  swatch.className = 'flag-swatch';
  swatch.style.backgroundColor = flag.color;
  swatch.title = `${flag.name} flag`;
  return swatch;
}

function createSlotController(slot, index) {
  const control = document.createElement('div');
  control.className = 'slot-controller';

  const label = document.createElement('span');
  label.textContent = slot.controller === 'human'
    ? index === 0 ? 'Local Human' : 'Human'
    : slot.controller === 'ai' ? 'AI' : 'Open';

  const aiToggle = document.createElement('button');
  aiToggle.type = 'button';
  aiToggle.className = `slot-toggle${slot.controller === 'ai' ? ' is-active' : ''}`;
  aiToggle.textContent = 'AI';
  aiToggle.setAttribute('aria-pressed', String(slot.controller === 'ai'));
  aiToggle.addEventListener('click', () => {
    setPlayerSlotController(index, slot.controller === 'ai' ? (index === 0 ? 'human' : 'open') : 'ai');
    renderWaitingRoom();
  });

  const humanButton = document.createElement('button');
  humanButton.type = 'button';
  humanButton.className = `slot-toggle${slot.controller === 'human' ? ' is-active' : ''}`;
  humanButton.textContent = index === 0 ? 'You' : 'Human';
  humanButton.disabled = index === 0;
  humanButton.setAttribute('aria-pressed', String(slot.controller === 'human'));
  humanButton.addEventListener('click', () => {
    setPlayerSlotController(index, 'human');
    renderWaitingRoom();
  });

  control.appendChild(label);
  control.appendChild(humanButton);
  control.appendChild(aiToggle);
  return control;
}

function createFlagSelect(slot, index) {
  const select = document.createElement('select');
  select.className = 'flag-select';
  select.ariaLabel = `Flag for slot ${index + 1}`;
  const usedByOtherSlots = new Set(
    (mapConfig.playerSlots || [])
      .filter((_, slotIndex) => slotIndex !== index)
      .map(other => other.flag)
  );

  for (const flag of PLAYER_FLAG_OPTIONS) {
    const option = document.createElement('option');
    option.value = flag.id;
    option.textContent = flag.name;
    option.selected = flag.id === slot.flag;
    option.disabled = usedByOtherSlots.has(flag.id);
    select.appendChild(option);
  }

  select.addEventListener('change', event => {
    setPlayerSlotFlag(index, event.target.value);
    renderWaitingRoom();
  });
  return select;
}

function createFactionSelect(slot, index) {
  const select = document.createElement('select');
  select.className = 'flag-select';
  select.ariaLabel = `Faction for slot ${index + 1}`;
  const factions = typeof getFactionCatalog === 'function' ? getFactionCatalog(mapConfig.modeId) : [];

  for (const faction of factions) {
    const option = document.createElement('option');
    option.value = faction.id;
    option.textContent = faction.name || faction.id;
    option.selected = faction.id === slot.factionId;
    select.appendChild(option);
  }

  select.addEventListener('change', event => {
    setPlayerSlotFaction(index, event.target.value);
    renderWaitingRoom();
  });
  return select;
}

function createWaitingRoomSlot(slot, index) {
  const flag = getFlagOption(slot.flag);
  const faction = getFactionDefinition(slot.factionId);
  const row = document.createElement('div');
  row.className = `waiting-room-slot ${slot.controller === 'open' ? 'is-open' : ''}`;

  const identity = document.createElement('div');
  identity.className = 'slot-identity';
  identity.appendChild(createFlagSwatch(flag));

  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = `Slot ${index + 1}`;
  const subtitle = document.createElement('span');
  subtitle.textContent = `${slot.name} / ${faction?.name || slot.factionId || 'Faction'}`;
  copy.appendChild(title);
  copy.appendChild(subtitle);
  identity.appendChild(copy);

  const controls = document.createElement('div');
  controls.className = 'slot-controls';
  controls.appendChild(createFlagSelect(slot, index));
  controls.appendChild(createFactionSelect(slot, index));
  controls.appendChild(createSlotController(slot, index));

  row.appendChild(identity);
  row.appendChild(controls);
  return row;
}

function createWaitingRoomSlots() {
  const section = document.createElement('section');
  section.className = 'waiting-room-slots';

  const header = document.createElement('div');
  header.className = 'waiting-room-section-title';
  header.textContent = 'Team Selection';
  section.appendChild(header);
  section.appendChild(createPlayerCountControl());

  const slots = document.createElement('div');
  slots.className = 'slot-list';
  normalizePlayerSlots(mapConfig).forEach((slot, index) => {
    slots.appendChild(createWaitingRoomSlot(slot, index));
  });
  section.appendChild(slots);
  return section;
}

function renderWaitingRoom() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  const waitingRoomPanel = document.getElementById('waitingRoomPanel');
  const summary = document.getElementById('waitingRoomSummary');
  const teams = document.getElementById('waitingRoomTeams');
  const settings = document.getElementById('waitingRoomSettings');
  const chatLog = document.getElementById('waitingRoomChatLog');
  const backToSettings = document.getElementById('backToSettings');

  if (summary) {
    summary.textContent = 'Choose teams, flags, and AI slots before starting the match.';
  }

  if (teams) {
    teams.innerHTML = '';
    teams.appendChild(createWaitingRoomSlots());
  }

  if (settings) {
    settings.innerHTML = '';
    for (const [label, value] of getReviewRows(mode)) {
      settings.appendChild(createWaitingRoomRow(label, value));
    }
  }

  if (chatLog) {
    chatLog.innerHTML = '';
    appendWaitingRoomChat('System', 'Room created. Multiplayer join slots will connect here later.');
    appendWaitingRoomChat('System', 'Local human and AI slots are ready for testing.');
  }

  if (backToSettings) {
    backToSettings.textContent = selectedModeHasMapSetup() ? 'Back to Map Setup' : 'Back to Modes';
  }

  setPanelVisible(document.getElementById('configPanel'), false);
  setPanelVisible(waitingRoomPanel, true);
}

function sendWaitingRoomChat() {
  const input = document.getElementById('waitingRoomChatInput');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  appendWaitingRoomChat('You', message);
  input.value = '';
  input.focus();
}

function selectedModeHasMapSetup() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  return Array.isArray(mode.sections) && mode.sections.some(sectionId => (SECTION_COLUMNS[sectionId] || 'players') === 'map');
}

function initReadyRoomScreen() {
  const waitingRoomPanel = document.getElementById('waitingRoomPanel');
  const configPanel = document.getElementById('configPanel');
  const modePanel = document.getElementById('modePanel');
  const backToSettings = document.getElementById('backToSettings');
  const readyButton = document.getElementById('readyButton');
  const chatSendButton = document.getElementById('waitingRoomChatSend');
  const chatInput = document.getElementById('waitingRoomChatInput');

  if (backToSettings) {
    backToSettings.addEventListener('click', () => {
      setPanelVisible(waitingRoomPanel, false);
      if (selectedModeHasMapSetup()) {
        setPanelVisible(configPanel, true);
      } else {
        setPanelVisible(modePanel, true);
      }
    });
  }

  if (readyButton) {
    readyButton.addEventListener('click', () => {
      hideConfigPanel();
      setPanelVisible(waitingRoomPanel, false);
      initializeGame();
    });
  }

  if (chatSendButton) {
    chatSendButton.addEventListener('click', sendWaitingRoomChat);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      sendWaitingRoomChat();
    });
  }
}

window.renderWaitingRoom = renderWaitingRoom;
window.initReadyRoomScreen = initReadyRoomScreen;
