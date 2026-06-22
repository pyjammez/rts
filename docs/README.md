# Open RTS

This repository is a lightweight, extensible RTS platform intended for building and modding RTS-style matches.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the active runtime, ownership boundaries, public API, and migration roadmap.

## Development

```bash
npm run serve
npm run validate
npm run check
```

The authoritative modding files live under `assets/data/`. The game remains build-free and deploys directly to static hosting.

## 3D Rendering

The game uses a locally bundled Three.js runtime in `engine/three-runtime/`. It runs directly in the browser and does not require npm, a compiler, or a build step for development or S3 deployment.

`world/renderer3d.js` owns the scene, camera, lighting, terrain, procedural models, shadows, and 2D HUD projection. The global `loadRTSModel(url)` helper loads `.glb` and `.gltf` assets through `GLTFLoader`, configures their meshes for scene shadows, and returns the loaded Three.js scene data.
