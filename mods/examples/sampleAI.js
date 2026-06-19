export function chooseAction(unit, world) {
  // Example AI hook: basic random walk
  return { type: 'move', dx: Math.random()-0.5, dy: Math.random()-0.5 };
}
