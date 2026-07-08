# Game Packages

These folders are static game-package examples for Open RTS. Each package can be loaded from S3-compatible static hosting by adding `?game=<package-id>` to the game URL.

- `index.json`: S3-friendly package catalog used by the browser to discover available packages without directory listing.
- `spacesiege` (`StarSiege`): original sci-fi RTS package inspired by mineral/gas/supply-style games.
- `battleforge` (`WarSiege`): original fantasy RTS package inspired by gold/lumber/food fantasy games.
- `modern_warlord`: original modern combined-arms RTS package inspired by supply/power commander games.
- `ultimate_extinction` (`Total Destruction`): original large-scale robot RTS package inspired by metal/energy robot-war games.
- `era_of_kingdoms`: original historical RTS package inspired by food/wood/gold/stone empire games.

These packages intentionally avoid copied names, lore, unit names, art, audio, or data values from commercial games. They demonstrate how similar RTS styles can be represented through original JSON definitions.

## Modder Checks

Run the full static validation suite:

```sh
npm run validate
```

Generate a package capability report:

```sh
npm run report:packages
```

Inspect the supported content schema fields:

```sh
npm run schema:dump
```

Audit 3D render model contracts:

```sh
npm run audit:render
node tools/render-audit.mjs --game spacesiege
```

The report summarizes resources, unit counts, building counts, weapons, game modes, air/worker/defense capabilities, and package diagnostics. See `docs/PACKAGE_REPORTS.md` for the runtime and CLI APIs.
