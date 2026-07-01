import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRTSScript } from './helpers/openRtsHarness.js';

function fakeContext() {
  const calls = [];
  const ctx = { calls };
  for (const method of ['clearRect', 'save', 'restore', 'strokeText', 'fillText', 'fillRect', 'strokeRect', 'beginPath', 'ellipse', 'stroke']) {
    ctx[method] = (...args) => calls.push([method, ...args]);
  }
  return ctx;
}

test('Three.js overlay draws selected health bars and projected command markers', () => {
  const context = loadOpenRTSScript('../../world/rendering/three/OverlayPass.js');
  const ctx = fakeContext();
  const heights = [];
  const projectWorld = (x, y, height) => {
    heights.push(height);
    return { x, y };
  };

  context.OpenRTS.rendering.threeOverlay.draw({
    ctx,
    canvas: { width: 800, height: 600 },
    buildings: [{ type: 'tower', x: 10, y: 20, hp: 100, maxHp: 200, selected: true, isDead: false }],
    units: [{ x: 30, y: 40, hp: 50, maxHp: 100, selected: true, isDead: false }],
    selectedObject: { x: 50, y: 60, hp: 20, maxHp: 40, objectType: 'obstacle', obstacleType: 1 },
    markers: [{ x: 70, y: 80, age: 0.25, duration: 1, startRadius: 4, endRadius: 20, color: 'red' }],
    projectWorld,
    towerType: 'tower',
    treeType: 1
  });

  assert.deepEqual(heights, [2.9, 1.2, 2.45, 0.08]);
  assert.equal(ctx.calls.filter(call => call[0] === 'clearRect').length, 1);
  assert.equal(ctx.calls.filter(call => call[0] === 'ellipse').length, 1);
  assert.equal(ctx.calls.filter(call => call[0] === 'fillRect').length, 6);
});
