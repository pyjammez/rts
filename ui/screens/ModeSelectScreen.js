function updateModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('selected', button.dataset.mode === getSelectedModeId());
  });
}

function getActiveGamePackageId() {
  const activePackage = typeof describeConfigDefinitions === 'function'
    ? describeConfigDefinitions().activeGamePackage
    : null;
  const search = new URLSearchParams(window.location.search || '');
  return activePackage?.id || search.get('game') || search.get('package') || 'core';
}

function packageDisplayName(entry) {
  return entry.name && entry.name !== entry.id
    ? entry.name
    : String(entry.id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function navigateToGamePackage(packageId) {
  const url = new URL(window.location.href);
  if (!packageId || packageId === 'core') {
    url.searchParams.delete('game');
    url.searchParams.delete('package');
  } else {
    url.searchParams.set('game', packageId);
    url.searchParams.delete('package');
  }
  window.location.href = url.toString();
}

function renderPackageCards(list, container) {
  const activeId = getActiveGamePackageId();
  container.innerHTML = '';
  const coreButton = document.createElement('button');
  coreButton.type = 'button';
  coreButton.className = `package-card${activeId === 'core' ? ' selected' : ''}`;
  coreButton.dataset.packageId = 'core';
  coreButton.innerHTML = '<span>Core Open RTS</span><small>Default medieval sandbox package</small>';
  coreButton.addEventListener('click', () => navigateToGamePackage('core'));
  container.appendChild(coreButton);

  for (const entry of list) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `package-card${entry.id === activeId ? ' selected' : ''}`;
    button.dataset.packageId = entry.id;

    const title = document.createElement('span');
    title.textContent = packageDisplayName(entry);
    const summary = document.createElement('small');
    summary.textContent = entry.style || entry.description || entry.category || entry.id;
    const tags = document.createElement('em');
    tags.textContent = [entry.category, ...(entry.tags || []).slice(0, 3)].filter(Boolean).join(' / ');

    button.appendChild(title);
    button.appendChild(summary);
    button.appendChild(tags);
    button.addEventListener('click', () => navigateToGamePackage(entry.id));
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
