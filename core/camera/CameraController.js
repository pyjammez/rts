(function registerCameraController(global) {
  const app = global.OpenRTS;
  if (!app) return;

  app.camera = app.camera || {};

  function optionalFunction(value, fallback) {
    return typeof value === 'function' ? value : fallback;
  }

  function createCameraController(deps = {}) {
    const camera = deps.camera || {
      x: 0,
      y: 0,
      speed: 700,
      edgeScrollMargin: 24,
      zoom: 1,
      minZoom3D: 0.22,
      maxZoom: 2.5,
      viewportWidth: 0,
      viewportHeight: 0
    };
    const input = deps.inputState || {};
    const canvas = deps.canvas || { width: camera.viewportWidth || 0, height: camera.viewportHeight || 0 };
    const tileSize = Number(deps.tileSize) || 32;
    const getMapWidthPx = optionalFunction(deps.getMapWidthPx, () => 0);
    const getMapHeightPx = optionalFunction(deps.getMapHeightPx, () => 0);
    const use3DRenderer = optionalFunction(deps.use3DRenderer, () => false);
    const refresh3DCameraMatrices = optionalFunction(deps.refresh3DCameraMatrices, () => {});
    const get3DWorldPoint = optionalFunction(deps.get3DWorldPoint, () => null);
    const documentRef = deps.document || global.document;
    const getComputedStyleRef = deps.getComputedStyle || global.getComputedStyle || (() => ({ display: 'none' }));

    function is3DActive() {
      return !!use3DRenderer();
    }

    function getCommandBarEdge() {
      const commandBar = documentRef?.querySelector?.('.command-bar');
      const commandBarRect = commandBar?.getBoundingClientRect?.();
      const commandBarVisible = !!commandBarRect &&
        commandBarRect.width > 0 &&
        commandBarRect.height > 0 &&
        getComputedStyleRef(commandBar).display !== 'none';
      return commandBarVisible
        ? Math.max(camera.edgeScrollMargin, Math.min(camera.viewportHeight, commandBarRect.top))
        : camera.viewportHeight;
    }

    function getEdgeScrollDirection() {
      if (!input.mouseInside && !input.southEdgeActive) {
        return { x: 0, y: 0 };
      }

      let x = 0;
      let y = 0;
      const bottomEdge = getCommandBarEdge();
      const bottomScrollMargin = Math.max(camera.edgeScrollMargin, 40);

      if (input.mouseInside) {
        if (input.mouseX <= camera.edgeScrollMargin) x -= 1;
        if (input.mouseX >= camera.viewportWidth - camera.edgeScrollMargin) x += 1;
        if (input.mouseY <= camera.edgeScrollMargin) y -= 1;
        if (input.mouseY >= bottomEdge - bottomScrollMargin && input.mouseY <= bottomEdge) y += 1;
      }
      if (input.southEdgeActive) y = 1;

      return { x, y };
    }

    function getMinZoomToFitMap() {
      const mapWidth = Math.max(1, getMapWidthPx());
      const mapHeight = Math.max(1, getMapHeightPx());
      const fitX = canvas.width / mapWidth;
      const fitY = canvas.height / mapHeight;
      const flatFit = Math.min(fitX, fitY);

      if (is3DActive()) {
        return Math.min(flatFit, camera.minZoom3D);
      }

      return flatFit;
    }

    function getCameraOverscan() {
      const visibleWorldWidth = camera.viewportWidth / camera.zoom;
      const visibleWorldHeight = camera.viewportHeight / camera.zoom;

      if (is3DActive()) {
        return {
          x: Math.max(tileSize * 6, visibleWorldWidth * 0.28),
          y: Math.max(tileSize * 9, visibleWorldHeight * 0.42)
        };
      }

      return {
        x: Math.max(tileSize * 2, visibleWorldWidth * 0.08),
        y: Math.max(tileSize * 2, visibleWorldHeight * 0.08)
      };
    }

    function clampCameraPosition() {
      const visibleWorldWidth = camera.viewportWidth / camera.zoom;
      const visibleWorldHeight = camera.viewportHeight / camera.zoom;
      const mapWidth = getMapWidthPx();
      const mapHeight = getMapHeightPx();
      const overscan = getCameraOverscan();
      const minX = -overscan.x;
      const maxX = mapWidth - visibleWorldWidth + overscan.x;
      const minY = -overscan.y;
      const maxY = mapHeight - visibleWorldHeight + overscan.y;

      if (minX > maxX) {
        camera.x = (minX + maxX) * 0.5;
      } else {
        camera.x = Math.max(minX, Math.min(camera.x, maxX));
      }

      if (minY > maxY) {
        camera.y = (minY + maxY) * 0.5;
      } else {
        camera.y = Math.max(minY, Math.min(camera.y, maxY));
      }
    }

    function screenToWorld(screenX, screenY) {
      if (is3DActive()) {
        const point = get3DWorldPoint(screenX, screenY);
        if (point) return point;
      }

      return {
        x: screenX / camera.zoom + camera.x,
        y: screenY / camera.zoom + camera.y
      };
    }

    function zoomAtScreenPoint(screenX, screenY, zoomFactor) {
      const is3D = is3DActive();
      if (is3D) refresh3DCameraMatrices();

      const worldBefore = screenToWorld(screenX, screenY);
      const minZoom = getMinZoomToFitMap();
      const nextZoom = Math.max(minZoom, Math.min(camera.zoom * zoomFactor, camera.maxZoom));

      if (nextZoom === camera.zoom) return;
      camera.zoom = nextZoom;

      if (is3D && worldBefore) {
        refresh3DCameraMatrices();
        const worldAfter = screenToWorld(screenX, screenY);

        if (worldAfter) {
          camera.x += worldBefore.x - worldAfter.x;
          camera.y += worldBefore.y - worldAfter.y;
          clampCameraPosition();
          refresh3DCameraMatrices();
          return;
        }
      }

      camera.x = worldBefore.x - screenX / camera.zoom;
      camera.y = worldBefore.y - screenY / camera.zoom;
      clampCameraPosition();
    }

    function zoomToFullMap() {
      camera.zoom = getMinZoomToFitMap();
      camera.x = getMapWidthPx() * 0.5 - (camera.viewportWidth / camera.zoom) * 0.5;
      camera.y = getMapHeightPx() * 0.5 - (camera.viewportHeight / camera.zoom) * 0.5;
      clampCameraPosition();
    }

    function update(dt) {
      camera.viewportWidth = canvas.width;
      camera.viewportHeight = canvas.height;

      const minZoom = getMinZoomToFitMap();
      if (camera.zoom < minZoom) {
        camera.zoom = minZoom;
      }

      const edge = getEdgeScrollDirection();
      const moveX = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) + edge.x;
      const moveY = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) + edge.y;

      if (moveX !== 0 || moveY !== 0) {
        const length = Math.hypot(moveX, moveY);
        camera.x += (moveX / length) * camera.speed * dt;
        camera.y += (moveY / length) * camera.speed * dt;
      }

      clampCameraPosition();
    }

    return Object.freeze({
      camera,
      update,
      screenToWorld,
      zoomAtScreenPoint,
      zoomToFullMap,
      clampCameraPosition,
      getEdgeScrollDirection,
      getMinZoomToFitMap,
      getCameraOverscan,
      describe: () => ({
        x: camera.x,
        y: camera.y,
        zoom: camera.zoom,
        viewportWidth: camera.viewportWidth,
        viewportHeight: camera.viewportHeight,
        minZoomToFitMap: getMinZoomToFitMap(),
        overscan: getCameraOverscan()
      })
    });
  }

  app.camera.controller = Object.freeze({
    createCameraController
  });
})(window);
