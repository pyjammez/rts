# Porting Notes

Design choices to aid porting to engines like Unity/Unreal:

- Keep `Entity`, `Component`, `System` names matching common engine terms.
- Keep data in JSON to allow direct import.
- Implement renderer/input adapters separately.
