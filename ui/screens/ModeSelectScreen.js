function updateModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('selected', button.dataset.mode === getSelectedModeId());
  });
}

function getActiveGamePackageId() {
  const activePackage = typeof describeConfigDefinitions === 'function'
    ? describeConfigDefinitions().activeGamePackage
    : null;
  const selectedPackageId = OpenRTS.config.gamePackages?.loadState?.selectedGamePackageId || '';
  if (selectedPackageId === 'core') return 'core';
  const search = new URLSearchParams(window.location.search || '');
  return activePackage?.id || selectedPackageId || search.get('game') || search.get('package') || 'core';
}

function packageDisplayName(entry) {
  return entry.name && entry.name !== entry.id
    ? entry.name
    : String(entry.id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

async function selectThemePackage(packageId) {
  const nextPackageId = !packageId || packageId === 'core' ? '' : packageId;
  const panel = document.getElementById('packageBrowser');
  if (panel) panel.classList.add('is-loading');

  try {
    if (typeof loadGameDefinitions === 'function') {
      await loadGameDefinitions({ packageId: nextPackageId });
    }
    if (typeof setSelectedModeId === 'function') setSelectedModeId('');
    if (typeof hideConfigPanel === 'function') hideConfigPanel();
    renderModeButtons();
  } catch (error) {
    console.warn('Unable to switch theme package.', error);
  } finally {
    if (panel) panel.classList.remove('is-loading');
  }
}

function renderPackageCards(list, container) {
  const activeId = getActiveGamePackageId();
  container.innerHTML = '';
  const coreButton = document.createElement('button');
  coreButton.type = 'button';
  coreButton.className = `package-card${activeId === 'core' ? ' selected' : ''}`;
  coreButton.dataset.packageId = 'core';
  coreButton.innerHTML = '<span>Core Open RTS</span>';
  coreButton.addEventListener('click', () => selectThemePackage('core'));
  container.appendChild(coreButton);

  for (const entry of list) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `package-card${entry.id === activeId ? ' selected' : ''}`;
    button.dataset.packageId = entry.id;

    const title = document.createElement('span');
    title.textContent = packageDisplayName(entry);

    button.appendChild(title);
    button.addEventListener('click', () => selectThemePackage(entry.id));
    container.appendChild(button);
  }
}

function renderPackageBrowser() {
  const panel = document.getElementById('packageBrowser');
  if (!panel) return;
  const api = OpenRTS.config.gamePackages;
  const description = api?.describe?.();
  const index = description?.packageIndex;

  if (!api?.listAvailableGamePackages || !index) {
    panel.innerHTML = '<div class="package-browser-status">Game packages unavailable</div>';
    return;
  }

  panel.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'package-browser-header';
  const headerText = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Theme';
  headerText.appendChild(title);
  header.appendChild(headerText);

  const list = document.createElement('div');
  list.className = 'package-list';
  panel.appendChild(header);
  panel.appendChild(list);
  renderPackageCards(api.listAvailableGamePackages(), list);
}

function renderModeButtons() {
  const modeOptions = document.getElementById('modeOptions');
  if (!modeOptions) return;

  renderPackageBrowser();
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
