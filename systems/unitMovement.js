function updateUnitMovementSystem(units, dt) {
  for (const unit of units) {
    processUnitMovement(unit, dt);

    if (window.UnitComponents && window.UnitComponents.transform) {
      const transform = window.UnitComponents.transform.get(unit.id);
      if (transform) {
        transform.x = unit.x;
        transform.y = unit.y;
      }
    }
  }
}

