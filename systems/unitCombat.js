function updateUnitCombatSystem(units, dt) {
  for (const unit of units) {
    processUnitCombat(unit, dt);

    if (window.UnitComponents && window.UnitComponents.combat) {
      const combat = window.UnitComponents.combat.get(unit.id);
      if (combat) {
        combat.hp = unit.hp;
        combat.maxHp = unit.maxHp;
        combat.fireCooldown = unit.fireCooldown;
        combat.isDead = unit.isDead;
      }
    }
  }
}

