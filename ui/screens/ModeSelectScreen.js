function updateModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('selected', button.dataset.mode === getSelectedModeId());
  });
}

function renderModeButtons() {
  const modeOptions = document.getElementById('modeOptions');
  if (!modeOptions) return;

  modeOptions.innerHTML = '';
  for (const mode of Object.values(GAME_MODES)) {
    const button = document.createElement('button');
    button.className = 'mode-button';
    button.type = 'button';
    button.dataset.mode = mode.id;

    const name = document.createElement('span');
    name.textContent = mode.shortName || mode.name;

    const summary = document.createElement('small');
    summary.textContent = mode.summary || mode.name;

    button.appendChild(name);
    button.appendChild(summary);
    button.addEventListener('click', () => openConfigForMode(mode.id));
    modeOptions.appendChild(button);
  }

  updateModeButtons();
}

window.updateModeButtons = updateModeButtons;
window.renderModeButtons = renderModeButtons;
