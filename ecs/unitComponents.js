const UnitComponents = {
  transform: new Map(),
  movement: new Map(),
  combat: new Map(),
  render: new Map()
};

function syncUnitComponentsFromUnits(units) {
  const seen = new Set();

  for (const unit of units) {
    const id = unit.id;
    seen.add(id);

    UnitComponents.transform.set(id, {
      x: unit.x,
      y: unit.y,
      size: unit.size
    });

    UnitComponents.movement.set(id, {
      speed: unit.speed,
      hasPath: !!(unit.path && unit.path.length > 0)
    });

    UnitComponents.combat.set(id, {
      hp: unit.hp,
      maxHp: unit.maxHp,
      fireCooldown: unit.fireCooldown,
      team: unit.team,
      isDead: unit.isDead
    });

    UnitComponents.render.set(id, {
      selected: unit.selected,
      spriteFrame: unit.spriteFrame,
      facing: unit.spriteDirectionRow
    });
  }

  for (const map of Object.values(UnitComponents)) {
    for (const id of map.keys()) {
      if (!seen.has(id)) {
        map.delete(id);
      }
    }
  }
}

window.UnitComponents = UnitComponents;
window.syncUnitComponentsFromUnits = syncUnitComponentsFromUnits;

