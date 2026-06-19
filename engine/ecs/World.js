export default class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this.nextId = 1;
  }

  createEntity() {
    const Entity = require('./Entity').default;
    const e = new Entity(this.nextId++);
    this.entities.set(e.id, e);
    return e;
  }

  addSystem(system) {
    this.systems.push(system);
    if (typeof system.init === 'function') system.init(this);
  }

  update(dt) {
    for (const s of this.systems) {
      if (typeof s.update === 'function') s.update(this, dt);
    }
  }
}
