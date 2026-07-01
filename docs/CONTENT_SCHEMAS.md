# Content Schemas

Open RTS supports static JSON packages, so mod authors need stable data contracts they can inspect without installing a compiler or bundler.

`game/config/ContentSchemaService.js` exposes `OpenRTS.config.contentSchemas` in the browser.

Useful APIs:

- `listSchemas()` returns every supported catalog schema.
- `describeSchema(schemaId)` returns required fields and field rules for one catalog.
- `validateRecord(schemaId, recordId, record)` validates one unit, weapon, building, faction, mode, or other record.
- `validateCatalog(schemaId, catalog)` validates a whole catalog object.
- `validatePackageContent(content)` validates every recognized catalog inside a loaded package.

## CLI

Print the supported fields:

```sh
npm run schema:dump
```

For machine-readable tooling:

```sh
node tools/schema-dump.mjs --json
```

## Current Catalogs

The schema service currently describes:

- `abilities`
- `weapons`
- `units`
- `buildings`
- `rulesets`
- `factions`
- `terrainPresets`
- `modes`

Unknown fields are warnings by default, because a moddable RTS engine should allow experimental data during development. Package reports call the schema service with unknown-field warnings disabled so reports stay focused on breakages such as missing required values, invalid ids, invalid movement types, and impossible numeric values.

## Design Rule

Engine systems should depend on documented schema fields before relying on ad hoc JSON fields. When a new gameplay feature becomes real engine behavior, add it to `ContentSchemaService.js`, update validation/tests, then consume it from runtime systems.
