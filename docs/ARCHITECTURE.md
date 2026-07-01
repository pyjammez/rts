# Open RTS Architecture

Open RTS is a static-browser game. It intentionally requires no compiler or application server and can be deployed directly to S3. Architecture must therefore remain explicit in browser script order while keeping game rules independently testable.

## Active Runtime

`index.html` loads the live game in dependency order:

1. Three.js runtime and canvas bootstrap
2. `core/openRts.js` application namespace
3. Core event, deterministic-random, runtime, and renderer services
4. Game systems and rules
5. JSON definition registry and setup UI
6. Entities and frame processors
7. World state and renderers
8. Input and the fixed-step game loop

Only code reachable from `index.html` is considered part of the active runtime. The older files under `engine/ecs/`, `game/modes/`, `game/match/`, and `generators/` are prototypes used by examples and tests; new gameplay work should not depend on them until they are deliberately migrated.

## Ownership Boundaries

- `core/runtime/`: the active `GameRuntime`, frame context, services, and ordered system scheduler.
- `core/camera/`: camera movement, edge scrolling, zoom, clamping, fit-to-map, and screen/world projection policy.
- `core/rendering/`: renderer registration, priority, and fallback selection.
- `core/`: application namespace, fixed-step loop, camera, and runtime composition.
- `game/config/`: JSON loading, normalization, validation-facing definition lookup, and content catalog indexing.
- `game/modes/`: mode lifecycle contracts. A mode owns match creation, world spawn policy, updates, victory checks, and setup description.
- `game/rules/`: pure match outcome policy. Rules receive state and return results without mutating the world.
- `game/systems/`: stateful gameplay services with small public APIs, such as cooking, castle upgrades, resources, AI, and visibility.
- `ecs/`: the authoritative entity registry and component projections. Existing arrays are synced into this registry while systems migrate.
- `entities/`: prototype-era entity implementations. A unit still owns its command queue and local combat/movement state until those fields migrate to components.
- `entities/UnitStateFactory.js`: owns default unit state shape. New default unit fields should enter here before being consumed by `Unit`.
- `entities/UnitCommandTypes.js`: owns local unit command queue constants used inside the `Unit` command executor.
- `systems/processors/`: per-frame behavior for a single concern.
- `world/runtime/`: authoritative ownership of world collections, dimensions, seed, and generation metadata.
- `world/map/`: map-specific supporting catalogs and adapters, such as sprite asset construction.
- `world/objects/`: domain-facing services for houses, resources, obstacles, items, buildings, castle navigation, and map-builder object operations. New object behavior should enter here before touching `world/map.js`.
- `world/terrain/`: pure seeded noise, terrain thresholds, sampling, and grid generation.
- `world/rendering/canvas/`: Canvas fallback rendering services, including draw-list culling and ordering.
- `world/rendering/three/`: Three.js scene bootstrap, material, geometry-cache, render-domain, and procedural-texture services.
- `world/`: terrain, spatial data, world-object persistence, and compatibility adapters.
- `ui/`: DOM rendering and translation of user intent into game-system calls.
- `assets/data/`: the authoritative modding surface. `content-manifest.json` declares schema/content versioning and the loadable files for abilities, units, weapons, buildings, terrain presets, modes, and optional unit packs.

## Public API

New subsystems register under one namespace:

```text
OpenRTS.config
OpenRTS.commands
OpenRTS.diagnostics
OpenRTS.entities
OpenRTS.events
OpenRTS.modes
OpenRTS.random
OpenRTS.rendering
OpenRTS.rules
OpenRTS.simulation
OpenRTS.systems
OpenRTS.testing
OpenRTS.world
OpenRTS.ui
OpenRTS.runtime
```

Do not add new top-level globals. Existing globals are compatibility adapters and should be removed as their consumers migrate.

## Core Services

`OpenRTS.random` owns match randomness. A match receives a seed and each concern uses a named stream such as `world`, `wildlife`, `simulation`, or `effects`. This keeps map generation reproducible and prevents unrelated animation calls from changing gameplay outcomes. Use `stream(name)` in runtime code and `createStream(name, seed)` for isolated tools and tests. Do not call `Math.random()` for simulation state.

`OpenRTS.events` is the boundary for lifecycle notifications. Publishers emit immutable event envelopes shaped as `{ type, payload }`; subscribers must not mutate payload state. Events are notifications, not command dispatch, so gameplay decisions remain in rules, systems, or entity commands.

