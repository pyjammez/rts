(function registerThreeSceneBootstrap(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createSceneRuntime(options = {}) {
    const THREE = options.THREE;
    const canvas = options.canvas;
    if (!THREE || !canvas) return null;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias !== false,
      alpha: false,
      powerPreference: 'high-performance'
    });
    const maxPixelRatio = Number.isFinite(Number(options.maxPixelRatio)) ? Number(options.maxPixelRatio) : 1;
    renderer.setPixelRatio(Math.min(options.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = options.shadows !== false;
    renderer.shadowMap.type = options.shadowType || THREE.BasicShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8aa5a0);
    scene.fog = new THREE.FogExp2(0x91aaa4, 0.0095);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.up.set(0, 1, 0);

    const hemisphere = new THREE.HemisphereLight(0xf0f7ff, 0x4f6339, 1.75);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe3b2, options.shadows === false ? 2.3 : 2.8);
    sun.position.set(-28, 42, 24);
    sun.castShadow = options.shadows !== false;
    const shadowMapSize = Math.max(256, Math.floor(Number(options.shadowMapSize || 768)));
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    sun.shadow.camera.left = -34;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    scene.add(sun.target);

    const staticGroup = new THREE.Group();
    staticGroup.name = 'static-world';
    const dynamicGroup = new THREE.Group();
    dynamicGroup.name = 'dynamic-entities';
    scene.add(staticGroup, dynamicGroup);

    return {
      renderer,
      scene,
      camera,
      staticGroup,
      dynamicGroup,
      raycaster: new THREE.Raycaster(),
      groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    };
  }

  app.rendering.threeSceneBootstrap = Object.freeze({
    createSceneRuntime,
    describe() {
      return {
        schemaVersion: 1,
        methods: ['createSceneRuntime']
      };
    }
  });

  app.diagnostics?.register?.('three-scene-bootstrap', () => app.rendering.threeSceneBootstrap.describe());
})(globalThis);
