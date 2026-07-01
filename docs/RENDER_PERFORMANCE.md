# Browser 3D Render Performance

Open RTS is designed to run as a static browser game, so the renderer must avoid unnecessary JavaScript allocation, Three.js object churn, and excessive draw/shadow work.

## Dynamic View Pool

`OpenRTS.rendering.dynamicWorldComposer.createDynamicPool()` keeps dynamic entity visuals alive across frames. Units, animals, items, projectiles, roasts, and impact effects are keyed by stable ids. A visual is recreated only when its visual key changes, such as selection, death, mount state, unit type, or castle-wall state.

This reduces:

- per-frame `new THREE.Group()`
- per-frame mesh construction
- garbage collection pressure
- repeated scene graph attachment work

## Render Optimization Services

`OpenRTS.rendering.optimization` exposes browser-safe planning helpers:

- `chooseLod(model, distance)` selects a LOD source from model metadata.
- `chooseQualityTier(metric, tiers)` maps render cost to a quality tier.
- `createFrameBudget(options)` evaluates frame time, draw calls, triangles, pool size, and culling pressure.
- `createShadowPolicy(options)` decides which meshes should cast/receive shadows.
- `createStaticChunkPlanner(options)` splits terrain/object maps into rebuildable chunks.
- `createWorldViewCuller(options)` filters dynamic objects against the camera's world-space view.
- `planInstancedBatches(items, options)` groups repeated renderables for future `THREE.InstancedMesh` use.
- `summarizeInstancingPlan(items, options)` separates instancing candidates from fallback renderables.
- `planLodForItems(items, options)` assigns LOD selections to many renderables from a camera position.
- `summarizeViewport(options)` creates a compact visible-world summary.
- `createRenderHealthReport(options)` turns diagnostics into budget warnings and a suggested quality tier.

## Dynamic Culling

Dynamic scene composition now receives a world-view culler from the renderer. Units, wildlife, items, projectiles, roasts, and impact effects outside the camera view plus overscan are skipped before model factories run. Pooled visuals that move offscreen are pruned from the scene instead of being kept alive invisibly.

## Static World Chunks

Terrain is emitted as chunk-tagged meshes. The renderer compares those chunk bounds to the camera view each frame and hides off-viewport chunk meshes. This keeps large maps from forcing the browser to submit every terrain section when the player is zoomed into one area.

Static chunk metadata is still used as the planning source for future dirty-chunk rebuilds after map-builder edits.

The static chunk planner can diff previous and current chunk signatures with `diffChunks(previous, next)`. That provides a dirty-chunk list for the later map-builder path where only edited chunks should be rebuilt.

## Static Instancing

`OpenRTS.rendering.staticInstanceBatcher` creates `THREE.InstancedMesh` batches for repeated static objects. Rock outcrop boulders now use one instanced batch instead of many individual mesh objects. This preserves the same deterministic boulder layout while reducing scene graph overhead and draw submissions.

## Diagnostics

`OpenRTS.diagnostics.performance` supports:

- counters, such as `render.dynamic.created`
- timings, such as `render.dynamic.compose` and `render.three.frame`
- gauges, such as `render.dynamic.poolSize`, `render.dynamic.lastCulled`, `render.static.chunkCount`, `render.static.visibleChunks`, `render.static.rockInstances`, `render.three.drawCalls`, and `render.three.triangles`

These diagnostics are intended to catch browser framerate regressions before visual features grow too large.

The renderer also sets health gauges:

- `render.health.ok`
- `render.health.warningCount`

These are derived from `createRenderHealthReport()` and are meant to drive a future debug overlay or automatic quality adjustment.

## Latest Infrastructure Batch

This pass added:

- render quality tier selection
- frame budget evaluation
- dirty static chunk diffing
- instancing plan summaries
- batch LOD planning
- viewport summaries
- render health reports
- health gauges in the live renderer
- tests for budget warnings
- tests for dirty chunks
- tests for instancing thresholds
- tests for LOD planning
- tests for viewport summaries
- tests for health reports
- dynamic culling compatibility with existing pooling
- reusable budget descriptions
- culling pressure warnings
- quality-tier reporting
- renderer-facing health integration
- documentation for the new contracts

## Next Render Performance Steps

The next most valuable work after this pass:

- use `THREE.InstancedMesh` for tree trunk/frond submeshes, projectiles, sheep, and repeated simple unit types
- rebuild only dirty static chunks after map-builder edits
- apply LOD selection to imported GLTF/GLB render factories
- limit shadow casting by camera distance and object importance
- add an in-game debug overlay for draw calls, pool size, and frame timings