`OpenRTS.runtime` owns shared frame context and executes named systems in explicit numeric order. Systems receive `(dt, context, runtime)` and must have one update concern. Systems may also expose lifecycle hooks: `init(context, runtime)`, `reset(match, context, runtime)`, `dispose(context, runtime)`, and `describe(context, runtime)`. The active schedule is camera, input feedback, entity synchronization, vision, authoritative commands, mode rules, wildlife, cooking, movement, spatial indexing, combat, buildings, projectiles, collisions, and match rules.

`OpenRTS.camera.controller` owns camera policy: edge scrolling, keyboard movement, 2D/3D screen-to-world projection, zoom-to-pointer, fit-map zoom, and overscan clamping. `core/main.js` creates the controller and exposes temporary compatibility wrappers such as `screenToWorld`, but new camera behavior belongs in `core/camera/CameraController.js`.

`OpenRTS.simulation.context` is the structured service locator passed through runtime context. New systems should prefer it over browser globals for config, world, entities, entity queries, commands, random, navigation, resources, modes, events, renderer, diagnostics, units, buildings, and clock state.

`OpenRTS.entities.registry` is the authoritative query surface for live game objects. Each frame it syncs units, buildings, wildlife, resources, houses, items, obstacle entities, and projectiles into stable entity records with category, team, position, health, lifecycle, selectable metadata, asset id, and standard components. Existing arrays remain compatibility storage while selection, AI, save/load, minimap, fog of war, and renderer code migrate to registry queries.

`OpenRTS.entities.unitState` owns default `Unit` field initialization. Keeping this outside the class makes new unit state visible as data and creates a stepping stone toward components.

`OpenRTS.entities.unitCommandTypes` owns local command queue constants for `Unit`. Player/network/replay commands still belong to `OpenRTS.commands`; this module is only for the unit's internal executor queue.

`OpenRTS.entities.unitCommandState` owns local `Unit` command reset and append/execute policy. `Unit` still executes concrete commands, but common state clearing for movement, attacks, mounts, and items belongs here so each command method does not drift into its own reset rules.

`OpenRTS.entities.query` and `OpenRTS.entities.picker` are the public read-side APIs for gameplay object lookup. Selection, click targeting, box selection, AI, and renderer adapters should query these services instead of scanning `units`, `sheepData`, `buildingData`, or other raw collections directly.

`OpenRTS.commands` is the authoritative player-order boundary. Input, HUD controls, future AI clients, network peers, and replays submit serializable commands containing stable entity IDs. Command registrations can declare payload schemas, descriptions, and deterministic metadata; `OpenRTS.commands.describe()` exposes the registered command contract plus queue/history diagnostics. Command history can be exported as a versioned command-log envelope with game/content version metadata and a deterministic checksum, then loaded back through the same schema-aware validators for replay. The fixed-step runtime executes accepted commands in frame and sequence order after entity synchronization and records rejected commands with reasons. Direct UI calls to unit order methods are prohibited by an architecture test.

`OpenRTS.commands.gameplayHandlers` owns registration of gameplay command handlers and payload schemas. `core/main.js` composes this registrar with current world services, but new gameplay command types should be added to `game/commands/GameplayCommandHandlers.js` or a narrower command registrar instead of expanding the composition root.

`OpenRTS.modes.runtime` owns the mode lifecycle contract. Modes expose `createMatch`, `spawnInitialWorld`, `update`, `checkVictory`, and `describeSetup`. Versus, tower defense, unit comparison, and map builder are registered as adapters around current systems; new modes should register here first rather than branching inside the main loop.

`OpenRTS.world.runtime` owns terrain, obstacle, decoration, wildlife, item, and building collections. Collections are registered with metadata, revisioned on mutation, and exposed through snapshots/diagnostics so future services can depend on explicit world contracts instead of raw globals. Existing global variables point to these collections only as compatibility adapters while consumers migrate to the runtime.

`OpenRTS.world.mapSprites` owns construction of map sprite/image assets. `world/map.js` should consume this catalog rather than assigning asset URLs inline.

`OpenRTS.world.spatial` owns reusable spatial hash grids. Combat, AI, selection, resources, projectiles, and future avoidance/pathfinding should use spatial indexes for nearby queries instead of repeatedly scanning whole world arrays.

