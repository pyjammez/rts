/* chatgpt suggests
├── main.js                  # Entry point – initializes game, starts loop
├── gameLoop.js             # requestAnimationFrame loop
├── input.js                # Handles mouse/keyboard events
├── map.js                  # Map data, rendering, and fog of war
├── unit.js                 # Unit class (movement, attack, render, etc.)
├── building.js             # Building class (resource drop-off, production)
├── player.js               # Player state (resources, units, etc.)
├── ai.js                   # Enemy AI logic
├── renderer.js             # Handles canvas drawing, layers, etc.
├── physics.js              # Collision, movement resolution
├── sound.js                # Sound effect and music manager
├── state.js                # Game state management (win/loss conditions, UI states)
├── utils.js                # Math helpers, A* pathfinding, etc.
└── constants.js            # Game constants (unit sizes, speeds, cost)
*/

function update(dt) {
  units.forEach(unit => {
    if (unit.target) {
      //unit.moveToward(unit.target.x, unit.target.y, dt);
      unit.moveAlongPath(dt);
    }
  });

  removeCollisions(units);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderMap();
  renderUnits();
  renderSelectionBox();
}

requestAnimationFrame(gameLoop);