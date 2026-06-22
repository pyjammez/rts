(function registerRendererRegistry(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before RendererRegistry.js');

  class RendererRegistry {
    constructor() {
      this.renderers = [];
      this.ids = new Set();
      this.activeId = null;
    }

    register({ id, priority = 0, available = () => true, render }) {
      if (typeof id !== 'string' || !id) throw new TypeError('Renderer id must be a non-empty string');
      if (typeof render !== 'function') throw new TypeError(`Renderer "${id}" requires a render function`);
      if (this.ids.has(id)) throw new Error(`Renderer already registered: ${id}`);

      const renderer = Object.freeze({ id, priority, available, render });
      this.renderers.push(renderer);
      this.renderers.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
      this.ids.add(id);
      return renderer;
    }

    render(context) {
      for (const renderer of this.renderers) {
        if (!renderer.available(context)) continue;
        if (renderer.render(context) === false) continue;
        this.activeId = renderer.id;
        return renderer.id;
      }
      this.activeId = null;
      return null;
    }

    describe() {
      return Object.freeze({
        activeId: this.activeId,
        renderers: this.renderers.map(renderer => renderer.id)
      });
    }
  }

  app.RendererRegistry = RendererRegistry;
  app.rendering = app.rendering instanceof RendererRegistry
    ? app.rendering
    : new RendererRegistry();
  app.runtime?.registerService('rendering', app.rendering);
})(globalThis);
