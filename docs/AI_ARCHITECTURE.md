# AI Architecture

Open RTS AI is split into game-facing adapters and reusable AI modules.

## Runtime Boundary

`game/systems/skirmishAiSystem.js` is the only versus-mode runtime adapter. It discovers AI slots from `mapConfig.playerSlots`, creates one `AIPlayer` per AI team, and passes read-only game state into the AI.

AI code must not directly modify units, buildings, terrain, or world collections. AI actions must go through `OpenRTS.commands` whenever a command exists. If a future feature does not have a command yet, add the command before letting AI use it.

## Core

- `game/ai/core/AIPlayer.js`: public AI entry point for a player/team.
- `game/ai/core/AIBrain.js`: high-level decision loop. Collects planner intents and executes them through tactics.
- `game/ai/core/Blackboard.js`: cached knowledge, perception, recent orders, army strength, enemy strength, threats, and known bases.

## Planners

Planners generate intent, not direct actions.

- `DefensePlanner`: decides when the AI must defend its castle.
- `AttackPlanner`: decides when to attack or harass.
- `ArmyPlanner`: prepares tactical positions such as castle ramparts.
- `EconomyPlanner`: currently upgrades the castle; later this is where workers, resources, expansion, and production budgets belong.

## Tactics

Tactics convert intent into command-bus orders.

- `TargetSelector`: chooses units, kings, castles, and buildings to attack.
- `SquadController`: emits move, attack, rampart, and upgrade commands.

## Strategies

Strategies tune the same planners without duplicating planner code.

- `BalancedStrategy`
- `RushStrategy`
- `TurtleStrategy`

Add new strategies by choosing different timing, aggression, defense radius, army thresholds, and production preferences through profiles.

## Tower Defense

`game/ai/td/` is intentionally separate from versus AI.

- `WaveDirector`: owns timing.
- `DifficultyScaler`: owns budget growth.
- `WaveSpawner`: should spawn through future command-bus spawn commands.
- `waveTemplates`: data-only wave definitions.

## Future Feature Hooks

Common RTS features should attach at these points:

- Resources/workers: `EconomyPlanner`
- Unit production/composition: `ArmyPlanner`
- Build orders: strategy profile data plus economy/army planners
- Fog of war/scouting: `Blackboard.update`
- Retreating/kiting: `DefensePlanner`, `TargetSelector`, and `SquadController`
- Transport/naval/air units: `TargetSelector` and command payloads
- Multiplayer/replays: keep all AI output in `OpenRTS.commands`