`OpenRTS.world.navigationPlanner` owns higher-level navigation requests above tile walkability: nearest reachable destinations, world/tile conversion, and path smoothing orchestration. Feature systems should depend on this planner instead of recreating destination repair and path-preparation rules.

`OpenRTS.world.objectFactories` owns creation and lifecycle contracts for houses, resource nodes, carryable items, and natural obstacles. `world/map.js` chooses placement and terrain fit, then asks these factories to create objects. New object hit points, destruction callbacks, gatherable metadata, and selection-facing fields should live in these factories first.

`OpenRTS.world.objectFactories.registry` exposes the available factory categories and creation methods. Editor tools, scenario loaders, tests, and future modding workflows should use this registry for diagnostics and generic object creation instead of assuming every object type has a bespoke global constructor.

`OpenRTS.world.hitTests` owns reusable map-object picking primitives. Circular objects such as resources, houses, items, and obstacles should use `nearestCircleAtPoint`; footprint-shaped objects such as buildings should use `nearestBoxAtPoint`. Selection code should add domain filters instead of duplicating distance loops.

`OpenRTS.world.selection` owns named selection channels for map objects, buildings, and future editor selections. Selection code should use channels so clearing and replacing selection consistently updates the object's `selected` flag and avoids scattered state variables.

`OpenRTS.world.carryables` owns pickup/drop targeting rules for carryable world objects. Worker actions and future editor tools should use this service for nearest carryable lookup, obstacle drop validation, and nearby drop-site search instead of duplicating tile scans.

`OpenRTS.world.mapBuilderBrushes` owns map-builder brush mutations for terrain, obstacles, decorations, height, and neutral house placement/removal. Map-builder UI should pass grid data into this service and let `world/map.js` handle only persistence, render-cache refresh, and compatibility globals.

`OpenRTS.world.mapBuilderRuntime` owns map-builder orchestration for converting world coordinates to brush edits, calling refresh hooks, and exporting reusable map data. `world/map.js` remains the adapter that supplies current grid arrays and compatibility globals.

`OpenRTS.world.castleGeometry` owns castle footprint checks. Castles and other buildings are solid map blockers; units do not path through doors, courtyards, stairs, or wall tops.

`OpenRTS.world.castleCommands` intentionally does not expose enter/exit/rampart behavior. The RTS interaction model is solid buildings plus explicit garrison-capable structures, where units walk to the structure, disappear, and are represented by an occupant count.

`OpenRTS.world.houseInteractions` owns neutral-house interaction behavior: door points, inside tests, enter/exit commands, burning lifecycle, occupant damage, and unit hiding/unhiding. House creation remains in `OpenRTS.world.objectFactories.houses`.

`OpenRTS.world.objectFactories.buildings` owns building entity construction and damage lifecycle. `OpenRTS.world.buildingPlacement` owns buildability, castle apron requirements, pad tile planning, and team spawn-site search. `OpenRTS.world.buildingQueries` owns team-home lookup, live building filters, world-space picking, screen-space picking, and proximity searches. Building features should enter these services before adding more branching to `world/map.js`.

`OpenRTS.world.objects` is the domain API for interactive map objects. It currently delegates some queries into legacy `world/map.js` functions, but external callers should use this service for houses, resources, obstacles, carryable items, buildings, and map-builder object operations. This lets each domain move out of `world/map.js` without changing callers again.

`OpenRTS.rendering` selects renderers by priority. The Three.js renderer can decline a frame while it initializes, allowing the Canvas 2D renderer to provide a reliable fallback without branching in the main loop.

`OpenRTS.rendering.threeDomains` owns renderer-side source adaptation and asset lookup. `world/renderer3d.js` should stay a composition layer that asks this adapter for dynamic entity sources and logical asset ids rather than scanning gameplay arrays directly.

`OpenRTS.rendering.canvas.renderLists` owns Canvas draw-list creation: camera culling, object-layer expansion, and depth sorting. Canvas painting functions should consume these lists instead of mixing sorting policy into the map module.

`OpenRTS.rendering.canvas.minimap` owns minimap painting for terrain, obstacles, units, wildlife, resources, houses, buildings, and the camera viewport. HUD code should gather current sources and delegate drawing to this renderer.

