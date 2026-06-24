(function registerAIPlayer(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before AIPlayer.js');
  app.ai = app.ai || {};
  app.ai.core = app.ai.core || {};

  function createStrategy(strategyId, profile) {
    if (strategyId === 'rush') return new app.ai.strategies.RushStrategy(profile);
    if (strategyId === 'turtle') return new app.ai.strategies.TurtleStrategy(profile);
    return new app.ai.strategies.BalancedStrategy(profile);
  }

  class AIPlayer {
    constructor({
      playerId = 'ai',
      team,
      strategy = 'balanced',
      commandBus,
      entityManager = null
    }) {
      if (!team) throw new Error('AIPlayer requires a team');
      this.playerId = playerId;
      this.team = team;
      this.entityManager = entityManager;
      this.commandBus = commandBus;
      this.profile = app.ai.data.getProfile(strategy);
      this.blackboard = new app.ai.core.Blackboard({ team, profile: this.profile });
      this.brain = new app.ai.core.AIBrain({
        blackboard: this.blackboard,
        strategy: createStrategy(strategy, this.profile),
        targetSelector: new app.ai.tactics.TargetSelector({ metrics: app.ai.core.metrics }),
        squadController: new app.ai.tactics.SquadController({
          commandBus,
          metrics: app.ai.core.metrics
        }),
        planners: {
          attack: new app.ai.planners.AttackPlanner(),
          defense: new app.ai.planners.DefensePlanner(),
          army: new app.ai.planners.ArmyPlanner(),
          economy: new app.ai.planners.EconomyPlanner()
        }
      });
    }

    update(deltaTime, gameState = {}) {
      if (!this.commandBus?.enqueue || !this.commandBus?.types) return;
      this.brain.update(deltaTime, gameState);
    }

    getDebugState() {
      return {
        playerId: this.playerId,
        strategy: this.profile.id,
        ...this.blackboard.getDebugState()
      };
    }
  }

  app.ai.core.AIPlayer = AIPlayer;
})(globalThis);
