(function registerSpatialHashGrid(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  function createSpatialHashGrid({ cellSize = 128 } = {}) {
    const resolvedCellSize = Math.max(1, Number(cellSize) || 128);
    const cells = new Map();
    const records = new Map();

    function keyForCell(cellX, cellY) {
      return `${cellX},${cellY}`;
    }

    function cellForPoint(x, y) {
      return {
        x: Math.floor((Number(x) || 0) / resolvedCellSize),
        y: Math.floor((Number(y) || 0) / resolvedCellSize)
      };
    }

    function boundsFor(record) {
      const radius = Math.max(0, Number(record.radius || record.size || 0) * 0.5);
      const min = cellForPoint(record.x - radius, record.y - radius);
      const max = cellForPoint(record.x + radius, record.y + radius);
      return { min, max };
    }

    function insert(record) {
      if (!record || record.id == null) throw new Error('Spatial records need a stable id');
      remove(record.id);
      const normalized = { ...record };
      const bounds = boundsFor(normalized);
      const keys = [];
      for (let y = bounds.min.y; y <= bounds.max.y; y++) {
        for (let x = bounds.min.x; x <= bounds.max.x; x++) {
          const key = keyForCell(x, y);
          if (!cells.has(key)) cells.set(key, new Set());
          cells.get(key).add(normalized.id);
          keys.push(key);
        }
      }
      records.set(normalized.id, { record: normalized, keys });
      return normalized;
    }

    function remove(id) {
      const entry = records.get(id);
      if (!entry) return false;
      for (const key of entry.keys) {
        const cell = cells.get(key);
        if (!cell) continue;
        cell.delete(id);
        if (cell.size === 0) cells.delete(key);
      }
      records.delete(id);
      return true;
    }

    function clear() {
      cells.clear();
      records.clear();
    }

    function rebuild(items = [], mapper = value => value) {
      clear();
      for (const item of items || []) insert(mapper(item));
      return records.size;
    }

    function queryAabb({ minX, minY, maxX, maxY, predicate } = {}) {
      const min = cellForPoint(minX, minY);
      const max = cellForPoint(maxX, maxY);
      const seen = new Set();
      const result = [];
      for (let y = min.y; y <= max.y; y++) {
        for (let x = min.x; x <= max.x; x++) {
          const cell = cells.get(keyForCell(x, y));
          if (!cell) continue;
          for (const id of cell) {
            if (seen.has(id)) continue;
            seen.add(id);
            const record = records.get(id)?.record;
            if (!record) continue;
            const radius = Math.max(0, Number(record.radius || record.size || 0) * 0.5);
            if (record.x + radius < minX || record.x - radius > maxX || record.y + radius < minY || record.y - radius > maxY) continue;
            if (predicate && !predicate(record)) continue;
            result.push(record);
          }
        }
      }
      return result;
    }

    function queryRadius(x, y, radius, predicate) {
      const r = Math.max(0, Number(radius) || 0);
      const r2 = r * r;
      return queryAabb({
        minX: x - r,
        minY: y - r,
        maxX: x + r,
        maxY: y + r,
        predicate: record => {
          const recordRadius = Math.max(0, Number(record.radius || record.size || 0) * 0.5);
          const dx = record.x - x;
          const dy = record.y - y;
          return dx * dx + dy * dy <= (r + recordRadius) * (r + recordRadius) && (!predicate || predicate(record));
        }
      });
    }

    function describe() {
      return {
        schemaVersion: 1,
        cellSize: resolvedCellSize,
        cellCount: cells.size,
        recordCount: records.size
      };
    }

    return Object.freeze({
      insert,
      remove,
      clear,
      rebuild,
      queryAabb,
      queryRadius,
      describe
    });
  }

  app.world.spatial = Object.freeze({ createSpatialHashGrid });
})(globalThis);