`OpenRTS.rendering.canvas.terrainPainter` owns Canvas terrain tile, accent, shoreline transition, and water/lava ripple painting. `world/map.js` supplies visible tile data and camera bounds, but terrain paint policy should move here rather than accumulating inside the map module.

`OpenRTS.rendering.threeSceneBootstrap` owns Three.js renderer, scene, camera, lights, static/dynamic groups, raycaster, and ground-plane initialization. `world/renderer3d.js` should compose this runtime with model factories and frame synchronization rather than constructing the scene graph root itself.

`OpenRTS.rendering.threeCoordinates` owns world/scene/screen coordinate conversion and ray-plane picking. Renderer modules should use it instead of open-coded map-centering math.

`OpenRTS.rendering.threeTerrainMeshes` owns Three.js terrain mesh generation, terrain color blending, shoreline/lava sampling, and authored-height composition. `world/renderer3d.js` provides map dimensions and noise dependencies, but terrain mesh policy should live in this factory.

`OpenRTS.rendering.threeBuildingModels` owns procedural Three.js fallback models for castles, defensive towers, battlements, arrow slits, gatehouses, stairs, and team flags. `world/renderer3d.js` should resolve content-driven building factories first and use this module only as the procedural fallback path.

`OpenRTS.rendering.meshPrimitives` owns common Three.js primitive mesh creation and shadow/receive-shadow setup. Procedural model builders should use this factory so geometry reuse and positioning rules stay consistent.

`OpenRTS.rendering.threeCameraSync` owns syncing the Three.js camera and renderer size from the game camera. Camera placement policy should live here instead of inside model/render-domain modules.

`OpenRTS.rendering.geometryCaches` owns reusable geometry caching. Three.js model builders should request geometry through this cache instead of keeping ad hoc maps in renderer modules.

`OpenRTS.rendering.staticWorldSignatures` owns static-scene invalidation keys for terrain, obstacles, resources, houses, buildings, and map settings. Three.js renderers should use this service to decide when static meshes need to be rebuilt instead of mixing rebuild policy into frame rendering.

`OpenRTS.rendering.staticWorldComposer` owns assembly of static Three.js scene content: terrain meshes, obstacle models, decorations, live buildings, live resources, and neutral-house wrecks. `world/renderer3d.js` supplies model factories and current sources, but this service owns the static composition order and lifecycle filtering.

`OpenRTS.rendering.dynamicWorldComposer` owns assembly of dynamic Three.js scene content: units, wildlife, roasts, items, selected-object markers, projectiles, and impact effects. `world/renderer3d.js` supplies model factories and current sources, but this service owns per-frame composition order and lifecycle filtering.

`OpenRTS.rendering.dynamicWorldComposer.createDynamicPool()` owns persistent dynamic render-object reuse. It prevents the renderer from clearing and recreating every dynamic mesh each frame, tracks visual keys for state changes, prunes stale visuals, and supports transform syncing for live entities.

`OpenRTS.rendering.projectileVisuals` owns Three.js visual construction for projectile and impact-effect renderables. Projectile simulation remains in `OpenRTS.systems.projectiles`; renderers translate projectile descriptions into meshes through this service.

`OpenRTS.rendering.entityElevation` owns renderer-facing elevation composition for terrain height and air-unit flight height. Unit model builders should ask this service for placement height rather than recomputing movement-layer policy inline.

`OpenRTS.rendering.treeWind` owns ambient tree-crown animation. Renderers should pass crown meshes and time into this service, keeping cosmetic animation math separate from scene construction and gameplay state.

`OpenRTS.rendering.factoryRegistry` owns logical renderer factories. Procedural or imported renderables should register factories by ids such as `unit.worker` or `building.castle`, allowing content assets to resolve without adding more hardcoded renderer branches.

`OpenRTS.rendering.optimization` owns reusable browser-performance policies for Three.js: LOD selection, shadow budget decisions, static chunk planning, dynamic world-view culling, and instancing batch planning. Renderer code should use these services rather than embedding one-off thresholds throughout model factories.

The same optimization service also owns render health contracts: frame budgets, quality-tier selection, static chunk diffs, LOD batch plans, viewport summaries, and diagnostic health reports. These are data-only policies so future debug overlays, automatic quality scaling, and map-builder dirty rebuilds can share one vocabulary.

