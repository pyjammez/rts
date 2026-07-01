(function registerCommandTargetingController(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.ui = app.ui || {};

  class CommandTargetingController {
    constructor() {
      this.mode = null;
      this.callbacks = {};
    }

    configure(callbacks = {}) {
      this.callbacks = { ...this.callbacks, ...callbacks };
      return this;
    }

    getMode() {
      return this.mode;
    }

    selectedUnits() {
      return this.callbacks.getSelectedUnits?.() || [];
    }

    setMessage(message) {
      this.callbacks.setMessage?.(message);
    }

    refresh() {
      this.callbacks.updateActions?.();
    }

    isWorkerUnit(unit) {
      const tags = Array.isArray(unit?.tags) ? unit.tags : [];
      return !!app.systems.workerEconomy?.isWorker?.(unit) ||
        unit?.unitType === 'worker' ||
        tags.includes('builder');
    }

    isBuildMode(mode) {
      return mode === 'build-tower' || String(mode || '').startsWith('build:');
    }

    getBuildType(mode) {
      return mode === 'build-tower' ? 'tower' : String(mode || '').slice('build:'.length);
    }

    isEligible(mode) {
      const selectedUnits = this.selectedUnits();
      const workerMode = ['mine-gold', 'mine-stone', 'chop-wood', 'gather-food'].includes(mode) || this.isBuildMode(mode);
      if (workerMode) return selectedUnits.some(unit => this.isWorkerUnit(unit));
      if (mode === 'burn-house') return selectedUnits.length > 0;
      if (mode === 'pickup') return selectedUnits.some(unit => !unit.inventoryItem);
      if (mode === 'drop') return selectedUnits.some(unit => !!unit.inventoryItem);
      if (mode === 'upgrade-castle') return selectedUnits.some(unit => unit.unitType === 'king');
      return selectedUnits.length > 0;
    }

    toggle(mode) {
      if (this.mode === mode) {
        this.cancel();
        return;
      }
      if (!this.isEligible(mode)) return;
      this.mode = mode;
      this.callbacks.clearMessage?.();
      this.refresh();
    }

    cancel(message = 'Item action cancelled') {
      if (!this.mode) return;
      this.mode = null;
      if (message) this.setMessage(message);
      this.refresh();
    }

    complete(message = '') {
      this.mode = null;
      if (message) this.setMessage(message);
      this.refresh();
    }

    targetAt(worldX, worldY) {
      if (!this.mode) return false;
      const selectedUnits = this.selectedUnits();
      const mode = this.mode;
      const marker = this.callbacks.addMarker || root.addCommandClickMarker;
      const pick = app.entities?.picker?.pickAllAtPoint?.(worldX, worldY) || {};
      const worldObjects = app.world?.objects;

      if (mode === 'attack-move') {
        const team = selectedUnits[0]?.team;
        const controllableUnits = selectedUnits.filter(unit => unit.team === team);
        const result = app.commandIntents.unit.enqueueAttackMoveGroupToWorld(controllableUnits, { x: worldX, y: worldY });
        this.complete(result.issued > 0
          ? `${result.issued} unit${result.issued === 1 ? '' : 's'} attack-moving`
          : 'No selected unit can attack-move there');
        if (result.issued > 0 && marker) {
          const click = result.marker || { x: worldX, y: worldY, color: 'red' };
          marker(click.x, click.y, click.color);
        }
        return true;
      }

      if (mode === 'upgrade-castle') {
        const king = selectedUnits.find(unit => unit.unitType === 'king');
        const building = pick.building?.source || worldObjects?.buildings?.atPoint(worldX, worldY) || root.getBuildingAtPoint?.(worldX, worldY);
        if (!king || !building || building.type !== 'home' || building.team !== king.team) {
          this.setMessage('Click your king\'s castle');
          return true;
        }
        if (building.upgradeLevel >= building.maxUpgradeLevel) {
          this.setMessage('That castle is fully upgraded');
          return true;
        }
        app.commands.enqueue({
          type: app.commands.types.CASTLE_UPGRADE,
          payload: { kingId: king.id, buildingId: building.id }
        });
        if (marker) marker(building.x, building.y, 'green');
        this.complete('Castle upgrade ordered');
        return true;
      }

      if (mode === 'cook') {
        const sheep = pick.sheep?.source || root.getSheepAtPoint?.(worldX, worldY);
        if (!sheep) {
          this.setMessage('Click a living sheep');
          return true;
        }
        const team = selectedUnits[0]?.team;
        if (!team) return true;
        app.commands.enqueue({ type: app.commands.types.COOK, payload: { sheepId: sheep.id, team } });
        if (marker) marker(sheep.x, sheep.y, 'green');
        this.complete('Roast cooking for 10 seconds');
        return true;
      }

      if (mode === 'mine-gold') {
        const mine = pick.goldMine?.source || worldObjects?.resources?.goldMineAtPoint(worldX, worldY) || root.getGoldMineAtPoint?.(worldX, worldY);
        return this.orderWorkerGather(mine, 'goldMine', 'gold', 'Click a gold mine with a worker selected', 'moving to mine gold', marker);
      }

      if (mode === 'chop-wood') {
        const tree = pick.obstacle?.source || worldObjects?.obstacles?.atPoint(worldX, worldY) || root.getObstacleAtPoint?.(worldX, worldY);
        if (tree?.material !== 'Wood') {
          this.setMessage('Click a tree with a worker selected');
          return true;
        }
        return this.orderWorkerGather(tree, 'obstacle', 'wood', 'Click a tree with a worker selected', 'moving to chop wood', marker);
      }

      if (mode === 'mine-stone') {
        const rock = pick.obstacle?.source || worldObjects?.obstacles?.atPoint(worldX, worldY) || root.getObstacleAtPoint?.(worldX, worldY);
        if (rock?.material !== 'Stone') {
          this.setMessage('Click a rock outcrop with a worker selected');
          return true;
        }
        return this.orderWorkerGather(rock, 'obstacle', 'stone', 'Click a rock outcrop with a worker selected', 'moving to mine stone', marker);
      }

      if (mode === 'gather-food') {
        const sheep = pick.sheep?.source || root.getSheepAtPoint?.(worldX, worldY);
        const duck = !sheep && (pick.duck?.source || root.getDuckAtPoint?.(worldX, worldY));
        const animal = sheep || duck;
        if (!animal || animal.isDead || animal.isMounted) {
          this.setMessage('Click a living sheep or duck with a worker selected');
          return true;
        }
        return this.orderWorkerGather(animal, sheep ? 'sheep' : 'duck', 'food', 'Click a living sheep or duck with a worker selected', 'moving to gather food', marker);
      }

      if (this.isBuildMode(mode)) {
        const buildingType = this.getBuildType(mode);
        const worker = selectedUnits.find(unit => this.isWorkerUnit(unit));
        if (!worker) {
          this.setMessage('Select a worker to build');
          return true;
        }
        const definition = root.getBuildingDefinition?.(buildingType) || {};
        const cost = app.systems.workerEconomy?.getBuildCost?.(buildingType) || app.systems.workerEconomy?.BUILD_COSTS?.[buildingType] || {};
        if (app.systems.resources && !app.systems.resources.canAfford(worker.team, cost)) {
          this.setMessage(`Need ${this.formatCost(cost)}`);
          return true;
        }
        app.commands.enqueue({
          type: app.commands.types.WORKER_BUILD,
          payload: { unitId: worker.id, buildingType, x: worldX, y: worldY }
        });
        if (marker) marker(worldX, worldY, 'gold');
        this.complete(`${definition.name || 'Building'} construction ordered`);
        return true;
      }

      if (mode === 'burn-house') {
        const house = pick.house?.source || worldObjects?.houses?.atPoint(worldX, worldY) || root.getHouseAtPoint?.(worldX, worldY);
        if (!house || house.isWreck || house.burning) {
          this.setMessage('Click an intact house');
          return true;
        }
        app.commands.enqueue({ type: app.commands.types.HOUSE_BURN, payload: { houseId: house.id } });
        if (marker) marker(house.x, house.y, 'red');
        this.complete('House set on fire');
        return true;
      }

      if (mode === 'pickup') {
        const item = pick.item?.source || pick.obstacle?.source || worldObjects?.items?.atPoint(worldX, worldY) || worldObjects?.obstacles?.atPoint(worldX, worldY) ||
          root.getWorldItemAtPoint?.(worldX, worldY) || root.getObstacleAtPoint?.(worldX, worldY);
        if (!item || !item.pickupable || item.isDead || item.isPickedUp) {
          this.setMessage('Click a tree, rock, or item');
          return true;
        }
        const unit = selectedUnits.find(candidate => !candidate.inventoryItem);
        if (!unit) {
          this.setMessage('No selected unit can pick that up');
          return true;
        }
        app.commands.enqueue({
          type: app.commands.types.PICK_UP,
          payload: {
            unitId: unit.id,
            targetId: item.id,
            targetKind: item.objectType === 'obstacle' ? 'obstacle' : 'item'
          }
        });
        if (marker) marker(item.x, item.y, 'green');
        this.complete(`${unit.displayName || 'Unit'} moving to pick up ${item.displayName || 'item'}`);
        return true;
      }

      return this.dropAt(worldX, worldY, marker);
    }

    orderWorkerGather(target, targetKind, resourceType, missingMessage, successAction, marker) {
      const worker = this.selectedUnits().find(unit => this.isWorkerUnit(unit));
      if (!worker || !target) {
        this.setMessage(missingMessage);
        return true;
      }
      app.commands.enqueue({
        type: app.commands.types.WORKER_GATHER,
        payload: { unitId: worker.id, targetId: target.id, targetKind, resourceType }
      });
      if (marker) marker(target.x, target.y, resourceType === 'gold' ? 'gold' : 'green');
      this.complete(`${worker.displayName || 'Worker'} ${successAction}`);
      return true;
    }

    formatCost(cost = {}) {
      const entries = Object.entries(cost)
        .filter(([, value]) => Number(value) > 0)
        .map(([resource, value]) => `${value} ${resource}`);
      return entries.length ? entries.join(', ') : 'no resources';
    }

    dropAt(worldX, worldY, marker) {
      const carryingUnits = this.selectedUnits().filter(unit => unit.inventoryItem);
      let ordered = 0;
      carryingUnits.forEach((unit, index) => {
        const angle = carryingUnits.length > 1 ? index / carryingUnits.length * Math.PI * 2 : 0;
        const radius = carryingUnits.length > 1 ? root.tileSize * 0.85 : 0;
        app.commands.enqueue({
          type: app.commands.types.DROP,
          payload: {
            unitId: unit.id,
            x: worldX + Math.cos(angle) * radius,
            y: worldY + Math.sin(angle) * radius
          }
        });
        ordered++;
      });
      if (ordered === 0) {
        this.setMessage('No selected unit can drop an item there');
        return true;
      }
      if (marker) marker(worldX, worldY, 'green');
      this.complete(`${ordered} unit${ordered === 1 ? '' : 's'} moving to the drop location`);
      return true;
    }
  }

  app.ui.commandTargeting = new CommandTargetingController();
  app.ui.CommandTargetingController = CommandTargetingController;
})(globalThis);
