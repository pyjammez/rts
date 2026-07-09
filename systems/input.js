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
  mouseInside: false,
  southEdgeActive: false
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

function getWheelPixelMultiplier(event) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return Math.max(1, camera.viewportHeight);
  return 1;
}

function handleCameraGesture(event, screenX, screenY) {
  const multiplier = getWheelPixelMultiplier(event);
  const deltaY = event.deltaY * multiplier;
  const zoomFactor = clamp(Math.exp(-deltaY * 0.0028), 0.82, 1.22);
  zoomAtScreenPoint(screenX, screenY, zoomFactor);
}

window.handleCameraGesture = handleCameraGesture;

function getFirstAliveSelectedTeam() {
  const registrySelected = OpenRTS.entities?.query?.selectedUnits?.();
  const firstSelected = registrySelected?.[0] || units.find(u => u.selected && !u.isDead);
  return firstSelected ? firstSelected.team : null;
}

function getUnitAtWorldPoint(worldX, worldY) {
  const picked = OpenRTS.entities?.picker?.pickAtPoint?.(worldX, worldY, {
    category: 'unit'
  });
  if (picked?.source) return picked.source;

  let clickedUnit = null;

  for (const unit of units) {
    if (unit.isDead || unit.hiddenInHouse) continue;
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
  const picked = OpenRTS.entities?.picker?.pickAtPoint?.(worldX, worldY, {
    category: ['wildlife', 'resource', 'house', 'item', 'obstacle']
  });
  if (picked?.source) return picked.source;

  return (typeof getSheepAtPoint === 'function' && getSheepAtPoint(worldX, worldY)) ||
    (typeof getDuckAtPoint === 'function' && getDuckAtPoint(worldX, worldY)) ||
    (typeof getHorseAtPoint === 'function' && getHorseAtPoint(worldX, worldY)) ||
    (typeof getGoldMineAtPoint === 'function' && getGoldMineAtPoint(worldX, worldY)) ||
    (typeof getHouseAtPoint === 'function' && getHouseAtPoint(worldX, worldY)) ||
    (typeof getWorldItemAtPoint === 'function' && getWorldItemAtPoint(worldX, worldY)) ||
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

  const visibleUnits = OpenRTS.entities?.query?.aliveUnits
    ? OpenRTS.entities.query.aliveUnits({ team }).filter(isUnitVisibleOnScreen)
    : units.filter(unit => !unit.isDead && unit.team === team && isUnitVisibleOnScreen(unit));
  const visibleIds = new Set(visibleUnits.map(unit => unit.id));
  units.forEach(unit => {
    unit.selected = visibleIds.has(unit.id);
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

canvas.addEventListener('mouseleave', event => {
  if (event.relatedTarget?.closest?.('#bottomEdgeScrollZone, #gameBottomEdgeScrollZone')) return;
  inputState.mouseInside = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const mouse = getMousePos(e);
  inputState.mouseX = mouse.x;
  inputState.mouseY = mouse.y;

  handleCameraGesture(e, mouse.x, mouse.y);
}, { passive: false });

canvas.addEventListener('mouseup', (e) => {
  selectionEnd = getMousePos(e);
  inputState.mouseX = selectionEnd.x;
  inputState.mouseY = selectionEnd.y;
  inputState.mouseInside = true;

  if (
    e.button === 0 &&
    typeof getItemActionTargetMode === 'function' &&
    getItemActionTargetMode() &&
    typeof handleItemActionTarget === 'function'
  ) {
    const targetWorld = screenToWorld(selectionEnd.x, selectionEnd.y);
    if (handleItemActionTarget(targetWorld.x, targetWorld.y)) {
      selectionStart = null;
      selectionEnd = null;
      isSelecting = false;
      suppressNextClick = true;
      return;
    }
  }

  if (e.button === 0) { 
    if (isSelecting) {
        // box selection
      const startWorld = screenToWorld(selectionStart.x, selectionStart.y);
      const endWorld = screenToWorld(selectionEnd.x, selectionEnd.y);
      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

        const selectedInBox = OpenRTS.entities?.query?.entitiesInBox
          ? OpenRTS.entities.query.entitiesInBox({ minX, maxX, minY, maxY }, {
              category: 'unit',
              lifecycle: 'alive',
              predicate: entity => !entity.source?.hiddenInHouse
            }).map(entity => entity.source)
          : units.filter(u =>
            !u.isDead && !u.hiddenInHouse &&
            u.x >= minX && u.x <= maxX &&
            u.y >= minY && u.y <= maxY
          );
        const selectedTeam = selectedInBox.length > 0 ? selectedInBox[0].team : null;

        // Enforce single-faction control group selection.
        units.forEach(u => {
          u.selected = !!selectedTeam && !u.isDead && !u.hiddenInHouse && u.team === selectedTeam &&
            u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
        });
        if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
        if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
        suppressNextClick = true;
    } else {
        // single click selection
      const { x, y } = screenToWorld(selectionEnd.x, selectionEnd.y);
        const picked = OpenRTS.entities?.picker?.pickAllAtPoint?.(x, y) || {};
        let clickedUnit = picked.unit?.source || null;
        const clickedSheep = picked.sheep?.source || (typeof getSheepAtPoint === 'function' ? getSheepAtPoint(x, y) : null);
        const clickedDuck = picked.duck?.source || (typeof getDuckAtPoint === 'function' ? getDuckAtPoint(x, y) : null);
        const clickedHorse = picked.horse?.source || (typeof getHorseAtPoint === 'function' ? getHorseAtPoint(x, y) : null);
        const clickedGoldMine = picked.goldMine?.source || (typeof getGoldMineAtPoint === 'function' ? getGoldMineAtPoint(x, y) : null);
        const clickedHouse = picked.house?.source || (typeof getHouseAtPoint === 'function' ? getHouseAtPoint(x, y) : null);
        const clickedItem = picked.item?.source || (typeof getWorldItemAtPoint === 'function' ? getWorldItemAtPoint(x, y) : null);
        const clickedObstacle = picked.obstacle?.source || (typeof getObstacleAtPoint === 'function' ? getObstacleAtPoint(x, y) : null);
        const clickedBuilding = picked.building?.source || (typeof use3DRenderer === 'function' && use3DRenderer()
          ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(x, y) : null)
          : (typeof getBuildingAtScreenPoint === 'function'
              ? getBuildingAtScreenPoint(selectionEnd.x, selectionEnd.y)
              : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(x, y) : null)));

        const selectedUnits = units.filter(u => u.selected && !u.isDead);
        const selectedTeam = selectedUnits.length > 0 ? selectedUnits[0].team : null;

        // is a unit within the spot I clicked?
        // this checks below and right of the pointer.
        // it also breaks out of the loop when it finds it to avoid unecessary comparisons
        for (const u of clickedUnit ? [] : units) {
            if (u.isDead || u.hiddenInHouse) continue;
            if (x >= u.x - u.size/2 && x <= u.x + u.size/2 && y >= u.y - u.size/2 && y <= u.y + u.size/2) {
                clickedUnit = u;
                break;
            }
        }

        const clickedInspectable = clickedSheep || clickedDuck || clickedHorse || clickedGoldMine || clickedHouse || clickedItem || clickedObstacle;
        if (clickedUnit) {
            // if we did land on a unit deselect all then select one
            units.forEach(u => u.selected = false);
            if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
            if (typeof clearWorldObjectSelection === 'function') clearWorldObjectSelection();
            clickedUnit.selected = true;
        } else if (clickedInspectable) {
            selectInspectableObject(clickedInspectable);
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
  const picked = OpenRTS.entities?.picker?.pickAllAtPoint?.(world.x, world.y) || {};
  if (picked.unit?.source || picked.wildlife?.source || picked.resource?.source || picked.house?.source || picked.item?.source || picked.obstacle?.source || getUnitAtWorldPoint(world.x, world.y) || getInspectableAtWorldPoint(world.x, world.y)) return;
  const clickedBuilding = picked.building?.source || (typeof use3DRenderer === 'function' && use3DRenderer()
    ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)
    : (typeof getBuildingAtScreenPoint === 'function'
        ? getBuildingAtScreenPoint(mouse.x, mouse.y)
        : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)));

  if (!clickedBuilding) return;

  const selectedUnits = units.filter(u => u.selected && !u.isDead);
  const selectedTeam = selectedUnits.length > 0 ? selectedUnits[0].team : null;

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
  const picked = OpenRTS.entities?.picker?.pickAllAtPoint?.(world.x, world.y) || {};
  let clickedUnit = picked.unit?.source || null;
  for (const u of clickedUnit ? [] : units) {
    if (u.isDead || u.hiddenInHouse) continue;
    if (world.x >= u.x - u.size / 2 && world.x <= u.x + u.size / 2 && world.y >= u.y - u.size / 2 && world.y <= u.y + u.size / 2) {
      clickedUnit = u;
      break;
    }
  }
  const clickedSheep = picked.sheep?.source || (typeof getSheepAtPoint === 'function'
    ? getSheepAtPoint(world.x, world.y)
    : null);
  const clickedDuck = picked.duck?.source || (typeof getDuckAtPoint === 'function'
    ? getDuckAtPoint(world.x, world.y)
    : null);
  const clickedBuilding = picked.building?.source || (typeof use3DRenderer === 'function' && use3DRenderer()
    ? (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)
    : (typeof getBuildingAtScreenPoint === 'function'
        ? getBuildingAtScreenPoint(mouse.x, mouse.y)
        : (typeof getBuildingAtPoint === 'function' ? getBuildingAtPoint(world.x, world.y) : null)));
  const clickedHouse = picked.house?.source || (typeof getHouseAtPoint === 'function'
    ? getHouseAtPoint(world.x, world.y)
    : null);

  const selectedUnits = units.filter(unit => unit.selected && !unit.isDead);
  if (selectedUnits.length === 0) {
    const selectedBuilding = typeof getSelectedBuilding === 'function' ? getSelectedBuilding() : null;
    if (
      selectedBuilding &&
      !selectedBuilding.isDead &&
      OpenRTS.systems.buildingMobility?.canLift?.(selectedBuilding) &&
      OpenRTS.systems.buildingMobility?.isFlying?.(selectedBuilding)
    ) {
      OpenRTS.commands.enqueue({
        type: OpenRTS.commands.types.BUILDING_RELOCATE,
        payload: { buildingId: selectedBuilding.id, x: world.x, y: world.y }
      });
      addCommandClickMarker(world.x, world.y, 'green');
      return;
    }

    const selectedHouse = typeof getSelectedWorldObject === 'function' ? getSelectedWorldObject() : null;
    if (selectedHouse?.objectType === 'house' && Array.isArray(selectedHouse.occupants) && selectedHouse.occupants.length > 0) {
      selectedHouse.occupants.forEach((unitId, index) => {
        const offset = OpenRTS.commandIntents.unit.getFormationOffset(index, selectedHouse.occupants.length);
        OpenRTS.commandIntents.unit.enqueue(OpenRTS.commands.types.HOUSE_EXIT, {
          unitId,
          x: world.x + offset.x,
          y: world.y + offset.y,
          append: false
        });
      });
      addCommandClickMarker(world.x, world.y, 'green');
    }
    return;
  }
  const selectedTeam = getFirstAliveSelectedTeam();
  if (!selectedTeam) return;
  const controllableUnits = selectedUnits.filter(u => u.team === selectedTeam);

  if (clickedSheep) {
    const rider = controllableUnits.find(unit => !unit.mountType && !unit.mountTarget);
    if (rider) {
      addCommandClickMarker(clickedSheep.x, clickedSheep.y, 'green');
      OpenRTS.commandIntents.unit.enqueueMount(rider, clickedSheep, e.shiftKey);
    }
    return;
  }

  if (clickedDuck) {
    addCommandClickMarker(clickedDuck.x, clickedDuck.y, 'red');
    OpenRTS.commandIntents.unit.enqueueAttackGroup(controllableUnits, clickedDuck, 'duck', e.shiftKey);
    return;
  }

  if (clickedHouse && !clickedHouse.isWreck) {
    let routed = 0;
    controllableUnits.forEach(unit => {
      OpenRTS.commandIntents.unit.enqueue(OpenRTS.commands.types.HOUSE_ENTER, {
        unitId: unit.id,
        houseId: clickedHouse.id,
        append: e.shiftKey
      });
      routed++;
    });
    if (routed > 0) addCommandClickMarker(clickedHouse.x, clickedHouse.y, 'green');
    return;
  }

  // Right-click enemy = attack command (locked target until dead)
  if (clickedUnit && clickedUnit.team !== selectedTeam) {
    addCommandClickMarker(world.x, world.y, 'red');
    OpenRTS.commandIntents.unit.enqueueAttackGroup(controllableUnits, clickedUnit, 'unit', e.shiftKey);
    return;
  }

  if (clickedBuilding && clickedBuilding.team !== selectedTeam) {
    addCommandClickMarker(clickedBuilding.x, clickedBuilding.y, 'red');
    OpenRTS.commandIntents.unit.enqueueAttackGroup(controllableUnits, clickedBuilding, 'building', e.shiftKey);
    return;
  }

  // Otherwise right-click ground/friendly = move command
  const moveResult = OpenRTS.commandIntents.unit.enqueueMoveGroupToWorld(controllableUnits, world, e.shiftKey);
  if (moveResult.marker) addCommandClickMarker(moveResult.marker.x, moveResult.marker.y, moveResult.marker.color);
});

window.addEventListener('keydown', (e) => {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  const isTyping = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;
  if (e.key === 'Escape' && typeof cancelItemActionTargeting === 'function') {
    cancelItemActionTargeting();
  }
  if (!isTyping && e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey && !e.altKey && typeof toggleItemActionTargeting === 'function') {
    const selectedUnits = units.filter(unit => unit.selected && !unit.isDead);
    if (selectedUnits.length > 0) {
      e.preventDefault();
      toggleItemActionTargeting('attack-move');
      return;
    }
  }
  if (e.key === 'w' || e.key === 'ArrowUp') inputState.up = true;
  if (e.key === 's' || e.key === 'ArrowDown') inputState.down = true;
  if (e.key === 'ArrowLeft') inputState.left = true;
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