`OpenRTS.rendering.staticInstanceBatcher` owns creation of `THREE.InstancedMesh` batches for repeated static objects. Static composers should use it for large sets of identical renderables such as rock boulders, future tree submeshes, and other map decoration pieces.

`OpenRTS.rendering.modelFactoryResolver` is the bridge between content asset ids and renderable construction. Renderers should ask it to resolve an entity's logical model, call the registered factory when one exists, and fall back to the current procedural model only as a compatibility path. This is the migration point for imported GLB/GLTF models, LOD variants, texture packs, and mod-supplied render factories.

`OpenRTS.rendering.renderAssetAudit` owns 3D model-contract readiness checks for static-hosted mods. It compares unit/building model ids, asset manifest entries, imported model metadata, LOD metadata, animation metadata, and registered renderer factories. Modders can run `npm run audit:render` or `node tools/render-audit.mjs --game <package-id>` before uploading packages to S3.

`OpenRTS.rendering.threeUnitAttachments` owns Three.js construction for weapons and carried-object visual attachments on unit models. Unit body builders should call this service rather than embedding every weapon mesh directly in `world/renderer3d.js`.

`OpenRTS.rendering.threeUnitModels` owns procedural Three.js unit body construction, including selection rings, mount/rider bodies, worker gathering tools, and weapon attachment dispatch. `world/renderer3d.js` should instantiate this factory and treat it as the fallback body renderer while imported model support matures.

`OpenRTS.systems.wildlife` owns sheep, duck, and horse wandering. It receives world queries and a named deterministic random stream as dependencies, keeping animal behavior independent from map storage and rendering.

`OpenRTS.systems.formationPlanner` owns formation slot planning and nearest-slot assignment for multi-unit orders. Unit movement can adopt this incrementally so group movement becomes deterministic, testable, and separate from input handling.

`OpenRTS.systems.resources` owns team resource ledgers and supports package-defined resource vocabularies such as gold/wood/stone, crystals/gas/supply, or supplies/power/command points. Rulesets and factions should configure resources; gameplay systems should ask this service to spend/add rather than hardcoding resource fields.

`OpenRTS.systems.techTree` owns data-driven unlock checks for factions. It consumes faction `techTree` and `production` definitions and answers whether a unit, building, or research id is currently available from owned buildings and completed research. It can also return lock reasons and lists of all currently available units, buildings, and research for setup UI, AI, and future multiplayer validation.

`OpenRTS.systems.productionQueues` owns producer-local training/research queues. It spends resources through `OpenRTS.systems.resources`, checks optional tech-tree access, advances durations in fixed updates, supports deterministic item ids, cancellation/refunds, progress inspection, and calls injected completion hooks such as `spawnUnit` or `completeResearch`. UI, AI, multiplayer clients, and replays should eventually submit `production.enqueue` commands instead of directly creating units.

`OpenRTS.systems.abilityEffects` owns generic ability effect execution for damage, healing, buffs/debuffs, cooldown checks, resource-cost checks, and custom effect handlers such as reveal, summon, airstrike, cloak, or superweapon. Ability data should describe effects; game-mode systems provide the target/source context and specialized handlers.

`OpenRTS.systems.buildingCombat` owns building cooldowns, target selection, attack range, and projectile requests. Buildings fire from their own stats and do not depend on units walking inside or on top of their geometry.

`OpenRTS.systems.projectiles` owns projectile pooling, movement, collision requests, splash falloff, impact effects, and 2D projectile rendering. Units and buildings submit projectile descriptions instead of constructing projectile classes directly.

`OpenRTS.config.definitions.manifest` exposes the loaded content manifest, and `OpenRTS.config.definitions.loadState` records whether startup fell back to built-in content. This gives static-hosted mods a simple diagnostics surface without requiring a backend.

`OpenRTS.config.definitions.contentIndex` is the shared catalog API for unit search, facets, resolved weapon stats, resolved abilities, factions, rulesets, damage modifiers, and lightweight content diagnostics. Setup UI, AI composition, editors, and future mod browsers should use this index instead of reimplementing catalog scans.

`OpenRTS.config.packageManifests` owns the static game-package contract for S3-hosted mods: manifest normalization, safe package-relative file resolution, semantic version checks, engine compatibility checks, dependency ordering, conflict/provides/tags metadata, deterministic fingerprints, and versioned package-lock envelopes. Package loaders, validators, mod browsers, save games, and multiplayer lobbies should use this service to identify exactly which content bundle is active.

