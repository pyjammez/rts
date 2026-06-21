// --- Units ---
const units = [];
let nextUnitId = 1;
const gameSession = {
  active: false,
  finished: false,
  teams: [],
  initialHomesByTeam: {}
};

const DEFAULT_UNIT_STATS = {
    hp: 100,
    speed: 100,
    damage: 8,
    movingDamage: 4
};

function createUnit(team, unitType = 'soldier') {
    const definition = typeof getUnitDefinition === 'function' ? getUnitDefinition(unitType) : DEFAULT_UNIT_STATS;
    const hp = definition.hp ?? DEFAULT_UNIT_STATS.hp;
    const speed = definition.speed ?? DEFAULT_UNIT_STATS.speed;
    const unit = new Unit({
        id: nextUnitId++,
        x: 0,
        y: 0,
        team,
        hp,
        speed,
        size: definition.size || 20
    });

    unit.unitType = definition.id || unitType;
    unit.displayName = definition.name || unitType;
    unit.damage = definition.damage ?? DEFAULT_UNIT_STATS.damage;
    unit.movingDamage = definition.movingDamage ?? Math.max(1, Math.round(unit.damage * 0.5));
    unit.role = definition.role || '';
    unit.shootRange = definition.shootRange ?? unit.shootRange;
    unit.stopShootRange = definition.stopShootRange ?? unit.stopShootRange;
    unit.fireRate = definition.fireRate ?? unit.fireRate;
    unit.projectileSpeed = definition.projectileSpeed || 200;
    unit.projectileColor = definition.projectileColor || null;
    unit.projectileType = definition.projectileType || 'arrow';
    unit.splashRadius = definition.splashRadius || 0;
    unit.melee = !!definition.melee;
    unit.weaponName = definition.weaponName || definition.weapon || '';
    unit.weaponId = definition.weaponId || definition.weapon || null;
    return unit;
}

function getActiveModeConfig() {
  return window.mapConfig || mapConfig || {};
}

function getStartingUnitsPerTeam() {
  const config = getActiveModeConfig();
  const configured = Number(config.startingUnitsPerTeam);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 5;
}

function getConfiguredUnitRoster(config = getActiveModeConfig()) {
  if (config.unitRoster && typeof config.unitRoster === 'object') {
    const roster = {};
    for (const [unitType, count] of Object.entries(config.unitRoster)) {
      const parsed = Math.max(0, Math.floor(Number(count) || 0));
      if (parsed > 0) roster[unitType] = parsed;
    }
    if (Object.keys(roster).length > 0) return roster;
  }

  const fallbackType = config.unitType || 'soldier';
  return { [fallbackType]: getStartingUnitsPerTeam() };
}

function createConfiguredUnit(team, unitType = null) {
    const config = getActiveModeConfig();
    return createUnit(team, unitType || config.unitType || 'soldier');
}

function createLegacyUnit(team) {
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

  const config = getActiveModeConfig();

  if (typeof placeTeamBuildings === 'function') {
    placeTeamBuildings(config);
  }

  if (config.modeId === 'unit_comparison') {
    spawnComparisonUnits(config);
    return;
  }

  const unitRoster = getConfiguredUnitRoster(config);
  const teams = Array.isArray(config.teams) ? config.teams : ['red', 'blue'];
  const playableTeams = teams.includes('red') && teams.includes('blue') ? teams : ['red', 'blue'];
  const unitsPerTeam = Object.values(unitRoster).reduce((total, count) => total + count, 0);

  for (const team of playableTeams) {
    let spawnIndex = 0;
    for (const [unitType, count] of Object.entries(unitRoster)) {
      for (let i = 0; i < count; i++) {
        const unit = createConfiguredUnit(team, unitType);
        if (!spawnUnitInsideTeamCastle(unit, team, spawnIndex, unitsPerTeam)) {
          spawnUnitToRandomSpot(unit, team);
        }
        spawnIndex++;
      }
    }
  }

}

