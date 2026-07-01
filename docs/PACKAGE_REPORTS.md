# Package Reports

Open RTS game packages are static folders under `games/`, so every package should be inspectable without a build step, database, or multiplayer server. The package report system gives mod authors a quick capability and health summary for each package before it is selected in the browser or uploaded to S3.

## Browser Runtime

`game/config/PackageReportService.js` exposes `OpenRTS.config.packageReports`.

Useful APIs:

- `createPackageReport(gamePackage)` summarizes one loaded package.
- `createIndexReport(index, loadedPackages)` summarizes the static `games/index.json` catalog.
- `validateCrossReferences(content)` checks unit, weapon, faction, building, and mode references inside a package.

When `ContentPackLoader.js` loads a game package, it attaches `gamePackage.report`. `OpenRTS.config.gamePackages.describe()` also includes report summaries for diagnostics panels and future package browser UI.

## CLI

Run:

```sh
npm run report:packages
```

For machine-readable output:

```sh
node tools/package-report.mjs --json
```

The report lists package style, resource model, unit/building/weapon/mode counts, major capabilities such as workers, air units, and defensive buildings, plus diagnostics.

Package reports also use `OpenRTS.config.contentSchemas` when it is loaded. See `docs/CONTENT_SCHEMAS.md` for the catalog contracts and `npm run schema:dump` for a CLI reference.

## Why This Matters

A professional moddable RTS engine needs packages to be understandable and testable as data. Reports make it easier to answer:

- Does this package define its own economy?
- Does it include workers, air units, defenses, factions, and modes?
- Are units referencing missing weapons?
- Are factions referencing missing units or buildings?
- Is the package complete enough to be shown in the package browser?

This is intentionally static-hosting friendly. A modder can edit JSON files, refresh the browser, and run a local report without installing a compiler or bundler.
