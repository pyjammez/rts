(function registerWildlifeSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before wildlifeSystem.js');

  function setHeading(animal, dx, dy) {
    if (!animal || Math.hypot(dx, dy) < 0.001) return;
    animal.heading = Math.atan2(dy, dx);
    animal.facing = dx >= 0 ? 1 : -1;
  }

  function moveAnimal(animal, dt, radiusScale, canMove) {
    const distance = (animal.speed || 10) * dt;
    const nextX = animal.x + Math.cos(animal.wanderAngle || 0) * distance;
    const nextY = animal.y + Math.sin(animal.wanderAngle || 0) * distance;
    if (!canMove(nextX, nextY, animal.size * radiusScale)) return false;

    const oldX = animal.x;
    const oldY = animal.y;
    animal.x = nextX;
    animal.y = nextY;
    setHeading(animal, animal.x - oldX, animal.y - oldY);
    return true;
  }

  function updateSheep(dt, sheep, { random, isWalkable }) {
    for (const animal of Array.isArray(sheep) ? sheep : []) {
      if (animal.isDead || animal.isMounted || animal.reservedByUnitId) continue;
      animal.wanderTimer -= dt;
      animal.grazeTimer -= dt;

      if (animal.wanderTimer <= 0) {
        animal.wanderAngle = (animal.wanderAngle || 0) + (random() - 0.5) * Math.PI * 0.95;
        animal.wanderTimer = 0.9 + random() * 2.4;
        animal.grazeTimer = random() < 0.38 ? 0.8 + random() * 1.8 : 0;
      }
      if (animal.grazeTimer > 0) continue;

      if (!moveAnimal(animal, dt, 0.55, isWalkable)) {
        animal.wanderAngle = (animal.wanderAngle || 0) + Math.PI * (0.65 + random() * 0.7);
        animal.wanderTimer = 0.25 + random() * 0.8;
        animal.grazeTimer = 0.2 + random() * 0.8;
      }
    }
  }

  function updateDucks(dt, ducks, { random, isDuckPreferred }) {
    for (const animal of Array.isArray(ducks) ? ducks : []) {
      if (animal.isDead) continue;
      animal.wanderTimer -= dt;
      if (animal.wanderTimer <= 0) {
        animal.wanderAngle = (animal.wanderAngle || 0) + (random() - 0.5) * Math.PI * 0.85;
        animal.wanderTimer = 0.7 + random() * 2;
      }

      if (!moveAnimal(animal, dt, 0, (x, y) => isDuckPreferred(x, y))) {
        animal.wanderAngle = (animal.wanderAngle || 0) + Math.PI * (0.7 + random() * 0.6);
        animal.wanderTimer = 0.2 + random() * 0.7;
      }
    }
  }

  function updateHorses(dt, horses, { random, isWalkable }) {
    for (const animal of Array.isArray(horses) ? horses : []) {
      if (animal.isDead) continue;
      animal.wanderTimer -= dt;
      animal.grazeTimer -= dt;

      if (animal.wanderTimer <= 0) {
        animal.wanderAngle = (animal.wanderAngle || 0) + (random() - 0.5) * Math.PI * 0.8;
        animal.wanderTimer = 0.8 + random() * 2.5;
        animal.grazeTimer = random() < 0.3 ? 0.7 + random() * 1.6 : 0;
      }
      if (animal.grazeTimer > 0) continue;

      if (!moveAnimal(animal, dt, 0.45, isWalkable)) {
        animal.wanderAngle = (animal.wanderAngle || 0) + Math.PI * (0.6 + random() * 0.8);
        animal.wanderTimer = 0.3 + random() * 0.8;
        animal.grazeTimer = 0.2 + random() * 0.8;
      }
    }
  }

  function update(dt, state, dependencies) {
    updateSheep(dt, state.sheep, dependencies);
    updateDucks(dt, state.ducks, dependencies);
    updateHorses(dt, state.horses, dependencies);
  }

  app.systems.wildlife = Object.freeze({ update, updateSheep, updateDucks, updateHorses, setHeading });
})(globalThis);