function spawnComparisonUnits(config) {
  const redCount = Math.max(1, Math.floor(Number(config.redUnitCount) || 5));
  const blueCount = Math.max(1, Math.floor(Number(config.blueUnitCount) || 5));

  for (let i = 0; i < redCount; i++) {
    const unit = createUnit('red', config.redUnitType || 'soldier');
    const point = findComparisonSpawnPoint('red', i, redCount, unit.size);
    unit.x = point.x;
    unit.y = point.y;
    units.push(unit);
  }

  for (let i = 0; i < blueCount; i++) {
    const unit = createUnit('blue', config.blueUnitType || 'soldier');
    const point = findComparisonSpawnPoint('blue', i, blueCount, unit.size);
    unit.x = point.x;
    unit.y = point.y;
    units.push(unit);
  }

  issueComparisonAttackOrders();
}

function findComparisonSpawnPoint(team, index, count, size) {
  const centerX = getMapWidthPx() * 0.5;
  const centerY = getMapHeightPx() * 0.5;
  const side = team === 'red' ? -1 : 1;
  const columnGap = 26;
  const rowGap = 30;
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const row = Math.floor(index / columns);
  const col = index % columns;
  const xBase = centerX + side * 180;
  const yBase = centerY - ((Math.ceil(count / columns) - 1) * rowGap) * 0.5;
  const preferred = {
    x: xBase + side * col * columnGap,
    y: yBase + row * rowGap
  };

  if (canSpawnAt(preferred.x, preferred.y, size)) return preferred;

  const nearest = findNearestWalkablePoint(preferred.x, preferred.y, size);
  if (nearest) return nearest;

  return randomSpotOnTeamHalf(team);
}

function findNearestEnemyForUnit(unit) {
  let closest = null;
  let closestDist = Infinity;

  for (const other of units) {
    if (!unit.isEnemyValid(other)) continue;
    const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (dist < closestDist) {
      closest = other;
      closestDist = dist;
    }
  }

  return closest;
}

function issueComparisonAttackOrders() {
  for (const unit of units) {
    if (unit.isDead) continue;
    const target = findNearestEnemyForUnit(unit);
    if (target) unit.issueAttackCommand(target);
  }
}

function updateActiveGameMode(dt, aliveUnits) {
  const config = getActiveModeConfig();
  if (config.modeId !== 'unit_comparison') return;

  for (const unit of aliveUnits) {
    if (unit.attackOrderTarget && unit.isEnemyValid(unit.attackOrderTarget)) continue;
    const target = findNearestEnemyForUnit(unit);
    if (target) unit.issueAttackCommand(target);
  }
}

function startGameSession(config = getActiveModeConfig()) {
  const teams = Array.isArray(config.teams) && config.teams.length
    ? config.teams.filter(team => team === 'red' || team === 'blue')
    : ['red', 'blue'];
  const buildings = typeof getBuildings === 'function' ? getBuildings() : [];

  gameSession.active = true;
  gameSession.finished = false;
  gameSession.teams = teams.length >= 2 ? teams : ['red', 'blue'];
  gameSession.initialHomesByTeam = {};

  for (const team of gameSession.teams) {
    gameSession.initialHomesByTeam[team] = buildings.filter(building =>
      building.team === team && building.type === 'home'
    ).length;
  }
}

function resetGameSession() {
  gameSession.active = false;
  gameSession.finished = false;
  gameSession.teams = [];
  gameSession.initialHomesByTeam = {};
}

function getOpponentTeam(team) {
  return gameSession.teams.find(candidate => candidate !== team) || null;
}

function finishGame(result) {
  if (gameSession.finished) return;

  gameSession.finished = true;
  gameSession.active = false;
  units.forEach(unit => {
    unit.selected = false;
    unit.destination = null;
    unit.path = [];
    unit.attackOrderTarget = null;
  });
  if (typeof clearBuildingSelection === 'function') clearBuildingSelection();
  if (typeof showGameOverScreen === 'function') showGameOverScreen(result);
}

