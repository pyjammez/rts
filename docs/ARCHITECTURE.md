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
- `core/rendering/`: renderer registration, priority, and fallback selection.
- `core/`: application namespace, fixed-step loop, camera, and runtime composition.
- `game/config/`: JSON loading, normalization, and definition lookup.
- `game/rules/`: pure match outcome policy. Rules receive state and return results without mutating the world.
- `game/systems/`: stateful gameplay services with small public APIs, such as cooking and castle upgrades.
- `entities/`: entity state and commands. A unit owns its command queue and local combat/movement state.
- `systems/processors/`: per-frame behavior for a single concern.
- `world/runtime/`: authoritative ownership of world collections, dimensions, seed, and generation metadata.
- `world/terrain/`: pure seeded noise, terrain thresholds, sampling, and grid generation.
- `world/rendering/three/`: Three.js material and procedural-texture services.
- `world/`: terrain, spatial data, world-object persistence, and compatibility adapters.
- `ui/`: DOM rendering and translation of user intent into game-system calls.
- `assets/data/`: the authoritative modding surface for units, weapons, buildings, terrain presets, and modes.

## Public API

New subsystems register under one namespace:

```text
OpenRTS.config
OpenRTS.commands
OpenRTS.diagnostics
OpenRTS.events
OpenRTS.random
OpenRTS.rendering
OpenRTS.rules
OpenRTS.systems
OpenRTS.world
OpenRTS.ui
OpenRTS.runtime
```

Do not add new top-level globals. Existing globals are compatibility adapters and should be removed as their consumers migrate.

## Core Services

`OpenRTS.random` owns match randomness. A match receives a seed and each concern uses a named stream such as `world`, `wildlife`, `simulation`, or `effects`. This keeps map generation reproducible and prevents unrelated animation calls from changing gameplay outcomes. Use `stream(name)` in runtime code and `createStream(name, seed)` for isolated tools and tests. Do not call `Math.random()` for simulation state.

`OpenRTS.events` is the boundary for lifecycle notifications. Publishers emit immutable event envelopes shaped as `{ type, payload }`; subscribers must not mutate payload state. Events are notifications, not command dispatch, so gameplay decisions remain in rules, systems, or entity commands.

`OpenRTS.runtime` owns shared frame context and executes named systems in explicit numeric order. Systems receive `(dt, context, runtime)` and must have one update concern. The active schedule is camera, input feedback, entity synchronization, authoritative commands, mode rules, wildlife, cooking, movement, spatial indexing, combat, buildings, projectiles, collisions, and match rules.

`OpenRTS.commands` is the authoritative player-order boundary. Input, HUD controls, future AI clients, network peers, and replays submit serializable commands containing stable entity IDs. The fixed-step runtime executes them in frame and sequence order after entity synchronization. Direct UI calls to unit order methods are prohibited by an architecture test.

`OpenRTS.world.runtime` owns terrain, obstacle, decoration, wildlife, item, and building collections. Existing global variables point to these collections only as compatibility adapters while consumers migrate to the runtime.

`OpenRTS.rendering` selects renderers by priority. The Three.js renderer can decline a frame while it initializes, allowing the Canvas 2D renderer to provide a reliable fallback without branching in the main loop.

`OpenRTS.systems.wildlife` owns sheep, duck, and horse wandering. It receives world queries and a named deterministic random stream as dependencies, keeping animal behavior independent from map storage and rendering.

`OpenRTS.systems.buildingCombat` owns building cooldowns, target selection, attack range, and projectile requests. Castle rampart occupancy and projectile allocation are injected by the composition root, so the combat policy does not depend on map globals or a concrete projectile class.

`OpenRTS.systems.projectiles` owns projectile pooling, movement, collision requests, splash falloff, impact effects, and 2D projectile rendering. Units and buildings submit projectile descriptions instead of constructing projectile classes directly.

`OpenRTS.diagnostics.simulation` creates canonical versioned snapshots and stable checksums. Entity collections are sorted and simulation floats are normalized, allowing automated replay and multiplayer desynchronization checks without serializing renderer state.

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
fixed-step loop -> processors and rules -> world state
world state -> Three.js renderer and HUD
```

## Mod Validation

Run `npm run validate` after editing JSON. It verifies unit/weapon references, mode rosters, required unique units, terrain presets, and essential building definitions. Run `npm run check` before shipping.

## Next Extraction Targets

1. Move building placement, castle navigation, and carryable-object behavior out of `world/map.js` behind `WorldRuntime` services.
2. Split `world/renderer3d.js` into terrain rendering and entity factories registered with the renderer service.
3. Replace remaining `Unit` command/mount/inventory feature fields with components.
4. Move HUD targeting state into a dedicated command-targeting controller.
5. Route AI and scripted scenario orders through the same command stream as players.
6. Either migrate or remove the prototype ECS and mode scaffolds so the repository has one engine path.
