(function registerMeshPrimitiveFactory(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createFactory({ THREE, geometryCache }) {
    if (!THREE) throw new Error('MeshPrimitiveFactory requires THREE');
    if (!geometryCache) throw new Error('MeshPrimitiveFactory requires a geometry cache');

    function geometry(key, factory) {
      return geometryCache.get(key, factory);
    }

    function addMesh(parent, mesh, x, y, z, castShadow = true, receiveShadow = true) {
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    }

    function addBox(parent, x, y, z, width, height, depth, material) {
      const key = `box:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
      const mesh = new THREE.Mesh(geometry(key, () => new THREE.BoxGeometry(width, height, depth)), material);
      return addMesh(parent, mesh, x, y + height * 0.5, z);
    }

    function addCylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments = 16) {
      const key = `cyl:${radiusTop}:${radiusBottom}:${height}:${segments}`;
      const mesh = new THREE.Mesh(
        geometry(key, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)),
        material
      );
      return addMesh(parent, mesh, x, y + height * 0.5, z);
    }

    function addSphere(parent, x, y, z, radius, material, scale = null) {
      const mesh = new THREE.Mesh(
        geometry('sphere:16:10', () => new THREE.SphereGeometry(1, 16, 10)),
        material
      );
      mesh.scale.set(scale?.x || radius, scale?.y || radius, scale?.z || radius);
      return addMesh(parent, mesh, x, y, z);
    }

    return Object.freeze({ geometry, addMesh, addBox, addCylinder, addSphere });
  }

  app.rendering.meshPrimitives = Object.freeze({
    createFactory,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['createFactory']
      };
    }
  });

  app.diagnostics?.register?.('mesh-primitives', () => app.rendering.meshPrimitives.describe());
})(globalThis);