function evaluateGameFinishRules(aliveUnits = units.filter(unit => !unit.isDead)) {
  if (!gameSession.active || gameSession.finished) return null;

  const teams = gameSession.teams;
  if (!Array.isArray(teams) || teams.length < 2) return null;

  const buildings = typeof getBuildings === 'function' ? getBuildings() : [];

  for (const team of teams) {
    const startedWithHome = (gameSession.initialHomesByTeam[team] || 0) > 0;
    if (!startedWithHome) continue;

    const hasLiveHome = buildings.some(building =>
      !building.isDead && building.team === team && building.type === 'home'
    );

    if (!hasLiveHome) {
      const winner = getOpponentTeam(team);
      const defeated = `${team.charAt(0).toUpperCase()}${team.slice(1)}`;
      const victorious = winner ? `${winner.charAt(0).toUpperCase()}${winner.slice(1)}` : 'The attacker';
      return {
        winner,
        loser: team,
        reason: `${defeated}'s castle was destroyed. ${victorious} wins.`
      };
    }
  }

  for (const team of teams) {
    const hasLiveUnit = aliveUnits.some(unit => unit.team === team && !unit.isDead);
    if (!hasLiveUnit) {
      const winner = getOpponentTeam(team);
      const defeated = `${team.charAt(0).toUpperCase()}${team.slice(1)}`;
      const victorious = winner ? `${winner.charAt(0).toUpperCase()}${winner.slice(1)}` : 'The opposing team';
      return {
        winner,
        loser: team,
        reason: `${defeated} has no units left. ${victorious} wins.`
      };
    }
  }

  return null;
}

function updateGameFinishRules(aliveUnits) {
  const result = evaluateGameFinishRules(aliveUnits);
  if (result) finishGame(result);
}

function isGameSessionFinished() {
  return gameSession.finished;
}

function isGameSessionActive() {
  return gameSession.active;
}

function spawnUnitInsideTeamCastle(unit, team, index, total) {
  const home = typeof getTeamHome === 'function' ? getTeamHome(team) : null;
  if (!home || home.isDead) return false;

  const courtyardInset = tileSize * 2;
  const left = home.tileX * tileSize + courtyardInset;
  const right = (home.tileX + home.width) * tileSize - courtyardInset;
  const top = home.tileY * tileSize + courtyardInset;
  const bottom = (home.tileY + home.height) * tileSize - courtyardInset;
  if (right <= left || bottom <= top) return false;

  const unitCount = Math.max(1, total);
  const columns = Math.max(1, Math.ceil(Math.sqrt(unitCount)));
  const rows = Math.max(1, Math.ceil(unitCount / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = left + ((column + 0.5) / columns) * (right - left);
  const y = top + ((row + 0.5) / rows) * (bottom - top);

  if (!canSpawnAt(x, y, unit.size)) return false;
  unit.x = x;
  unit.y = y;
  units.push(unit);
  return true;
}

function spawnUnitToRandomSpot(unit, preferredTeam = unit.team) {
  const home = typeof getTeamHome === 'function' ? getTeamHome(preferredTeam) : null;

  if (home) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 70 + Math.random() * 120;
      unit.x = home.x + Math.cos(angle) * radius;
      unit.y = home.y + Math.sin(angle) * radius;

      if (canSpawnAt(unit.x, unit.y, unit.size)) {
        units.push(unit);
        return;
      }
    }
  }

  for (let attempt = 0; attempt < 120; attempt++) {
    const spot = randomSpotOnTeamHalf(preferredTeam);
    unit.x = spot.x;
    unit.y = spot.y;

    if (canSpawnAt(unit.x, unit.y, unit.size)) {
      units.push(unit);
      return;
    }
  }
}

function spawnUnitForTeam(team) {
  if (team !== 'red' && team !== 'blue') return;
  const unit = createConfiguredUnit(team);
  spawnUnitToRandomSpot(unit, team);
}

function randomSpotOnTeamHalf(team) {
  const mapWidth = getMapWidthPx();
  const minX = team === 'red' ? 0 : mapWidth * 0.5;
  const maxX = team === 'red' ? mapWidth * 0.5 : mapWidth;

  for (let attempt = 0; attempt < 400; attempt++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = Math.random() * getMapHeightPx();
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);

    if (isWalkableTile(tileX, tileY)) {
      return { x, y };
    }
  }

  return randomSpotOnMap();
}
