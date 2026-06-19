export default class OneVOne {
  init(config) {
    this.config = config;
    this.elapsed = 0;
  }
  update(dt) {
    this.elapsed += dt;
  }
  checkWin() {
    return null;
  }
}
