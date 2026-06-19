let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;
let suppressNextClick = false;

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

function getCommandClickMarkers() {
  return commandClickMarkers;
}

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

function getUnitAtWorldPoint(worldX, worldY) {
  let clickedUnit = null;

  for (const unit of units) {
    if (unit.isDead) continue;
    if (
      worldX >= unit.x - unit.size / 2 &&
      worldX <= unit.x + unit.size / 2 &&
      worldY >= unit.y - unit.size / 2 &&
      worldY <= unit.y + unit.size / 2
    ) {
      clickedUnit = unit;
      break;
    }
  }

  return clickedUnit;
}

function getInspectableAtWorldPoint(worldX, worldY) {
  return (typeof getSheepAtPoint === 'function' && getSheepAtPoint(worldX, worldY)) ||
    (typeof getDuckAtPoint === 'function' && getDuckAtPoint(worldX, worldY)) ||
    (typeof getHorseAtPoint === 'function' && getHorseAtPoint(worldX, worldY)) ||
    (typeof getObstacleAtPoint === 'function' && getObstacleAtPoint(worldX, worldY)) ||
    null;
}

function selectInspectableObject(object) {
  units.forEach(unit => unit.selected = false);
  if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
  if (typeof selectWorldObject === 'function') selectWorldObject(object);
}

function isUnitVisibleOnScreen(unit) {
  if (typeof use3DRenderer === 'function' && use3DRenderer() && typeof is3DWorldPointVisible === 'function') {
    return is3DWorldPointVisible(unit.x, unit.y, 0.6);
  }

  return unit.x >= camera.x &&
    unit.x <= camera.x + camera.viewportWidth / camera.zoom &&
    unit.y >= camera.y &&
    unit.y <= camera.y + camera.viewportHeight / camera.zoom;
}

function selectVisibleFactionUnits(team) {
  let selectedAny = false;

  units.forEach(unit => {
    unit.selected = !unit.isDead && unit.team === team && isUnitVisibleOnScreen(unit);
    if (unit.selected) selectedAny = true;
  });

  if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
  if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
  return selectedAny;
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
        if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
        if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
        suppressNextClick = true;
    } else {
        // single click selection
      const { x, y } = screenToWorld(selectionEnd.x, selectionEnd.y);
        let clickedUnit = null;
        const clickedSheep = typeof getSheepAtPoint === 'function'
          ? getSheepAtPoint(x, y)
          : null;
        const clickedDuck = typeof getDuckAtPoint === 'function'
          ? getDuckAtPoint(x, y)
          : null;
        const clickedHorse = typeof getHorseAtPoint === 'function'
          ? getHorseAtPoint(x, y)
          : null;
        const clickedObstacle = typeof getObstacleAtPoint === 'function'
          ? getObstacleAtPoint(x, y)
          : null;
        const clickedBuilding = typeof use3DRenderer === 'function' && use3DRenderer()
          ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(x, y) : null)
          : (typeof getBuildingAtScreenPoint === 'function'
              ? getBuildingAtScreenPoint(selectionEnd.x, selectionEnd.y)
              : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(x, y) : null));

        const selectedUnits = units.filter(u => u.selected && !u.isDead);
        const selectedTeam = selectedUnits.length > 0 ? selectedUnits[0].team : null;

        // is a unit within the spot I clicked?
        // this checks below and right of the pointer.
        // it also breaks out of the loop when it finds it to avoid unecessary comparisons
        for (const u of units) {
            if (u.isDead) continue;
            if (x >= u.x - u.size/2 && x <= u.x + u.size/2 && y >= u.y - u.size/2 && y <= u.y + u.size/2) {
                clickedUnit = u;
                break;
            }
        }

        const clickedWildlife = clickedDuck;
        const clickedInspectable = clickedSheep || clickedDuck || clickedHorse || clickedObstacle;
        if (clickedSheep && selectedUnits.length > 0 && selectedTeam) {
            const rider = selectedUnits.find(u => u.team === selectedTeam && !u.mountType && !u.mountTarget);
            if (rider && typeof rider.issueMountCommand === 'function') {
              addCommandClickMarker(clickedSheep.x, clickedSheep.y, 'green');
              rider.issueMountCommand(clickedSheep, { append: e.shiftKey });
            }
        } else if (clickedWildlife && selectedUnits.length > 0 && selectedTeam) {
            addCommandClickMarker(clickedWildlife.x, clickedWildlife.y, 'red');
            selectedUnits.forEach(u => {
              if (u.team === selectedTeam) {
                u.issueAttackCommand(clickedWildlife, { append: e.shiftKey });
              }
            });
        } else if (clickedUnit && selectedUnits.length > 0 && selectedTeam && clickedUnit.team !== selectedTeam) {
            // Attack command: selected team targets clicked enemy unit
            selectedUnits.forEach(u => {
              if (u.team === selectedTeam) {
                u.issueAttackCommand(clickedUnit, { append: e.shiftKey });
              }
            });
        } else if (clickedUnit) {
            // if we did land on a unit deselect all then select one
            units.forEach(u => u.selected = false);
            if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
            if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
            clickedUnit.selected = true;
        } else if (clickedInspectable) {
            selectInspectableObject(clickedInspectable);
        } else if (clickedBuilding && selectedUnits.length > 0 && selectedTeam && clickedBuilding.team !== selectedTeam) {
            addCommandClickMarker(clickedBuilding.x, clickedBuilding.y, 'red');
            selectedUnits.forEach(u => {
              if (u.team === selectedTeam) {
                u.issueAttackCommand(clickedBuilding, { append: e.shiftKey });
              }
            });
        } else if (clickedBuilding) {
            units.forEach(u => u.selected = false);
            if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
            if (typeof selectBuilding === 'function') selectBuilding(clickedBuilding);
        } else {
            // if we didn't click on anything, deselect all
            units.forEach(u => u.selected = false);
            if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
            if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
        }
    }
  }

  // reset
  selectionStart = null;
  selectionEnd = null;
  isSelecting = false;
});

