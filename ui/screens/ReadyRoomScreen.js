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

function getReviewRows(mode) {
  const terrain = getTerrainPreset(mapConfig.mapStyle);
  const rows = [
    ['Mode', mode.name],
    ['Teams', Array.isArray(mode.teams) ? mode.teams.join(' vs ') : 'Configured by mode'],
    ['Terrain', terrain.name],
    ['Map Detail', `${mapConfig.waterLevel || 0}% water, ${mapConfig.rockCount || 0} rock outcrops, ${mapConfig.treeCount || 0} trees`]
  ];

  if (Number.isFinite(Number(mapConfig.sheepCount)) || Number.isFinite(Number(mapConfig.duckCount))) {
    rows.push(['Wildlife', `${mapConfig.sheepCount || 0} sheep, ${mapConfig.duckCount || 0} ducks`]);
  }

  if (mapConfig.unitRoster) {
    rows.push(['Starting Units', `${formatUnitRoster(mapConfig.unitRoster)} per team`]);
  }

  if (Number.isFinite(Number(mapConfig.homesPerTeam)) || Number.isFinite(Number(mapConfig.towersPerTeam))) {
    const castleCount = Number(mapConfig.homesPerTeam) || 0;
    const buildingParts = [`${castleCount} ${castleCount === 1 ? 'castle' : 'castles'}`];
    if ((Number(mapConfig.towersPerTeam) || 0) > 0) {
      buildingParts.push(`${mapConfig.towersPerTeam || 0} tower(s)`);
    }
    rows.push(['Starting Buildings', `${buildingParts.join(', ')} per team`]);
  }

  if (Number.isFinite(Number(mapConfig.redUnitCount)) && Number.isFinite(Number(mapConfig.blueUnitCount))) {
    const redUnit = getUnitDefinition(mapConfig.redUnitType);
    const blueUnit = getUnitDefinition(mapConfig.blueUnitType);
    rows.push(['Arena Forces', `Red: ${mapConfig.redUnitCount} ${redUnit?.name || mapConfig.redUnitType}; Blue: ${mapConfig.blueUnitCount} ${blueUnit?.name || mapConfig.blueUnitType}`]);
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

function renderWaitingRoom() {
  const mode = getGameModeDefinition(mapConfig.modeId);
  const waitingRoomPanel = document.getElementById('waitingRoomPanel');
  const summary = document.getElementById('waitingRoomSummary');
  const settings = document.getElementById('waitingRoomSettings');
  const chatLog = document.getElementById('waitingRoomChatLog');

  if (summary) {
    summary.textContent = 'Review the match settings, then mark yourself ready to begin.';
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
    appendWaitingRoomChat('System', 'Settings are ready for review.');
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

function initReadyRoomScreen() {
  const waitingRoomPanel = document.getElementById('waitingRoomPanel');
  const configPanel = document.getElementById('configPanel');
  const backToSettings = document.getElementById('backToSettings');
  const readyButton = document.getElementById('readyButton');
  const chatSendButton = document.getElementById('waitingRoomChatSend');
  const chatInput = document.getElementById('waitingRoomChatInput');

  if (backToSettings) {
    backToSettings.addEventListener('click', () => {
      setPanelVisible(waitingRoomPanel, false);
      setPanelVisible(configPanel, true);
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
