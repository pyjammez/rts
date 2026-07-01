(function registerUnitCommandStateService(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  function resetForImmediateCommand(unit, {
    clearAttack = true,
    clearAutoEngage = true,
    clearMount = true,
    clearItems = true
  } = {}) {
    unit.commandQueue = [];
    unit.clearMovementState();
    if (clearItems) unit.clearPendingItemAction();
    if (clearAttack) {
      unit.attackOrderTarget = null;
      unit.currentEnemy = null;
    }
    if (clearAutoEngage) unit.autoEngageTarget = null;
    if (clearMount) unit.clearMountTarget();
  }

  function executeOrQueue(unit, command, {
    append = false,
    maxQueue = 16
  } = {}) {
    if (!append) return unit.executeCommand(command);
    const hasActiveMove = !!unit.target || unit.hasActivePath();
    if (!hasActiveMove) return unit.executeCommand(command);
    if (unit.commandQueue.length >= maxQueue) return false;
    unit.commandQueue.push(command);
    return true;
  }

  app.entities.unitCommandState = Object.freeze({
    resetForImmediateCommand,
    executeOrQueue
  });
})(globalThis);
