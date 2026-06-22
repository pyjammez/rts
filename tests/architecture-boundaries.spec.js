import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('player input cannot bypass the authoritative command stream', () => {
  const input = fs.readFileSync(new URL('../systems/input.js', import.meta.url), 'utf8');
  const hud = fs.readFileSync(new URL('../ui/hud.js', import.meta.url), 'utf8');
  const forbidden = /\.issue(?:Move|Attack|Mount|Pickup|Drop)Command\s*\(|\.setFireStance\s*\(/;

  assert.doesNotMatch(input, forbidden);
  assert.doesNotMatch(hud, forbidden);
  assert.match(input, /OpenRTS\.commands/);
  assert.match(hud, /OpenRTS\.commands/);
});
