# 3D Render Asset Pipeline

Open RTS can run from S3 as plain JavaScript, but a professional moddable 3D RTS still needs a clear asset contract. The render asset audit layer checks whether game packages have the model metadata needed by the Three.js renderer before a match starts.

## Runtime Service

`world/rendering/three/RenderAssetAuditService.js` exposes:

```js
OpenRTS.rendering.renderAssetAudit
```

Useful APIs:

- `collectExpectedModels(definitions)` lists logical model ids expected by units and buildings.
- `normalizeModelAssets(assetManifest)` normalizes model entries from `assets/data/assets.json` or a package asset file.
- `normalizeFactoryList(factoryRegistry)` describes registered procedural/imported render factories.
- `validateModelAsset(asset)` validates one model contract.
- `createAudit({ definitions, assetManifest, factoryRegistry })` creates a full readiness report.

## CLI

Audit the core game:

```sh
npm run audit:render
```

Audit a package overlay:

```sh
node tools/render-audit.mjs --game spacesiege
```

Machine-readable output:

```sh
node tools/render-audit.mjs --game spacesiege --json
```

## Model Id Contract

Logical model ids should look like:

- `unit.worker`
- `unit.hover_tank`
- `building.castle`
- `building.power_plant`

Units and buildings declare `model` in their JSON. The renderer expects that to resolve to a logical id:

```json
{
  "hover_tank": {
    "name": "Hover Tank",
    "model": "hover_tank"
  }
}
```

That produces `unit.hover_tank`.

## Imported Model Contract

Imported model entries should include a URL and a fallback:

```json
{
  "models": {
    "unit.hover_tank": {
      "kind": "gltf",
      "renderer": "three",
      "url": "assets/models/hover_tank.glb",
      "fallback": "unit.worker",
      "scale": 1,
      "lods": [
        { "distance": 32, "url": "assets/models/hover_tank_lod1.glb" }
      ],
      "animations": {
        "idle": "Idle",
        "move": "Move",
        "attack": "Attack"
      }
    }
  }
}
```

The fallback keeps the game playable on static hosting even when an imported model path is wrong or unsupported.

## Why This Matters

This creates a bridge from current procedural Three.js placeholders to a future asset pipeline with GLB/GLTF models, LODs, animations, texture packs, and mod-supplied render factories. A veteran RTS developer would expect the engine to detect asset-contract problems before they become frame-time crashes.
