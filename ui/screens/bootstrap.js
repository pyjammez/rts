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
  if (OpenRTS.config.gamePackages?.loadGamePackageIndex) {
    try {
      await OpenRTS.config.gamePackages.loadGamePackageIndex();
    } catch (error) {
      console.warn('Unable to load game package index.', error);
    }
  }
  if (typeof loadGameDefinitions === 'function') {
    await loadGameDefinitions();
  }
  if (OpenRTS.config.assets?.loadAssetManifest) {
    await OpenRTS.config.assets.loadAssetManifest();
  }
  if (OpenRTS.config.scenarios?.loadScenarios) {
    await OpenRTS.config.scenarios.loadScenarios();
  }
  initGameScreens();
});

window.initGameScreens = initGameScreens;
