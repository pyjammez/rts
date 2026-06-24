(function registerThreeCameraSyncService(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function syncCamera(options = {}) {
    const sceneCamera = options.sceneCamera;
    const renderer = options.renderer;
    const canvas = options.canvas;
    const gameCamera = options.gameCamera;
    const coordinates = options.coordinates || app.rendering.threeCoordinates;
    if (!sceneCamera || !renderer || !canvas || !gameCamera || !coordinates) return false;

    const width = canvas.clientWidth || canvas.width;
    const heightPx = canvas.clientHeight || canvas.height;
    if (
      canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
      canvas.height !== Math.round(heightPx * renderer.getPixelRatio())
    ) {
      renderer.setSize(width, heightPx, false);
    }
    sceneCamera.aspect = Math.max(1, width) / Math.max(1, heightPx);
    const centerWorldX = gameCamera.x + gameCamera.viewportWidth / gameCamera.zoom * 0.5;
    const centerWorldY = gameCamera.y + gameCamera.viewportHeight / gameCamera.zoom * 0.5;
    const target = coordinates.worldToScene(centerWorldX, centerWorldY, options);
    const zoomForView = Math.max(gameCamera.minZoom3D || 0.22, gameCamera.zoom);
    const cameraHeight = 25 / zoomForView;
    const distance = 20 / zoomForView;
    sceneCamera.position.set(target.x, cameraHeight, target.z + distance);
    sceneCamera.lookAt(target.x, 0, target.z);
    sceneCamera.updateProjectionMatrix();
    sceneCamera.updateMatrixWorld();
    return true;
  }

  app.rendering.threeCameraSync = Object.freeze({
    syncCamera,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['syncCamera']
      };
    }
  });

  app.diagnostics?.register?.('three-camera-sync', () => app.rendering.threeCameraSync.describe());
})(globalThis);
