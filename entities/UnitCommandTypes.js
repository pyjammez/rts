(function registerUnitCommandTypes(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.entities = app.entities || {};

  app.entities.unitCommandTypes = Object.freeze({
    MAX_COMMAND_QUEUE: 16,
    types: Object.freeze({
      MOVE: 'move',
      ATTACK_UNIT: 'attack-unit',
      MOUNT_SHEEP: 'mount-sheep',
      PICK_UP_ITEM: 'pick-up-item',
      DROP_ITEM: 'drop-item'
    })
  });
})(globalThis);