canvas.addEventListener('click', (e) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (isSelecting) return;

  const mouse = getMousePos(e);
  const world = screenToWorld(mouse.x, mouse.y);
  if (getUnitAtWorldPoint(world.x, world.y) || getInspectableAtWorldPoint(world.x, world.y)) return;
  const clickedBuilding = typeof use3DRenderer === 'function' && use3DRenderer()
    ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)
    : (typeof getBuildingAtScreenPoint === 'function'
        ? getBuildingAtScreenPoint(mouse.x, mouse.y)
        : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null));

  if (!clickedBuilding) return;

  const selectedUnits = units.filter(u => u.selected && !u.isDead);
  const selectedTeam = selectedUnits.length > 0 ? selectedUnits[0].team : null;

  if (selectedUnits.length > 0 && selectedTeam && clickedBuilding.team !== selectedTeam) {
    addCommandClickMarker(clickedBuilding.x, clickedBuilding.y, 'red');
    selectedUnits.forEach(u => {
      if (u.team === selectedTeam) {
        u.issueAttackCommand(clickedBuilding, { append: e.shiftKey });
      }
    });
    return;
  }

  units.forEach(u => u.selected = false);
  if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
  if (typeof selectBuilding === 'function') selectBuilding(clickedBuilding);
});

canvas.addEventListener('dblclick', (e) => {
  e.preventDefault();
  suppressNextClick = true;

  const mouse = getMousePos(e);
  const world = screenToWorld(mouse.x, mouse.y);
  const clickedUnit = getUnitAtWorldPoint(world.x, world.y);
  if (!clickedUnit) return;

  selectVisibleFactionUnits(clickedUnit.team);
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
  const clickedSheep = typeof getSheepAtPoint === 'function'
    ? getSheepAtPoint(world.x, world.y)
    : null;
  const clickedBuilding = typeof use3DRenderer === 'function' && use3DRenderer()
    ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)
    : (typeof getBuildingAtScreenPoint === 'function'
        ? getBuildingAtScreenPoint(mouse.x, mouse.y)
        : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null));

  const selectedUnits = units.filter(unit => unit.selected && !unit.isDead);
  if (selectedUnits.length === 0) return;
  const selectedTeam = getFirstAliveSelectedTeam();
  if (!selectedTeam) return;
  const controllableUnits = selectedUnits.filter(u => u.team === selectedTeam);

  if (clickedSheep) {
    const rider = controllableUnits.find(unit => !unit.mountType && !unit.mountTarget);
    if (rider && typeof rider.issueMountCommand === 'function') {
      addCommandClickMarker(clickedSheep.x, clickedSheep.y, 'green');
      rider.issueMountCommand(clickedSheep, { append: e.shiftKey });
    }
    return;
  }

  // Right-click enemy = attack command (locked target until dead)
  if (clickedUnit && clickedUnit.team !== selectedTeam) {
    addCommandClickMarker(world.x, world.y, 'red');
    controllableUnits.forEach(unit => {
      unit.issueAttackCommand(clickedUnit, { append: e.shiftKey });
    });
    return;
  }

  if (clickedBuilding && clickedBuilding.team !== selectedTeam) {
    addCommandClickMarker(clickedBuilding.x, clickedBuilding.y, 'red');
    controllableUnits.forEach(unit => {
      unit.issueAttackCommand(clickedBuilding, { append: e.shiftKey });
    });
    return;
  }

  if (
    clickedBuilding &&
    clickedBuilding.team === selectedTeam &&
    clickedBuilding.type === 'home' &&
    !(typeof isCastleCourtyardPoint === 'function' && isCastleCourtyardPoint(clickedBuilding, world.x, world.y))
  ) {
    let stationed = 0;
    controllableUnits.forEach((unit, index) => {
      if (typeof commandUnitToCastleTop === 'function' && commandUnitToCastleTop(
        unit,
        clickedBuilding,
        index,
        controllableUnits.length,
        e.shiftKey,
        world.x,
        world.y
      )) {
        stationed++;
      }
    });
    if (stationed > 0) {
      addCommandClickMarker(clickedBuilding.x, clickedBuilding.y, 'green');
    }
    return;
  }

  if (
    clickedBuilding &&
    clickedBuilding.team === selectedTeam &&
    clickedBuilding.type === 'home' &&
    typeof isCastleCourtyardPoint === 'function' &&
    isCastleCourtyardPoint(clickedBuilding, world.x, world.y)
  ) {
    let routed = 0;
    controllableUnits.forEach((unit, index) => {
      const offset = getFormationOffset(index, controllableUnits.length, 24);
      const destination = findNearestWalkablePoint(world.x + offset.x, world.y + offset.y, unit.size);
      if (
        destination &&
        typeof commandUnitIntoCastle === 'function' &&
        commandUnitIntoCastle(unit, clickedBuilding, destination, e.shiftKey)
      ) {
        routed++;
      }
    });
    if (routed > 0) addCommandClickMarker(world.x, world.y, 'green');
    return;
  }

  // Otherwise right-click ground/friendly = move command
  const baseDestination = findNearestWalkablePoint(world.x, world.y, controllableUnits[0] ? controllableUnits[0].size : 20);
  if (!baseDestination) return;

  controllableUnits.forEach((unit, index) => {
    const offset = getFormationOffset(index, controllableUnits.length);
    const targetX = clamp(baseDestination.x + offset.x, unit.size * 0.5, getMapWidthPx() - unit.size * 0.5);
    const targetY = clamp(baseDestination.y + offset.y, unit.size * 0.5, getMapHeightPx() - unit.size * 0.5);
    const destination = findNearestWalkablePoint(targetX, targetY, unit.size);

    if (destination) {
      const occupiedCastle = typeof getCastleContainingPoint === 'function'
        ? getCastleContainingPoint(unit.x, unit.y)
        : null;
      if (
        occupiedCastle &&
        typeof isPointInsideCastle === 'function' &&
        !isPointInsideCastle(occupiedCastle, destination.x, destination.y) &&
        typeof commandUnitOutOfCastle === 'function' &&
        commandUnitOutOfCastle(unit, occupiedCastle, destination, e.shiftKey)
      ) {
        return;
      }
      if (typeof clearCastleTopCommand === 'function' && !e.shiftKey) {
        clearCastleTopCommand(unit);
      }
      unit.issueMoveCommand(destination.x, destination.y, { append: e.shiftKey });
    }
  });

  addCommandClickMarker(baseDestination.x, baseDestination.y, 'green');
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
    if (typeof zoomToFullMap === 'function') {
      zoomToFullMap();
    } else {
      const mouseX = inputState.mouseInside ? inputState.mouseX : canvas.width * 0.5;
      const mouseY = inputState.mouseInside ? inputState.mouseY : canvas.height * 0.5;
      zoomAtScreenPoint(mouseX, mouseY, 1 / camera.zoom);
    }
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
