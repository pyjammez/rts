let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left-click
    isSelecting = false;
    selectionStart = getMousePos(e);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (selectionStart) {
    selectionEnd = getMousePos(e);
    if (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5) {
      isSelecting = true;
    }
  }
});

canvas.addEventListener('mouseup', (e) => {
  selectionEnd = getMousePos(e);

  if (e.button === 0) { 
    if (isSelecting) {
        // box selection
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);

        // are they within our selection box
        units.forEach(u => {
            u.selected = (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY);
        });
    } else {
        // single click selection
        const { x, y } = selectionEnd;
        let clickedUnit = null;

        // is a unit within the spot I clicked?
        // this checks below and right of the pointer.
        // it also breaks out of the loop when it finds it to avoid unecessary comparisons
        for (const u of units) {
            if (x >= u.x - u.size/2 && x <= u.x + u.size/2 && y >= u.y - u.size/2 && y <= u.y + u.size/2) {
                clickedUnit = u;
                break;
            }
        }

        if (clickedUnit) {
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
  units.forEach(unit => {
    if (unit.selected) {
      unit.target = { x: e.clientX, y: e.clientY };
      unit.setDestination(unit.target.x, unit.target.y);
    }
  });
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