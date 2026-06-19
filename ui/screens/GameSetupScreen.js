function renderConfigPanel(modeId) {
  const mode = getGameModeDefinition(modeId);
  const title = document.getElementById('configTitle');
  const summary = document.getElementById('configSummary');
  const sectionsRoot = document.getElementById('configSections');
  const startButton = document.getElementById('startButton');

  if (title) title.textContent = mode.name;
  if (summary) summary.textContent = mode.summary;
  if (sectionsRoot) {
    sectionsRoot.innerHTML = '';
    sectionsRoot.className = 'config-columns';
    const columns = {};

    for (const sectionId of mode.sections) {
      const fields = SETTING_FIELDS[sectionId] || [];
      const columnId = SECTION_COLUMNS[sectionId] || 'players';
      let column = columns[columnId];

      if (!column) {
        column = document.createElement('div');
        column.className = `config-column config-column-${columnId}`;

        const columnTitle = document.createElement('h2');
        columnTitle.className = 'config-column-title';
        columnTitle.textContent = COLUMN_TITLES[columnId] || columnId;
        column.appendChild(columnTitle);

        columns[columnId] = column;
        sectionsRoot.appendChild(column);
      }

      const section = document.createElement('section');
      section.className = 'config-section';

      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = SECTION_TITLES[sectionId] || sectionId;
      section.appendChild(sectionTitle);

      const grid = document.createElement('div');
      grid.className = 'settings-grid';
      for (const field of fields) {
        grid.appendChild(createSettingControl(field));
      }
      section.appendChild(grid);
      column.appendChild(section);
    }
  }

  if (startButton) {
    startButton.textContent = mode.startLabel;
    startButton.disabled = !mode.playable;
    startButton.title = mode.playable ? '' : 'This mode has setup controls now. Gameplay rules are the next implementation step.';
  }
}

function openConfigForMode(modeId) {
  setSelectedModeId(modeId);
  mergeModeDefaults(modeId);
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
    backToModes.addEventListener('click', () => {
      setPanelVisible(configPanel, false);
      setPanelVisible(waitingRoomPanel, false);
      setPanelVisible(modePanel, true);
    });
  }

  if (startButton) {
    startButton.addEventListener('click', () => {
      const mode = getGameModeDefinition(mapConfig.modeId);
      if (!mode.playable) return;
      renderWaitingRoom();
    });
  }
}

window.renderConfigPanel = renderConfigPanel;
window.openConfigForMode = openConfigForMode;
window.initGameSetupScreen = initGameSetupScreen;
