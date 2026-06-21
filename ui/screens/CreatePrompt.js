export default class CreatePrompt {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'create-prompt';
    this.el.innerHTML = `
      <label>Mode:
        <select id="mode-select">
          <option value="versus">Versus</option>
          <option value="ctf">Capture the Flag</option>
          <option value="arena">Arena</option>
          <option value="towerDefense">Tower Defense</option>
        </select>
      </label>
      <label>Units: <input id="units-count" type="number" value="6" min="0"></label>
      <label>Trees: <input id="trees-count" type="number" value="10" min="0"></label>
      <label>Rocks: <input id="rocks-count" type="number" value="6" min="0"></label>
      <label>Sheep: <input id="sheep-count" type="number" value="4" min="0"></label>
      <button id="gen-btn">Generate Map</button>
    `;
    this.container.appendChild(this.el);
    this.el.querySelector('#gen-btn').addEventListener('click', () => {
      const cfg = {
        mode: this.el.querySelector('#mode-select').value,
        units: parseInt(this.el.querySelector('#units-count').value, 10),
        trees: parseInt(this.el.querySelector('#trees-count').value, 10),
        rocks: parseInt(this.el.querySelector('#rocks-count').value, 10),
        sheep: parseInt(this.el.querySelector('#sheep-count').value, 10),
      };
      this.onGenerate && this.onGenerate(cfg);
    });
    this.hide();
  }
  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }
}
