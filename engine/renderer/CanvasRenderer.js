export default class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(world) {
    // Adapter: render entities; implementation left to concrete render systems
    this.clear();
  }
}
