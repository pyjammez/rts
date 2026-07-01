(function registerRenderOptimizationServices(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function distance2D(a = {}, b = {}) {
    const dx = Number(a.x || 0) - Number(b.x || 0);
    const dz = Number(a.z ?? a.y ?? 0) - Number(b.z ?? b.y ?? 0);
    return Math.hypot(dx, dz);
  }

  function chooseLod(model = {}, distance = 0) {
    const lods = Array.isArray(model.lods)
      ? [...model.lods].sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0))
      : [];
    let selected = { level: 0, source: model.url || model.factory || model.fallback || model.id || null, distance: 0, model };
    for (let index = 0; index < lods.length; index++) {
      const lod = lods[index];
      if (distance >= Number(lod.distance || 0)) {
        selected = {
          level: index + 1,
          source: lod.url || lod.factory || lod.fallback || selected.source,
          distance: Number(lod.distance || 0),
          model: lod
        };
      }
    }
    return selected;
  }

  function chooseQualityTier(metric = {}, tiers = []) {
    const ordered = (tiers.length ? tiers : [
      { id: 'ultra', maxDrawCalls: 900, maxTriangles: 650000, maxFrameMs: 16.7, shadowScale: 1, terrainSubdivisions: 8 },
      { id: 'high', maxDrawCalls: 650, maxTriangles: 450000, maxFrameMs: 22, shadowScale: 0.75, terrainSubdivisions: 6 },
      { id: 'medium', maxDrawCalls: 420, maxTriangles: 260000, maxFrameMs: 28, shadowScale: 0.5, terrainSubdivisions: 4 },
      { id: 'low', maxDrawCalls: Infinity, maxTriangles: Infinity, maxFrameMs: Infinity, shadowScale: 0.25, terrainSubdivisions: 2 }
    ]).map(tier => ({ ...tier }));
    const drawCalls = Number(metric.drawCalls || 0);
    const triangles = Number(metric.triangles || 0);
    const frameMs = Number(metric.frameMs || 0);
    return ordered.find(tier =>
      drawCalls <= Number(tier.maxDrawCalls) &&
      triangles <= Number(tier.maxTriangles) &&
      frameMs <= Number(tier.maxFrameMs)
    ) || ordered[ordered.length - 1];
  }

  function createFrameBudget(options = {}) {
    const targetFps = Math.max(1, Number(options.targetFps || 60));
    const targetFrameMs = Number(options.targetFrameMs || (1000 / targetFps));
    const budgets = Object.freeze({
      frameMs: targetFrameMs,
      drawCalls: Number(options.drawCalls || 600),
      triangles: Number(options.triangles || 400000),
      dynamicPool: Number(options.dynamicPool || 2000),
      culledRatioWarning: Number(options.culledRatioWarning || 0.65)
    });
    function evaluate(metrics = {}) {
      const values = {
        frameMs: Number(metrics.frameMs || 0),
        drawCalls: Number(metrics.drawCalls || 0),
        triangles: Number(metrics.triangles || 0),
        dynamicPool: Number(metrics.dynamicPool || 0),
        culledRatio: Number(metrics.culledRatio || 0)
      };
      const warnings = [];
      if (values.frameMs > budgets.frameMs) warnings.push('frame_time');
      if (values.drawCalls > budgets.drawCalls) warnings.push('draw_calls');
      if (values.triangles > budgets.triangles) warnings.push('triangles');
      if (values.dynamicPool > budgets.dynamicPool) warnings.push('dynamic_pool');
      if (values.culledRatio > budgets.culledRatioWarning) warnings.push('culling_pressure');
      return {
        schemaVersion: 1,
        ok: warnings.length === 0,
        warnings,
        budgets,
        metrics: values,
        quality: chooseQualityTier({
          drawCalls: values.drawCalls,
          triangles: values.triangles,
          frameMs: values.frameMs
        })
      };
    }
    return Object.freeze({
      budgets,
      evaluate,
      describe: () => ({ schemaVersion: 1, targetFps, budgets })
    });
  }

  function createShadowPolicy(options = {}) {
    const maxCasterDistance = Number(options.maxCasterDistance || 38);
    const minCasterSize = Number(options.minCasterSize || 0.12);
    const alwaysCastCategories = new Set(options.alwaysCastCategories || ['unit', 'building']);
    const neverCastCategories = new Set(options.neverCastCategories || ['projectile', 'impact', 'selection']);
    return Object.freeze({
      shouldCast({ category = '', size = 1, distance = 0, important = false } = {}) {
        if (important) return true;
        if (neverCastCategories.has(category)) return false;
        if (!category) return false;
        if (Number(size) < minCasterSize) return false;
        return alwaysCastCategories.has(category) || Number(distance) <= maxCasterDistance;
      },
      shouldReceive({ category = '' } = {}) {
        return category !== 'projectile' && category !== 'impact' && category !== 'selection';
      },
      describe() {
        return {
          schemaVersion: 1,
          maxCasterDistance,
          minCasterSize,
          alwaysCastCategories: [...alwaysCastCategories].sort(),
          neverCastCategories: [...neverCastCategories].sort()
        };
      }
    });
  }

  function createStaticChunkPlanner({ tileSize = 32, chunkTiles = 12 } = {}) {
    const chunkSize = Math.max(1, Math.floor(Number(chunkTiles) || 12));
    function chunkIdForTile(tileX, tileY) {
      return `${Math.floor(tileX / chunkSize)}:${Math.floor(tileY / chunkSize)}`;
    }
    function collectChunks({ rows = 0, columns = 0, signatureForTile = null } = {}) {
      const chunks = new Map();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const id = chunkIdForTile(x, y);
          if (!chunks.has(id)) {
            const chunkX = Math.floor(x / chunkSize);
            const chunkY = Math.floor(y / chunkSize);
            chunks.set(id, {
              id,
              chunkX,
              chunkY,
              tileMinX: chunkX * chunkSize,
              tileMinY: chunkY * chunkSize,
              tileMaxX: Math.min(columns - 1, (chunkX + 1) * chunkSize - 1),
              tileMaxY: Math.min(rows - 1, (chunkY + 1) * chunkSize - 1),
              signatures: []
            });
          }
          chunks.get(id).signatures.push(typeof signatureForTile === 'function' ? String(signatureForTile(x, y)) : `${x},${y}`);
        }
      }
      return [...chunks.values()].map(chunk => ({
        ...chunk,
        worldMinX: chunk.tileMinX * tileSize,
        worldMinY: chunk.tileMinY * tileSize,
        worldMaxX: (chunk.tileMaxX + 1) * tileSize,
        worldMaxY: (chunk.tileMaxY + 1) * tileSize,
        signature: chunk.signatures.join('|')
      }));
    }
    function visibleChunks(chunks, camera = {}, overscan = 128) {
      const left = Number(camera.x || 0) - overscan;
      const top = Number(camera.y || 0) - overscan;
      const right = left + Number(camera.viewportWidth || 0) / Math.max(0.01, Number(camera.zoom || 1)) + overscan * 2;
      const bottom = top + Number(camera.viewportHeight || 0) / Math.max(0.01, Number(camera.zoom || 1)) + overscan * 2;
      return (chunks || []).filter(chunk => chunk.worldMaxX >= left && chunk.worldMinX <= right && chunk.worldMaxY >= top && chunk.worldMinY <= bottom);
    }
    function diffChunks(previous = [], next = []) {
      const previousById = new Map((previous || []).map(chunk => [chunk.id, chunk]));
      const nextById = new Map((next || []).map(chunk => [chunk.id, chunk]));
      const added = [];
      const removed = [];
      const changed = [];
      const unchanged = [];
      for (const [id, chunk] of nextById) {
        const before = previousById.get(id);
        if (!before) added.push(chunk);
        else if (before.signature !== chunk.signature) changed.push(chunk);
        else unchanged.push(chunk);
      }
      for (const [id, chunk] of previousById) {
        if (!nextById.has(id)) removed.push(chunk);
      }
      return {
        schemaVersion: 1,
        added,
        removed,
        changed,
        unchanged,
        dirty: [...added, ...changed],
        summary: {
          added: added.length,
          removed: removed.length,
          changed: changed.length,
          unchanged: unchanged.length,
          dirty: added.length + changed.length
        }
      };
    }
    return Object.freeze({ chunkSize, chunkIdForTile, collectChunks, visibleChunks, diffChunks });
  }

  function planInstancedBatches(items = [], { idFor = item => item.model || item.type || item.unitType || 'default' } = {}) {
    const batches = new Map();
    for (const item of items || []) {
      const id = String(idFor(item));
      if (!batches.has(id)) batches.set(id, []);
      batches.get(id).push(item);
    }
    return [...batches.entries()]
      .map(([id, batchItems]) => ({ id, count: batchItems.length, items: batchItems }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }

  function summarizeInstancingPlan(items = [], options = {}) {
    const minBatchSize = Math.max(2, Number(options.minBatchSize || 3));
    const batches = planInstancedBatches(items, options);
    const instanced = batches.filter(batch => batch.count >= minBatchSize);
    const fallback = batches.filter(batch => batch.count < minBatchSize);
    return {
      schemaVersion: 1,
      totalItems: (items || []).length,
      batchCount: batches.length,
      instancedCount: instanced.reduce((sum, batch) => sum + batch.count, 0),
      fallbackCount: fallback.reduce((sum, batch) => sum + batch.count, 0),
      instanced,
      fallback
    };
  }

  function planLodForItems(items = [], options = {}) {
    const camera = options.camera || {};
    const modelFor = typeof options.modelFor === 'function' ? options.modelFor : item => item.model || item.asset || {};
    const positionFor = typeof options.positionFor === 'function' ? options.positionFor : item => item;
    return (items || []).map(item => {
      const position = positionFor(item) || {};
      const distance = distance2D(position, camera);
      return {
        item,
        distance,
        lod: chooseLod(modelFor(item), distance)
      };
    });
  }

  function createWorldViewCuller({ camera = {}, viewportWidth = 0, viewportHeight = 0, overscan = 256, maxDistance = 0 } = {}) {
    const zoom = Math.max(0.01, Number(camera.zoom || 1));
    const width = Number(camera.viewportWidth || viewportWidth || 0) / zoom;
    const height = Number(camera.viewportHeight || viewportHeight || 0) / zoom;
    const left = Number(camera.x || 0) - Number(overscan || 0);
    const top = Number(camera.y || 0) - Number(overscan || 0);
    const right = left + width + Number(overscan || 0) * 2;
    const bottom = top + height + Number(overscan || 0) * 2;
    const center = { x: (left + right) * 0.5, y: (top + bottom) * 0.5 };
    const distanceLimit = Number(maxDistance || 0);

    function isVisible(source = {}, radius = null) {
      if (source.alwaysRender || source.selected) return true;
      const x = Number(source.x);
      const y = Number(source.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
      const bounds = Number(radius ?? source.renderRadius ?? source.radius ?? source.size ?? 0);
      if (distanceLimit > 0 && distance2D({ x, y }, center) > distanceLimit + bounds) return false;
      return x + bounds >= left && x - bounds <= right && y + bounds >= top && y - bounds <= bottom;
    }

    return Object.freeze({
      bounds: Object.freeze({ left, top, right, bottom, width, height, overscan: Number(overscan || 0) }),
      isVisible,
      filter(items = [], radius = null) {
        return (items || []).filter(item => isVisible(item, radius));
      },
      describe() {
        return {
          schemaVersion: 1,
          bounds: { left, top, right, bottom, width, height },
          maxDistance: distanceLimit
        };
      }
    });
  }

  function summarizeViewport({ culler = null, visibleChunks = [], dynamicCounts = {}, staticCounts = {} } = {}) {
    return {
      schemaVersion: 1,
      bounds: culler?.bounds ? { ...culler.bounds } : null,
      visibleChunks: (visibleChunks || []).length,
      dynamic: {
        rendered: Object.entries(dynamicCounts || {})
          .filter(([key]) => !['created', 'reused', 'removed', 'culled'].includes(key) && !key.endsWith('Culled'))
          .reduce((sum, [, value]) => sum + Number(value || 0), 0),
        culled: Number(dynamicCounts?.culled || 0),
        created: Number(dynamicCounts?.created || 0),
        reused: Number(dynamicCounts?.reused || 0),
        removed: Number(dynamicCounts?.removed || 0)
      },
      static: { ...(staticCounts || {}) }
    };
  }

  function createRenderHealthReport({ performance = null, frameBudget = createFrameBudget() } = {}) {
    const report = performance?.describe ? performance.describe() : performance || {};
    const gauges = report.gauges || {};
    const timings = report.timings || {};
    const frameTiming = timings['render.three.frame'] || {};
    const dynamicRendered = Number(gauges['render.dynamic.poolSize'] || 0);
    const dynamicCulled = Number(gauges['render.dynamic.lastCulled'] || 0);
    const evaluation = frameBudget.evaluate({
      frameMs: Number(frameTiming.average || frameTiming.max || 0),
      drawCalls: Number(gauges['render.three.drawCalls'] || 0),
      triangles: Number(gauges['render.three.triangles'] || 0),
      dynamicPool: dynamicRendered,
      culledRatio: dynamicRendered + dynamicCulled > 0 ? dynamicCulled / (dynamicRendered + dynamicCulled) : 0
    });
    return {
      schemaVersion: 1,
      ok: evaluation.ok,
      warnings: evaluation.warnings,
      quality: evaluation.quality,
      budgets: evaluation.budgets,
      metrics: evaluation.metrics
    };
  }

  app.rendering.optimization = Object.freeze({
    distance2D,
    chooseLod,
    chooseQualityTier,
    createFrameBudget,
    createShadowPolicy,
    createStaticChunkPlanner,
    planInstancedBatches,
    summarizeInstancingPlan,
    planLodForItems,
    createWorldViewCuller,
    summarizeViewport,
    createRenderHealthReport
  });
})(globalThis);
