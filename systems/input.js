let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;

const inputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  mouseX: 0,
  mouseY: 0,
  mouseInside: false
};

const commandClickMarkers = [];

function addCommandClickMarker(x, y, color) {
  commandClickMarkers.push({
    x,
    y,
    color,
    age: 0,
    duration: 0.45,
    startRadius: 6,
    endRadius: 26
  });
}

function updateCommandClickMarkers(dt) {
  for (let i = commandClickMarkers.length - 1; i >= 0; i--) {
    const marker = commandClickMarkers[i];
    marker.age += dt;
    if (marker.age >= marker.duration) {
      commandClickMarkers.splice(i, 1);
    }
  }
}

function renderCommandClickMarkers(ctx) {
  for (const marker of commandClickMarkers) {
    const t = marker.age / marker.duration;
    const radius = marker.startRadius + (marker.endRadius - marker.startRadius) * t;
    const alpha = 1 - t;

    ctx.strokeStyle = marker.color === 'red'
      ? `rgba(255, 74, 74, ${alpha})`
      : `rgba(91, 224, 120, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center pulse
    ctx.fillStyle = marker.color === 'red'
      ? `rgba(255, 120, 120, ${alpha * 0.7})`
      : `rgba(130, 255, 150, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, Math.max(2, 5 * (1 - t)), 0, Math.PI * 2);
    ctx.fill();
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getFormationOffset(index, totalUnits, spacing = 36) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(totalUnits)));
  const rows = Math.ceil(totalUnits / cols);

  const col = index % cols;
  const row = Math.floor(index / cols);

  const originX = (cols - 1) * spacing * 0.5;
  const originY = (rows - 1) * spacing * 0.5;

  return {
    x: col * spacing - originX,
    y: row * spacing - originY
  };
}

function getFirstAliveSelectedTeam() {
  const firstSelected = units.find(u => u.selected && !u.isDead);
  return firstSelected ? firstSelected.team : null;
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left-click
    isSelecting = false;
    selectionStart = getMousePos(e);
  }
});

canvas.addEventListener('mousemove', (e) => {
  const mouse = getMousePos(e);
  inputState.mouseX = mouse.x;
  inputState.mouseY = mouse.y;

  if (selectionStart) {
    selectionEnd = mouse;
    if (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5) {
      isSelecting = true;
    }
  }
});

canvas.addEventListener('mouseenter', () => {
  inputState.mouseInside = true;
});

canvas.addEventListener('mouseleave', () => {
  inputState.mouseInside = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const mouse = getMousePos(e);
  inputState.mouseX = mouse.x;
  inputState.mouseY = mouse.y;

  const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAtScreenPoint(mouse.x, mouse.y, zoomFactor);
}, { passive: false });

