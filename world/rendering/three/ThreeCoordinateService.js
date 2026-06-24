(function registerThreeCoordinateService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function worldToScene(worldX, worldY, options = {}) {
    const scale = Number(options.scale) || 1;
    const mapWidth = Number(options.mapWidth) || 0;
    const mapHeight = Number(options.mapHeight) || 0;
    return {
      x: (worldX - mapWidth * 0.5) * scale,
      z: (worldY - mapHeight * 0.5) * scale
    };
  }

  function sceneToWorld(point, options = {}) {
    const scale = Number(options.scale) || 1;
    const mapWidth = Number(options.mapWidth) || 0;
    const mapHeight = Number(options.mapHeight) || 0;
    return {
      x: point.x / scale + mapWidth * 0.5,
      y: point.z / scale + mapHeight * 0.5
    };
  }

  function projectWorldToScreen(worldX, worldY, height = 0, options = {}) {
    const THREE = options.THREE;
    const camera = options.camera;
    const canvas = options.canvas;
    if (!THREE || !camera || !canvas) return null;
    const point = worldToScene(worldX, worldY, options);
    const projected = new THREE.Vector3(point.x, height, point.z).project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      x: (projected.x * 0.5 + 0.5) * canvas.width,
      y: (-projected.y * 0.5 + 0.5) * canvas.height
    };
  }

  function screenToWorld(screenX, screenY, options = {}) {
    const THREE = options.THREE;
    const raycaster = options.raycaster;
    const camera = options.camera;
    const canvas = options.canvas;
    const groundPlane = options.groundPlane;
    if (!THREE || !raycaster || !camera || !canvas || !groundPlane) return null;
    const pointer = new THREE.Vector2(screenX / canvas.width * 2 - 1, 1 - screenY / canvas.height * 2);
    raycaster.setFromCamera(pointer, camera);
    const intersection = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, intersection)) return null;
    return sceneToWorld(intersection, options);
  }

  app.rendering.threeCoordinates = Object.freeze({
    worldToScene,
    sceneToWorld,
    projectWorldToScreen,
    screenToWorld,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['worldToScene', 'sceneToWorld', 'projectWorldToScreen', 'screenToWorld']
      };
    }
  });

  app.diagnostics?.register?.('three-coordinates', () => app.rendering.threeCoordinates.describe());
})(globalThis);
