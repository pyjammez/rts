(function registerFormationPlanner(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.systems = app.systems || {};

  function createFormationSlots(units = [], destination = {}, {
    spacing = 34,
    columns = null,
    heading = 0
  } = {}) {
    const count = units.length;
    if (count === 0) return [];
    const resolvedColumns = Math.max(1, columns || Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / resolvedColumns);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    return units.map((unit, index) => {
      const col = index % resolvedColumns;
      const row = Math.floor(index / resolvedColumns);
      const localX = (col - (resolvedColumns - 1) * 0.5) * spacing;
      const localY = (row - (rows - 1) * 0.5) * spacing;
      return {
        unitId: unit.id,
        x: destination.x + localX * cos - localY * sin,
        y: destination.y + localX * sin + localY * cos,
        row,
        column: col
      };
    });
  }

  function assignNearestSlots(units = [], slots = []) {
    const remaining = [...slots];
    return units.map(unit => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const slot = remaining[i];
        const distance = Math.hypot((unit.x || 0) - slot.x, (unit.y || 0) - slot.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      const slot = remaining.splice(bestIndex, 1)[0] || null;
      return { unitId: unit.id, slot };
    });
  }

  app.systems.formationPlanner = Object.freeze({
    createFormationSlots,
    assignNearestSlots
  });
})(globalThis);