`OpenRTS.config.contentSchemas` owns browser-safe catalog schema descriptions and validation for units, weapons, buildings, abilities, rulesets, factions, terrain presets, and modes. Runtime tools, package reports, setup UI, and future mod editors should use this service to explain and validate content fields instead of scattering one-off shape checks.

`OpenRTS.config.packageReports` owns static package capability reports. It summarizes resources, damage types, armor tags, units, buildings, terrain presets, modes, and diagnostics such as missing cross-references. `OpenRTS.config.gamePackages` attaches reports to loaded packages, and `npm run report:packages` exposes the same idea to mod authors from the command line without a compiler or backend.

`games/index.json` is the S3-friendly package catalog. Static hosting cannot rely on directory listing, so this index declares which packages are available, their manifest paths, categories, tags, featured state, and style summaries. `OpenRTS.config.gamePackages.loadGamePackageIndex()` loads it, `listAvailableGamePackages()` searches it, and `loadIndexedGamePackage(id)` resolves a package by catalog entry. `npm run validate` enforces that every package folder is indexed and every indexed manifest exists.

`ui/screens/ModeSelectScreen.js` renders package discovery from `OpenRTS.config.gamePackages` instead of hardcoded folders. Selecting a package updates the `?game=<package-id>` URL and lets the normal static definition loader reload the page with the selected package. This keeps S3 package selection deterministic and shareable by URL.

`assets/data/rulesets.json` defines the mechanics vocabulary for a game variant: resource ids, storage behavior, damage types, armor tags, effect types, and damage-vs-armor multipliers. This is the layer that lets a medieval RTS, modern RTS, fantasy RTS, or SpaceCraft-like sci-fi RTS use different resource and combat rules without branching engine code.

`assets/data/factions.json` defines playable sides in terms of a ruleset, starting resources, starting units/buildings, allowed unit/building rosters, tech-tree roots, unlocks, and production queues. Factions should reference existing unit/building/ability ids and remain original content; game-specific clones should be expressed as data packs, not hardcoded engine paths.

`games/<package-id>/manifest.json` defines a static game package. Packages can be selected with `?game=<package-id>` and are loaded from folders such as `games/desert_command/` without a backend. A package manifest may point to package-local rulesets, factions, units, buildings, weapons, abilities, terrain presets, modes, assets, and scenarios. The browser loads those JSON files, merges them over the core content according to the manifest's `mergeMode`, and exposes the active package through `OpenRTS.config.definitions.activeGamePackage`.

`OpenRTS.config.gamePackages` owns package discovery-by-url, package manifest loading, package-file fetching, merge policy, and diagnostics. New RTS variants should be built as game packages instead of editing engine files. `tools/validate-config.mjs` validates both the core content and every `games/*/manifest.json` package by merging it over the core catalog and checking all references.

`OpenRTS.config.assets` owns the asset manifest. Content should reference logical asset ids such as `unit.worker`, `building.castle`, or `terrain.grass`; renderers resolve those ids to procedural factories, textures, sounds, or future imported model URLs. The content validator checks the manifest and model references.

`OpenRTS.config.assetMetadata` normalizes renderer-facing model metadata such as kind, URL, fallback, scale, rotation, LODs, attachments, and animation names. Imported model loading should consume this normalized shape rather than reading raw manifest objects directly.

`OpenRTS.config.scenarios` owns data-driven scenario definitions such as default versus and tower-defense presets. Modes should increasingly consume scenarios for spawn rules, starting resources, rosters, and player slots instead of hardcoded defaults.

`OpenRTS.config.scenarioComposer` owns merging scenario defaults with user setup overrides. Setup UI and modes should ask this composer for effective settings so map, player, resource, and roster overrides stay consistent.

`OpenRTS.config.contentPacks` loads optional content pack manifests. Packs are not merged into the live catalogs yet; they are tracked as explicit data bundles with ids, versions, dependencies, and file declarations so future mod loading has a clear contract.

`OpenRTS.diagnostics.report()` aggregates serializable diagnostics from registered subsystems such as config, commands, world runtime, rendering, and simulation snapshots. Individual reporters must not throw outward or return unserializable state; the diagnostics registry captures failures as report sections. `OpenRTS.diagnostics.simulation` creates canonical versioned snapshots and stable checksums. Entity collections are sorted and simulation floats are normalized, allowing automated replay and multiplayer desynchronization checks without serializing renderer state.

