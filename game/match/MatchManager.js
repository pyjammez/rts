export default class MatchManager {
  constructor(gameMode) {
    this.gameMode = gameMode;
    this.running = false;
  }

  start(config = {}) {
    this.gameMode.init(config);
    this.running = true;
  }

  update(dt) {
    if (!this.running) return;
    this.gameMode.update(dt);
    const winner = this.gameMode.checkWin && this.gameMode.checkWin();
    if (winner) this.end(winner);
  }

  end(winner) {
    this.running = false;
    if (this.gameMode.cleanup) this.gameMode.cleanup();
    console.log('Match ended, winner:', winner);
  }
}
