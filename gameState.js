// --- Units ---
const units = [];

// blue team
for (let i = 0; i < 5; i++) {
  let unit = new Unit({ id: 1, x: Math.random() * canvas.width, y: Math.random() * canvas.height, team: 'blue', speed: 100 });
  spawnUnitToRandomSpot(unit);
}

// red team
for (let i = 0; i < 5; i++) {
    let unit = new Unit({ id: 1, x: 0, y: 0, team: 'red', speed: 100 });
    spawnUnitToRandomSpot(unit);
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



