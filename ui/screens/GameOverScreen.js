function showGameOverScreen(result) {
  const gameOverScreen = document.getElementById('gameOverScreen');
  const title = document.getElementById('gameOverTitle');
  const summary = document.getElementById('gameOverSummary');
  const winner = result?.winner ? `${result.winner.charAt(0).toUpperCase()}${result.winner.slice(1)}` : null;

  if (title) title.textContent = winner ? `${winner} Wins` : 'Game Over';
  if (summary) summary.textContent = result?.reason || 'The battle has ended.';

  setPanelVisible(document.getElementById('hud'), false);
  setPanelVisible(document.getElementById('configPanel'), false);
  setPanelVisible(document.getElementById('waitingRoomPanel'), false);
  setPanelVisible(document.getElementById('modePanel'), false);
  setPanelVisible(gameOverScreen, true);
  if (gameOverScreen) gameOverScreen.style.display = 'flex';
}

function returnToModeSelection() {
  setPanelVisible(document.getElementById('gameOverScreen'), false);
  setPanelVisible(document.getElementById('hud'), false);
  setPanelVisible(document.getElementById('configPanel'), false);
  setPanelVisible(document.getElementById('waitingRoomPanel'), false);
  setPanelVisible(document.getElementById('titleScreen'), false);
  setPanelVisible(document.getElementById('modePanel'), true);

  setSelectedModeId('');
  hideConfigPanel();
  updateModeButtons();

  if (typeof resetGameSession === 'function') resetGameSession();
}

function initGameOverScreen() {
  const gameOverScreen = document.getElementById('gameOverScreen');
  if (gameOverScreen) {
    gameOverScreen.addEventListener('click', returnToModeSelection);
  }
}

window.showGameOverScreen = showGameOverScreen;
window.returnToModeSelection = returnToModeSelection;
window.initGameOverScreen = initGameOverScreen;
