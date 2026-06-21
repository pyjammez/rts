import IntroScreen from '/ui/screens/IntroScreen.js';
import CreatePrompt from '/ui/screens/CreatePrompt.js';

// Replace the config panel with the new intro/create flow, then call existing initializeGame()
function setupUI() {
  const oldPanel = document.getElementById('configPanel');
  if (oldPanel) oldPanel.style.display = 'none';

  const app = document.createElement('div');
  app.id = 'open-rts-app';
  document.body.insertBefore(app, document.getElementById('hud'));

  const intro = new IntroScreen(app);
  const prompt = new CreatePrompt(app);
  intro.show();

  intro.onCreate = () => {
    intro.hide();
    prompt.show();
  };

  prompt.onGenerate = (cfg) => {
    if (!window.mapConfig) {
      window.mapConfig = {
        waterLevel: 10,
        rockCount: 15,
        treeCount: 30,
        sheepCount: 12,
      };
    }

    window.mapConfig.treeCount = cfg.trees || window.mapConfig.treeCount;
    window.mapConfig.rockCount = cfg.rocks || window.mapConfig.rockCount;
    window.mapConfig.sheepCount = cfg.sheep || window.mapConfig.sheepCount;
    window.mapConfig._unitsRequested = cfg.units || window.mapConfig._unitsRequested;
    window.mapConfig._gameMode = cfg.mode || window.mapConfig._gameMode || 'versus';

    if (typeof initializeGame === 'function') {
      initializeGame();
    } else {
      console.warn('initializeGame() not found; ensure core/main.js is loaded as a script.');
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupUI);
} else {
  setupUI();
}
