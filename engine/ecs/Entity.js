export default class Entity {
  constructor(id) {
    this.id = id;
    this.components = new Map();
  }

  addComponent(component) {
    this.components.set(component.constructor.name, component);
  }

  getComponent(name) {
    return this.components.get(name);
  }

  removeComponent(name) {
    this.components.delete(name);
  }

  serialize() {
    return {
      id: this.id,
      components: Array.from(this.components.keys()),
    };
  }
}
