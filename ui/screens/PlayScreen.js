export default class PlayScreen {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'play-canvas';
    this.container.appendChild(this.canvas);
  }
  show() { this.canvas.style.display = 'block'; }
  hide() { this.canvas.style.display = 'none'; }
}
