(function registerMapBuilderSystem(root) {
  'use strict';

  const tools = [
    ['water', 'Ocean'],
    ['sand', 'Sand'],
    ['grass', 'Grass'],
    ['dirt', 'Dirt'],
    ['tree', 'Trees'],
    ['rock', 'Rocks'],
    ['hill', 'Hills'],
    ['ditch', 'Ditches'],
    ['low', 'Low Ground'],
    ['high', 'High Ground'],
    ['ramp', 'Ramp'],
    ['cliff', 'Cliffs'],
    ['hut', 'NPC Hut'],
    ['well', 'Well'],
    ['house', 'House'],
    ['clear', 'Clear']
  ];

  let selectedTool = 'grass';
  let painting = false;

  function isActive() {
    return (root.mapConfig || {}).modeId === 'map_builder';
  }

  function setStatus(message) {
    const status = document.getElementById('mapBuilderStatus');
    if (status) status.textContent = message;
  }

  function renderTools() {
    const rootEl = document.getElementById('mapBuilderTools');
    if (!rootEl || rootEl.childElementCount > 0) return;
    for (const [tool, label] of tools) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-builder-tool';
      button.dataset.tool = tool;
      button.textContent = label;
      button.addEventListener('click', () => {
        selectedTool = tool;
        updateActiveTool();
        setStatus(`${label} tool selected`);
      });
      rootEl.appendChild(button);
    }
    updateActiveTool();
  }

  function updateActiveTool() {
    document.querySelectorAll('.map-builder-tool').forEach(button => {
      button.classList.toggle('is-active', button.dataset.tool === selectedTool);
    });
  }

  function updateVisibility() {
    const toolbar = document.getElementById('mapBuilderToolbar');
    if (!toolbar) return;
    const active = isActive();
    toolbar.style.display = active ? 'block' : 'none';
    if (active) {
      renderTools();
      const hud = document.getElementById('hud');
      const resourceBar = document.getElementById('resourceBar');
      if (hud) hud.style.display = 'none';
      if (resourceBar) resourceBar.style.display = 'none';
    }
  }

  function paintEvent(event) {
    if (!isActive() || !painting) return;
    if (event.target?.closest?.('#mapBuilderToolbar')) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const world = typeof screenToWorld === 'function'
      ? screenToWorld(x, y)
      : { x: x / camera.zoom + camera.x, y: y / camera.zoom + camera.y };
    if (typeof paintMapBuilderTile === 'function' && paintMapBuilderTile(world.x, world.y, selectedTool)) {
      setStatus(`Painted ${selectedTool}`);
    }
  }

  function saveMap() {
    if (!isActive() || typeof exportCurrentMapData !== 'function' || typeof saveCustomMap !== 'function') return;
    const name = prompt('Map name?', `Custom Map ${new Date().toLocaleDateString()}`);
    if (name === null) return;
    const saved = saveCustomMap(exportCurrentMapData(name));
    setStatus(`Saved "${saved.name}" for future games`);
  }

  function init() {
    renderTools();
    document.getElementById('mapBuilderSave')?.addEventListener('click', saveMap);
    canvas.addEventListener('pointerdown', event => {
      if (!isActive() || event.button !== 0 || event.target?.closest?.('#mapBuilderToolbar')) return;
      painting = true;
      paintEvent(event);
    }, true);
    canvas.addEventListener('pointermove', paintEvent, true);
    window.addEventListener('pointerup', () => {
      painting = false;
    }, true);
    setInterval(updateVisibility, 250);
    updateVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(globalThis);
