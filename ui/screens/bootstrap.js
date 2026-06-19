function initGameScreens() {
  initTitleScreen();
  renderModeButtons();
  initGameSetupScreen();
  initReadyRoomScreen();
  initGameOverScreen();

  mergeModeDefaults(DEFAULT_MODE_ID);
  renderConfigPanel(DEFAULT_MODE_ID);
  updateModeButtons();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof loadGameDefinitions === 'function') {
    await loadGameDefinitions();
  }
  initGameScreens();
});

window.initGameScreens = initGameScreens;
