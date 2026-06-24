# Porting Notes

Design choices to aid porting to engines like Unity/Unreal:

- Keep `Entity`, `Component`, `System` names matching common engine terms.
- Keep data in JSON to allow direct import.
- Implement renderer/input adapters separately.

## Static Game Packages

Browser-hosted RTS variants should live under `games/<package-id>/` with a `manifest.json`. The manifest is the portable contract for S3 hosting: lowercase id, semantic version, optional engine version, safe relative file paths, dependencies, conflicts, provided capabilities, tags, and a deterministic fingerprint.

Record the package-lock fingerprint in saves, replays, multiplayer lobbies, and bug reports so two players can prove they loaded the same modded rules and content.
