(function registerAIBrain(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before AIBrain.js');
  app.ai = app.ai || {};
  app.ai.core = app.ai.core || {};

  class AIBrain {
    constructor({
      blackboard,
      strategy,
      targetSelector,
      squadController,
      planners
    }) {
      this.blackboard = blackboard;
      this.strategy = strategy;
      this.targetSelector = targetSelector;
      this.squadController = squadController;
      this.planners = planners;
      this.thinkCooldown = 0;
    }

    update(deltaTime, gameState) {
      this.blackboard.update(deltaTime, gameState);
      this.thinkCooldown -= Math.max(0, Number(deltaTime) || 0);
      if (this.thinkCooldown > 0) return;
      this.thinkCooldown = this.blackboard.profile.thinkInterval;

      const primaryPlan = this.strategy.choosePrimaryPlan(this.blackboard);
      this.blackboard.markPlan(primaryPlan);
      const intents = this.collectIntents(primaryPlan);
      this.executeIntents(intents, primaryPlan);
    }

    collectIntents(primaryPlan) {
      return [
        this.planners.defense.createIntent(this.blackboard, primaryPlan),
        this.planners.army.createIntent(this.blackboard, primaryPlan),
        this.planners.economy.createIntent(this.blackboard, primaryPlan),
        this.planners.attack.createIntent(this.blackboard, primaryPlan)
      ]
        .filter(Boolean)
        .sort((left, right) => right.priority - left.priority);
    }

    executeIntents(intents, primaryPlan) {
      let orders = 0;
      const maxOrders = this.blackboard.profile.maxOrdersPerThink;

      for (const intent of intents) {
        if (orders >= maxOrders) break;
        if (intent.type === 'prepare-ramparts') {
          orders += this.executeRampartIntent(intent, maxOrders - orders);
        } else if (intent.type === 'upgrade-castle') {
          orders += this.squadController.upgradeCastle(this.blackboard, intent.king, intent.home) ? 1 : 0;
        } else if (intent.type === 'defend') {
          orders += this.executeDefenseIntent(intent, maxOrders - orders);
        } else if (intent.type === 'attack' || intent.type === 'harass') {
          orders += this.executeAttackIntent(intent, primaryPlan, maxOrders - orders);
          if (orders > 0 && intent.type === 'attack') {
            this.blackboard.waveCooldown = this.blackboard.profile.waveInterval;
          }
        }
      }

      if (orders < maxOrders) this.executeRallyOrders(maxOrders - orders);
    }

    executeRampartIntent(intent, budget) {
      let orders = 0;
      intent.defenders.forEach((unit, index) => {
        if (orders >= budget) return;
        if (this.squadController.sendToRampart(
          this.blackboard,
          unit,
          intent.home,
          index,
          this.blackboard.profile.rampartDefenders,
          intent.target
        )) {
          orders++;
        }
      });
      return orders;
    }

    executeDefenseIntent(intent, budget) {
      const metrics = app.ai.core.metrics;
      const home = this.blackboard.get('home');
      const defenders = this.blackboard.get('friendlyUnits', [])
        .filter(unit => metrics.isCombatUnit(unit) || (this.blackboard.profile.defendWithKing && unit.unitType === 'king'))
        .sort((left, right) => metrics.distanceSquared(left, home || left) - metrics.distanceSquared(right, home || right));

      let orders = 0;
      for (const unit of defenders) {
        if (orders >= budget) break;
        const target = metrics.nearest(unit, intent.threats);
        if (!target) continue;
        if (this.squadController.attack(this.blackboard, unit, { kind: 'unit', entity: target })) orders++;
      }
      return orders;
    }

    executeAttackIntent(intent, primaryPlan, budget) {
      const metrics = app.ai.core.metrics;
      const attackers = this.blackboard.get('assaultUnits', [])
        .filter(unit => !metrics.unitHasActiveOrder(unit) || primaryPlan === 'attack')
        .sort((left, right) => {
          const leftRanged = metrics.isRangedUnit(left) ? 1 : 0;
          const rightRanged = metrics.isRangedUnit(right) ? 1 : 0;
          return rightRanged - leftRanged || (right.hp || 0) - (left.hp || 0);
        });

      let orders = 0;
      for (const unit of attackers) {
        if (orders >= budget) break;
        const target = this.targetSelector.choose(unit, this.blackboard, intent.type);
        if (!target) continue;
        if (this.squadController.attack(this.blackboard, unit, target)) orders++;
      }
      return orders;
    }

    executeRallyOrders(budget) {
      const metrics = app.ai.core.metrics;
      const home = this.blackboard.get('home');
      const enemyHome = this.blackboard.get('enemyHome');
      if (!home || !enemyHome) return 0;

      const dx = enemyHome.x - home.x;
      const dy = enemyHome.y - home.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const rallyPoint = {
        x: home.x + dx / length * this.blackboard.profile.rallyDistance,
        y: home.y + dy / length * this.blackboard.profile.rallyDistance
      };

      let orders = 0;
      for (const unit of this.blackboard.get('idleCombatUnits', [])) {
        if (orders >= budget) break;
        if (metrics.distance(unit, rallyPoint) < this.blackboard.profile.rallyTolerance) continue;
        if (this.squadController.move(this.blackboard, unit, rallyPoint)) orders++;
      }
      return orders;
    }
  }

  app.ai.core.AIBrain = AIBrain;
})(globalThis);
