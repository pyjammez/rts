// --- Units ---
const units = [];
let nextUnitId = 1;

const DEFAULT_UNIT_STATS = {
    hp: 100,
    speed: 100
};

function createUnit(team) {
    return new Unit({
        id: nextUnitId++,
        x: 0,
        y: 0,
        team,
        hp: DEFAULT_UNIT_STATS.hp,
        speed: DEFAULT_UNIT_STATS.speed
    });
}

function spawnInitialUnits() {
  // Clear existing units
  units.length = 0;
  nextUnitId = 1;

  // blue team
  for (let i = 0; i < 5; i++) {
    const unit = createUnit('blue');
    spawnUnitToRandomSpot(unit);
  }

  // red team
  for (let i = 0; i < 5; i++) {
    const unit = createUnit('red');
    spawnUnitToRandomSpot(unit);
  }
}

function spawnUnitToRandomSpot(unit) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const {x, y} = randomSpotOnMap();
        unit.x = x;
        unit.y = y;
    
        if (canSpawnAt(unit.x, unit.y)) {
            units.push(unit);
            break;
        }
    }
}

function spawnUnitForTeam(team) {
  if (team !== 'red' && team !== 'blue') return;
  const unit = createUnit(team);
  spawnUnitToRandomSpot(unit);
}



