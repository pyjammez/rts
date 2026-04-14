// Global config object — terrain thresholds computed at game start from actual noise percentiles
let mapConfig = {
  waterLevel: 10,   // % of map that is water (0-100)
  rockCount: 15,
  treeCount: 30,
  terrain: {}
};

function initConfigPanel() {
  const waterLevelInput = document.getElementById('waterLevel');
  const rockInput = document.getElementById('rockCount');
  const treeInput = document.getElementById('treeCount');
  const startButton = document.getElementById('startButton');

  waterLevelInput.addEventListener('input', (e) => {
    mapConfig.waterLevel = parseInt(e.target.value);
    document.getElementById('waterLevelValue').textContent = mapConfig.waterLevel;
  });

  rockInput.addEventListener('input', (e) => {
    mapConfig.rockCount = parseInt(e.target.value);
    document.getElementById('rockValue').textContent = mapConfig.rockCount;
  });

  treeInput.addEventListener('input', (e) => {
    mapConfig.treeCount = parseInt(e.target.value);
    document.getElementById('treeValue').textContent = mapConfig.treeCount;
  });

  // Start game button
  startButton.addEventListener('click', () => {
    hideConfigPanel();
    initializeGame();
  });
}

function hideConfigPanel() {
  const panel = document.getElementById('configPanel');
  panel.style.display = 'none';
}

// Call this when page loads
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('rockValue').textContent = mapConfig.rockCount;
  document.getElementById('treeValue').textContent = mapConfig.treeCount;
  document.getElementById('waterLevelValue').textContent = mapConfig.waterLevel;

  initConfigPanel();
});
