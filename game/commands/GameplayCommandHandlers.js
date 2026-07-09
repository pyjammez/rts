(function registerGameplayCommandHandlerFactory(global) {
  const app = global.OpenRTS;
  if (!app) return;

  app.commands = app.commands || {};

  function findEntityById(collection, id) {
    return (Array.isArray(collection) ? collection : []).find(entity => String(entity.id) === String(id)) || null;
  }

  function createRegistrar(deps = {}) {
    const {
      commands = app.commands,
      units = [],
      worldRuntime = app.world?.runtime,
      systems = app.systems || {},
      tileSize = 32,
      removeSheepFromMap = null,
      commandUnitIntoHouse = null,
      commandUnitOutOfHouse = null,
      startBurningHouse = null
    } = deps;

    const resolveUnit = id => findEntityById(units, id);
    const resolveBuilding = id => findEntityById(worldRuntime?.get?.('buildings'), id);
    const resolveCommandTarget = (kind, id) => {
      if (kind === 'unit') return resolveUnit(id);
      if (kind === 'building') return resolveBuilding(id);
      const collectionName = {
        sheep: 'sheep',
        duck: 'ducks',
        horse: 'horses',
        item: 'items',
        goldMine: 'goldMines',
        house: 'houses',
        obstacle: 'obstacleEntities'
      }[kind];
      return collectionName ? findEntityById(worldRuntime?.get?.(collectionName), id) : null;
    };

    function registerAll() {
      const commandTypes = commands.types;
      const id = { type: 'integer', min: 1 };
      const optionalBoolean = { type: 'boolean', required: false };
      const worldPoint = { x: 'number', y: 'number' };
      const unitTarget = {
        unitId: id,
        targetId: id,
        targetKind: 'string',
        append: optionalBoolean
      };
      const movePayload = { unitId: id, ...worldPoint, append: optionalBoolean };
      const register = (type, description, payloadSchema, handler, validate = null) => {
        commands.register(type, handler, validate, { description, payloadSchema });
      };

      register(commandTypes.MOVE, 'Order one unit to move to a world point.', movePayload, command => {
        const unit = resolveUnit(command.payload.unitId);
        if (!unit || unit.isDead) return false;
        systems.workerEconomy?.clearJob(unit);
        const issued = unit.issueMoveCommand(command.payload.x, command.payload.y, { append: !!command.payload.append });
        if (issued && typeof global.markComparisonUnitManualControl === 'function') {
          global.markComparisonUnitManualControl(unit);
        }
        return issued;
      });
      register(commandTypes.ATTACK_MOVE, 'Order one unit to move while auto-engaging enemies.', movePayload, command => {
        const unit = resolveUnit(command.payload.unitId);
        if (!unit || unit.isDead) return false;
        systems.workerEconomy?.clearJob(unit);
        const issued = unit.issueAttackMoveCommand(command.payload.x, command.payload.y, { append: !!command.payload.append });
        if (issued && typeof global.markComparisonUnitManualControl === 'function') {
          global.markComparisonUnitManualControl(unit);
        }
        return issued;
      });
      register(commandTypes.ATTACK, 'Order one unit to attack a target entity.', unitTarget, command => {
        const unit = resolveUnit(command.payload.unitId);
        const target = resolveCommandTarget(command.payload.targetKind, command.payload.targetId);
        if (!unit || unit.isDead || !target || target.isDead) return false;
        systems.workerEconomy?.clearJob(unit);
        unit.issueAttackCommand(target, { append: !!command.payload.append });
        return true;
      });
      register(commandTypes.MOUNT, 'Order one unit to mount a sheep.', {
        unitId: id,
        sheepId: id,
        append: optionalBoolean
      }, command => {
        const unit = resolveUnit(command.payload.unitId);
        const sheep = resolveCommandTarget('sheep', command.payload.sheepId);
        if (!unit || unit.isDead || !sheep) return false;
        systems.workerEconomy?.clearJob(unit);
        unit.issueMountCommand(sheep, { append: !!command.payload.append });
        return true;
      });
      register(commandTypes.PICK_UP, 'Order one unit to pick up a target world item.', unitTarget, command => {
        const unit = resolveUnit(command.payload.unitId);
        const item = resolveCommandTarget(command.payload.targetKind, command.payload.targetId);
        return !!unit && !unit.isDead && !!item && unit.issuePickupCommand(item);
      });
      register(commandTypes.DROP, 'Order one unit to drop its carried item at a world point.', movePayload, command => {
        const unit = resolveUnit(command.payload.unitId);
        return !!unit && !unit.isDead && unit.issueDropItemCommand(command.payload.x, command.payload.y);
      });
      register(commandTypes.FIRE_STANCE, 'Change a unit fire-stance policy.', {
        unitId: id,
        stance: { type: 'string', values: ['attack_at_will', 'hold_fire'] }
      }, command => {
        const unit = resolveUnit(command.payload.unitId);
        if (!unit || unit.isDead) return false;
        unit.setFireStance(command.payload.stance);
        return true;
      });
      register(commandTypes.COOK, 'Start a sheep roast healing action.', {
        sheepId: id,
        team: 'string'
      }, command => {
        const sheep = resolveCommandTarget('sheep', command.payload.sheepId);
        if (!sheep) return false;
        return !!systems.cooking.start({
          sheep,
          team: command.payload.team,
          removeSheep: removeSheepFromMap,
          tileSize
        });
      });
      register(commandTypes.WORKER_GATHER, 'Order a worker to gather a resource target.', {
        unitId: id,
        targetId: id,
        targetKind: 'string',
        resourceType: { type: 'string', values: ['gold', 'stone', 'wood', 'food'] }
      }, command => {
        const unit = resolveUnit(command.payload.unitId);
        const target = resolveCommandTarget(command.payload.targetKind, command.payload.targetId);
        if (!unit || !target) return false;
        return !!systems.workerEconomy?.startGather(unit, target, command.payload.resourceType);
      });
      register(commandTypes.WORKER_BUILD, 'Order a worker to construct a building.', {
        unitId: id,
        buildingType: 'string',
        ...worldPoint,
        tileX: { type: 'number', required: false, integer: true },
        tileY: { type: 'number', required: false, integer: true }
      }, command => {
        const unit = resolveUnit(command.payload.unitId);
        if (!unit) return false;
        return !!systems.workerEconomy?.startBuild(
          unit,
          command.payload.buildingType,
          command.payload.x,
          command.payload.y,
          {
            tileX: command.payload.tileX,
            tileY: command.payload.tileY
          }
        );
      });
      register(commandTypes.HOUSE_ENTER, 'Order one unit to enter a house through its door.', {
        unitId: id,
        houseId: id,
        append: optionalBoolean
      }, command => {
        const unit = resolveUnit(command.payload.unitId);
        const house = resolveCommandTarget('house', command.payload.houseId);
        if (!unit || !house || typeof commandUnitIntoHouse !== 'function') return false;
        return commandUnitIntoHouse(unit, house, !!command.payload.append);
      });
      register(commandTypes.HOUSE_EXIT, 'Order one unit to exit a house toward a world point.', movePayload, command => {
        const unit = resolveUnit(command.payload.unitId);
        if (!unit || typeof commandUnitOutOfHouse !== 'function') return false;
        return commandUnitOutOfHouse(unit, command.payload.x, command.payload.y, !!command.payload.append);
      });
      register(commandTypes.HOUSE_BURN, 'Start burning a target house.', {
        houseId: id
      }, command => {
        const house = resolveCommandTarget('house', command.payload.houseId);
        if (!house || typeof startBurningHouse !== 'function') return false;
        return startBurningHouse(house);
      });
      register(commandTypes.CASTLE_UPGRADE, 'Upgrade a friendly castle with a king.', {
        kingId: id,
        buildingId: id
      }, command => {
        const king = resolveUnit(command.payload.kingId);
        const building = resolveBuilding(command.payload.buildingId);
        return !!systems.castleUpgrades?.upgrade(building, king);
      });
      register(commandTypes.BUILDING_LIFT_OFF, 'Lift a mobile building into flight.', {
        buildingId: id
      }, command => {
        const building = resolveBuilding(command.payload.buildingId);
        return !!systems.buildingMobility?.liftOff(building);
      });
      register(commandTypes.BUILDING_RELOCATE, 'Order a flying mobile building to shift to a world point.', {
        buildingId: id,
        ...worldPoint
      }, command => {
        const building = resolveBuilding(command.payload.buildingId);
        return !!systems.buildingMobility?.relocate(building, command.payload.x, command.payload.y);
      });
      register(commandTypes.BUILDING_LAND, 'Land a flying mobile building at its current location.', {
        buildingId: id
      }, command => {
        const building = resolveBuilding(command.payload.buildingId);
        return !!systems.buildingMobility?.land(building);
      });
    }

    return Object.freeze({
      registerAll,
      resolveUnit,
      resolveBuilding,
      resolveCommandTarget
    });
  }

  app.commands.gameplayHandlers = Object.freeze({
    createRegistrar
  });
})(window);
