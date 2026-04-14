class EntityManager {
  constructor() {
    this.entities = new Map();
  }

  upsertUnit(unit) {
    if (!unit || typeof unit.id === 'undefined') return;
    const existing = this.entities.get(unit.id);
    if (existing) {
      existing.unit = unit;
      existing.alive = !unit.isDead;
      return;
    }

    this.entities.set(unit.id, {
      id: unit.id,
      type: 'unit',
      unit,
      alive: !unit.isDead
    });
  }

  removeUnitById(id) {
    this.entities.delete(id);
  }

  syncUnits(units) {
    const seen = new Set();
    for (const unit of units) {
      this.upsertUnit(unit);
      seen.add(unit.id);
    }

    for (const [id] of this.entities.entries()) {
      if (!seen.has(id)) {
        this.entities.delete(id);
      }
    }
  }

  getUnits() {
    const result = [];
    for (const entity of this.entities.values()) {
      if (entity.type !== 'unit') continue;
      result.push(entity.unit);
    }
    return result;
  }

  getAliveUnits() {
    const result = [];
    for (const entity of this.entities.values()) {
      if (entity.type !== 'unit') continue;
      if (entity.unit.isDead) continue;
      result.push(entity.unit);
    }
    return result;
  }
}

window.entityManager = window.entityManager || new EntityManager();

