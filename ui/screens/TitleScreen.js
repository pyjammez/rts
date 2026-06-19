function initTitleScreen() {
  const titleScreen = document.getElementById('titleScreen');
  const modePanel = document.getElementById('modePanel');

  if (!titleScreen) return;

  titleScreen.addEventListener('click', () => {
    setPanelVisible(titleScreen, false);
    setPanelVisible(modePanel, true);
  }, { once: true });
}

window.initTitleScreen = initTitleScreen;