canvas.addEventListener('mouseup', (e) => {
  selectionEnd = getMousePos(e);

  if (e.button === 0) { 
    if (isSelecting) {
        // box selection
      const startWorld = screenToWorld(selectionStart.x, selectionStart.y);
      const endWorld = screenToWorld(selectionEnd.x, selectionEnd.y);
      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

        const selectedInBox = units.filter(u =>
          !u.isDead &&
          u.x >= minX && u.x <= maxX &&
          u.y >= minY && u.y <= maxY
        );
        const selectedTeam = selectedInBox.length > 0 ? selectedInBox[0].team : null;

        // Enforce single-faction control group selection.
        units.forEach(u => {
          u.selected = !!selectedTeam && !u.isDead && u.team === selectedTeam &&
            u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
        });
    } else {
        // single click selection
      const { x, y } = screenToWorld(selectionEnd.x, selectionEnd.y);
        let clickedUnit = null;

        const selectedUnits = units.filter(u => u.selected && !u.isDead);
        const selectedTeam = selectedUnits.length > 0 ? selectedUnits[0].team : null;

        // is a unit within the spot I clicked?
        // this checks below and right of the pointer.
        // it also breaks out of the loop when it finds it to avoid unecessary comparisons
        for (const u of units) {
            if (x >= u.x - u.size/2 && x <= u.x + u.size/2 && y >= u.y - u.size/2 && y <= u.y + u.size/2) {
                clickedUnit = u;
                break;
            }
        }

        if (clickedUnit && selectedUnits.length > 0 && selectedTeam && clickedUnit.team !== selectedTeam) {
            // Attack command: selected team targets clicked enemy unit
            selectedUnits.forEach(u => {
              if (u.team === selectedTeam) {
                u.issueAttackCommand(clickedUnit, { append: e.shiftKey });
              }
            });
        } else if (clickedUnit) {
            // if we did land on a unit deselect all then select one
            units.forEach(u => u.selected = false);
            clickedUnit.selected = true;
        } else {
            // if we didn't click on anything, deselect all
            units.forEach(u => u.selected = false);
        }
    }
  }

  // reset
  selectionStart = null;
  selectionEnd = null;
  isSelecting = false;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  const mouse = getMousePos(e);
  const world = screenToWorld(mouse.x, mouse.y);

  // Check whether right-click landed on a unit
  let clickedUnit = null;
  for (const u of units) {
    if (u.isDead) continue;
    if (world.x >= u.x - u.size / 2 && world.x <= u.x + u.size / 2 && world.y >= u.y - u.size / 2 && world.y <= u.y + u.size / 2) {
      clickedUnit = u;
      break;
    }
  }

  // Visual feedback for command click
  addCommandClickMarker(world.x, world.y, clickedUnit ? 'red' : 'green');

  const selectedUnits = units.filter(unit => unit.selected && !unit.isDead);
  if (selectedUnits.length === 0) return;
  const selectedTeam = getFirstAliveSelectedTeam();
  if (!selectedTeam) return;
  const controllableUnits = selectedUnits.filter(u => u.team === selectedTeam);

  // Right-click enemy = attack command (locked target until dead)
  if (clickedUnit && clickedUnit.team !== selectedTeam) {
    controllableUnits.forEach(unit => {
      unit.issueAttackCommand(clickedUnit, { append: e.shiftKey });
    });
    return;
  }

  // Otherwise right-click ground/friendly = move command
  controllableUnits.forEach((unit, index) => {
    const offset = getFormationOffset(index, controllableUnits.length);
    const targetX = clamp(world.x + offset.x, unit.size * 0.5, getMapWidthPx() - unit.size * 0.5);
    const targetY = clamp(world.y + offset.y, unit.size * 0.5, getMapHeightPx() - unit.size * 0.5);

    unit.issueMoveCommand(targetX, targetY, { append: e.shiftKey });
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'ArrowUp') inputState.up = true;
  if (e.key === 's' || e.key === 'ArrowDown') inputState.down = true;
  if (e.key === 'a' || e.key === 'ArrowLeft') inputState.left = true;
  if (e.key === 'd' || e.key === 'ArrowRight') inputState.right = true;

  if (e.key === 'p') toggleDebugFlag('showPaths');
  if (e.key === 'r') toggleDebugFlag('showRawPaths');
  if (e.key === 'i') toggleDebugFlag('showIllegalMoves');

  if (e.key === '0') {
    const mouseX = inputState.mouseInside ? inputState.mouseX : canvas.width * 0.5;
    const mouseY = inputState.mouseInside ? inputState.mouseY : canvas.height * 0.5;
    zoomAtScreenPoint(mouseX, mouseY, 1 / camera.zoom);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'ArrowUp') inputState.up = false;
  if (e.key === 's' || e.key === 'ArrowDown') inputState.down = false;
  if (e.key === 'a' || e.key === 'ArrowLeft') inputState.left = false;
  if (e.key === 'd' || e.key === 'ArrowRight') inputState.right = false;
});

// from openai: If you skip getBoundingClientRect(), 
// mouse input will not match your canvas rendering unless the canvas is 
// flush top-left and there's no scrolling or margin. That's unreliable.
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function renderSelectionBox() {
    // Selection box
    if (isSelecting) {
        const width = selectionEnd.x - selectionStart.x;
        const height = selectionEnd.y - selectionStart.y;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(selectionStart.x, selectionStart.y, width, height);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fillRect(selectionStart.x, selectionStart.y, width, height);
      }
    }