(function registerSquadController(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before SquadController.js');
  app.ai = app.ai || {};
  app.ai.tactics = app.ai.tactics || {};

  function safeEnqueue(commands, command) {
    try {
      commands.enqueue(command);
      return true;
    } catch (error) {
      if (/Unknown command type/i.test(error.message)) return false;
      throw error;
    }
  }

  class SquadController {
    constructor({ commandBus, metrics }) {
      this.commandBus = commandBus;
      this.metrics = metrics;
    }

    attack(blackboard, unit, target, append = false) {
      if (!this.metrics.isAlive(unit) || !this.metrics.isAlive(target?.entity)) return false;
      const signature = `attack:${target.kind}:${target.entity.id}`;
      if (blackboard.hasRecentOrder(unit, signature)) return false;

      const accepted = safeEnqueue(this.commandBus, {
        type: this.commandBus.types.ATTACK,
        playerId: `ai-${blackboard.team}`,
        payload: {
          unitId: unit.id,
          targetKind: target.kind,
          targetId: target.entity.id,
          append
        }
      });

      if (accepted) blackboard.rememberOrder(unit, signature);
      return accepted;
    }

    move(blackboard, unit, point, append = false) {
      if (!this.metrics.isAlive(unit) || !point) return false;
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      const signature = `move:${x}:${y}`;
      if (blackboard.hasRecentOrder(unit, signature)) return false;

      const accepted = safeEnqueue(this.commandBus, {
        type: this.commandBus.types.MOVE,
        playerId: `ai-${blackboard.team}`,
        payload: { unitId: unit.id, x, y, append }
      });

      if (accepted) blackboard.rememberOrder(unit, signature);
      return accepted;
    }

    sendToRampart(blackboard, unit, building, index, total, target = null) {
      if (!this.metrics.isAlive(unit) || !this.metrics.isAlive(building)) return false;
      const signature = `rampart:${building.id}:${index}`;
      if (blackboard.hasRecentOrder(unit, signature)) return false;

      const accepted = safeEnqueue(this.commandBus, {
        type: this.commandBus.types.CASTLE_RAMPART,
        playerId: `ai-${blackboard.team}`,
        payload: {
          unitId: unit.id,
          buildingId: building.id,
          index,
          total,
          append: false,
          targetX: target?.x ?? null,
          targetY: target?.y ?? null
        }
      });

      if (accepted) blackboard.rememberOrder(unit, signature);
      return accepted;
    }

    upgradeCastle(blackboard, king, home) {
      if (!this.metrics.isAlive(king) || !this.metrics.isAlive(home)) return false;
      const signature = `upgrade:${home.id}:${home.upgradeLevel || 0}`;
      if (blackboard.hasRecentOrder(king, signature)) return false;

      const accepted = safeEnqueue(this.commandBus, {
        type: this.commandBus.types.CASTLE_UPGRADE,
        playerId: `ai-${blackboard.team}`,
        payload: {
          kingId: king.id,
          buildingId: home.id
        }
      });

      if (accepted) blackboard.rememberOrder(king, signature);
      return accepted;
    }
  }

  app.ai.tactics.SquadController = SquadController;
})(globalThis);
