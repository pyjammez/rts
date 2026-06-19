export default class IntroScreen {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'intro-screen';
    this.el.innerHTML = `
      <h1>open rts</h1>
      <p class="intro-hint">click anywhere to continue</p>
    `;
    this.container.appendChild(this.el);
    this._onClickBound = this._onClick.bind(this);
    this.hide();
  }

  _onClick(e) {
    e.stopPropagation();
    if (this.onCreate) this.onCreate();
  }
  // Attach listener on show so clicks while hidden don't trigger behavior
  show() {
    this.el.style.display = 'flex';
    this.el.addEventListener('click', this._onClickBound);
  }

  // Remove listener when hidden
  hide() {
    this.el.style.display = 'none';
    this.el.removeEventListener('click', this._onClickBound);
  }
}