`OpenRTS.diagnostics.performance` owns lightweight counters, timings, and measured sections for frame time, AI, pathfinding, rendering rebuilds, spatial queries, and other budgets. Systems should record measurements here instead of inventing ad hoc debug counters.

`OpenRTS.runtime.matchSnapshots` captures a versioned match envelope containing content version, seed, mode/config, player slots, world metadata, entity-registry state, resources, command log, and diagnostics. Use this for future save/load, replays, bug reports, map-builder handoff, and multiplayer sync debugging.

`OpenRTS.runtime.replayVerifier` compares deterministic simulation checksums for replay/save-load verification. Full replay runners can build on this service to prove a command log reproduces the same final state.

`OpenRTS.systems.vision` computes team visibility from unit/building vision components. Fog-of-war rendering is still a future visual layer, but AI, targeting, and future networking can already ask whether a registry entity is visible to a team.

`OpenRTS.ui.commandTargeting` owns action-targeting state and execution for HUD commands such as attack-move, pickup, drop, cook, gathering, building, upgrading, and burning houses. Input should call this controller instead of embedding HUD-specific targeting branches.

`OpenRTS.testing.createHeadlessSimulationHarness()` creates a DOM-free fixed-step harness for tests and future replay/debug automation. It can enqueue commands and run deterministic frame counts against a runtime.

`OpenRTS.entities.componentSchemas` documents the target component contracts for transform, movement, combat, render, inventory, vision, and worker state. New component migration should register or update schemas before spreading new unit state fields across legacy classes.

Architecture tests enforce key boundaries, including command-stream usage and an approved compatibility list for browser globals. New `window.foo = ...` or `globalThis.foo = ...` assignments should be avoided; when a temporary compatibility adapter is unavoidable, add it deliberately to the test allowlist with a migration plan.

The Three.js overlay pass owns selected health bars and command markers. It receives projected screen points from the scene renderer, keeping Canvas HUD drawing separate from scene construction.

Current lifecycle events:

```text
config:loaded
world:regenerated
match:started
match:reset
match:ended
cooking:started
cooking:completed
castle:upgraded
command:enqueued
command:executed
command:rejected
```

## Data Flow

```text
JSON definitions -> definition registry -> setup configuration
setup configuration -> world/session initialization
input -> serializable command stream -> fixed-step command handlers
world collections -> entity registry -> component projections and queries
entity registry -> vision system -> visible query filters
scenario JSON -> scenario registry -> mode setup and match defaults
fixed-step loop -> processors and rules -> world state
world state -> registry render sources -> Three.js renderer and HUD
headless harness -> runtime systems -> assertions/replay/debug snapshots
```

## Mod Validation

Run `npm run validate` after editing JSON. The reusable validator in `tools/configValidation.mjs` treats the content catalog as a public modding API: IDs must be stable lowercase keys, manifest files must stay under `assets/data/`, numeric balance fields must be finite and in range, and all unit, weapon, ability, terrain, building, and roster references must resolve. This catches broken content packs before the browser loads them.

Run `npm run check` before shipping. Validation failures should be fixed in data, not worked around in runtime code.

## Next Extraction Targets

1. Migrate runtime systems from globals to `OpenRTS.simulation.context`.
2. Continue moving terrain generation/population, object spawn seeding, terrain mutation side effects, and remaining compatibility globals from `world/map.js` into files under `world/`.
3. Continue splitting `world/renderer3d.js` into terrain, unit body, building, wildlife, resource, effects, and camera modules under `world/rendering/three/`, backed by `OpenRTS.rendering.factoryRegistry`.
4. Move remaining minimap reads from raw arrays to `OpenRTS.entities.query`.
5. Add the fog-of-war visual layer using `OpenRTS.systems.vision` output.
6. Replace remaining `Unit` command/mount/inventory feature fields with components now exposed by the registry.
7. Expand `OpenRTS.modes.runtime` so each mode owns spawn policy and victory checks directly.
8. Merge optional content packs into validated live catalogs.
9. Move mode defaults toward scenario JSON and saved scenario presets.
10. Either migrate or remove the prototype ECS scaffolds under `engine/ecs/` so the repository has one engine path.
