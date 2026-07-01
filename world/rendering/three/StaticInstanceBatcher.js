(function registerStaticInstanceBatcher(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createDummy(THREE) {
    if (THREE?.Object3D) return new THREE.Object3D();
    return {
      position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      rotation: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      scale: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      matrix: {},
      updateMatrix() {
        this.matrix = {
          position: { ...this.position },
          rotation: { ...this.rotation },
          scale: { ...this.scale }
        };
      }
    };
  }

  function createInstancedMeshBatch({
    THREE,
    geometry,
    material,
    instances = [],
    name = 'static-instance-batch',
    castShadow = true,
    receiveShadow = true,
    userData = {}
  } = {}) {
    if (!THREE?.InstancedMesh || !geometry || !material || !instances.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    const dummy = createDummy(THREE);
    instances.forEach((instance, index) => {
      dummy.position.set(instance.x || 0, instance.y || 0, instance.z || 0);
      dummy.rotation.set(instance.rotationX || 0, instance.rotationY || 0, instance.rotationZ || 0);
      dummy.scale.set(instance.scaleX ?? 1, instance.scaleY ?? 1, instance.scaleZ ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData = { ...(mesh.userData || {}), ...userData, instanceCount: instances.length };
    return mesh;
  }

  function describeBatch(mesh) {
    return {
      schemaVersion: 1,
      name: mesh?.name || '',
      count: mesh?.count || mesh?.userData?.instanceCount || 0,
      userData: { ...(mesh?.userData || {}) }
    };
  }

  app.rendering.staticInstanceBatcher = Object.freeze({
    createInstancedMeshBatch,
    describeBatch
  });
})(globalThis);
