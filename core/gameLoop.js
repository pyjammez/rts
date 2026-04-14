const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const MAX_STEPS_PER_FRAME = 5;

let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }

  let frameTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  frameTime = Math.min(frameTime, MAX_FRAME_TIME);
  accumulator += frameTime;

  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
    update(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps++;
  }

  render();
  requestAnimationFrame(gameLoop);
}