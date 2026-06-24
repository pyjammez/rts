// --- Units ---
const units = [];
let nextUnitId = 1;
const gameSession = {
  active: false,
  finished: false,
  teams: [],
  initialHomesByTeam: {},
  initialKingsByTeam: {},
  initialUnitsByTeam: {}
};

const DEFAULT_UNIT_STATS = {
    hp: 100,
    speed: 100,
    damage: 8,
    movingDamage: 4
};

function simulationRandom() {
  return OpenRTS.random.stream('simulation').next();
}

function createUnit(team, unitType = 'soldier') {
    const baseDefinition = typeof getUnitDefinition === 'function' ? getUnitDefinition(unitType) : DEFAULT_UNIT_STATS;
    const overrideSource = getActiveModeConfig()?.unitOverrides?.[baseDefinition.id || unitType] || {};
    const definition = {
        ...baseDefinition,
        ...sanitizeUnitStatOverrides(overrideSource, baseDefinition)
    };
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
    unit.aggroRange = definition.aggroRange ?? Math.max(unit.stopShootRange + tileSize * 2.5, unit.shootRange + tileSize * 3, 190);
    unit.fireRate = definition.fireRate ?? unit.fireRate;
    unit.projectileSpeed = definition.projectileSpeed || 200;
    unit.projectileColor = definition.projectileColor || null;
    unit.projectileType = definition.projectileType || 'arrow';
    unit.splashRadius = definition.splashRadius || 0;
    unit.melee = !!definition.melee;
    unit.weaponName = definition.weaponName || definition.weapon || '';
    unit.weaponId = definition.weaponId || definition.weapon || null;
    unit.abilities = Array.isArray(definition.abilities) ? [...definition.abilities] : [];
    unit.abilityDefinitions = Array.isArray(definition.abilityDefinitions) ? structuredClone(definition.abilityDefinitions) : [];
    unit.pack = definition.pack || 'core';
    unit.era = definition.era || 'core';
    unit.movementType = definition.movementType || 'ground';
    unit.airborne = unit.movementType === 'air';
    unit.flightHeight = Number(definition.flightHeight) || (unit.airborne ? 2.2 : 0);
    unit.canTargetGround = definition.canTargetGround !== false;
    unit.canTargetAir = !!definition.canTargetAir;
    return unit;
}

function sanitizeUnitStatOverrides(overrides, baseDefinition = {}) {
    if (!overrides || typeof overrides !== 'object') return {};
    const sanitized = {};
    const hp = Number(overrides.hp);
    if (Number.isFinite(hp) && hp > 0) sanitized.hp = Math.floor(hp);
    const damage = Number(overrides.damage);
    if (Number.isFinite(damage) && damage >= 0) {
        sanitized.damage = Math.floor(damage);
        sanitized.movingDamage = overrides.movingDamage ?? baseDefinition.movingDamage ?? Math.max(1, Math.round(sanitized.damage * 0.5));
    }
    if (Array.isArray(overrides.abilities)) {
        sanitized.abilities = overrides.abilities.filter(Boolean).map(String);
    }
    return sanitized;
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
      const definition = typeof getUnitDefinition === 'function' ? getUnitDefinition(unitType) : {};
      const maximum = Number.isFinite(Number(definition.maxPerTeam))
        ? Math.max(0, Math.floor(Number(definition.maxPerTeam)))
        : Infinity;
      const parsed = Math.min(maximum, Math.max(0, Math.floor(Number(count) || 0)));
      if (parsed > 0) roster[unitType] = parsed;
    }
    const mode = typeof getGameModeDefinition === 'function' ? getGameModeDefinition(config.modeId) : null;
    for (const unitType of mode?.allowedUnits || []) {
      const definition = typeof getUnitDefinition === 'function' ? getUnitDefinition(unitType) : {};
      if (definition.requiredPerTeam) roster[unitType] = Math.max(1, Math.floor(Number(definition.requiredPerTeam) || 1));
    }
    if (Object.keys(roster).length > 0) return roster;
  }

  const fallbackType = config.unitType || 'soldier';
  return { [fallbackType]: getStartingUnitsPerTeam() };
}

function getConfiguredTeams(config = getActiveModeConfig()) {
  if (typeof getActivePlayerSlots === 'function') {
    const slotTeams = getActivePlayerSlots(config).map(slot => slot.flag).filter(Boolean);
    if (slotTeams.length >= 2) return slotTeams;
  }

  return Array.isArray(config.teams) && config.teams.length >= 2 ? [...config.teams] : ['red', 'blue'];
}

function createConfiguredUnit(team, unitType = null) {
    const config = getActiveModeConfig();
    const requestedType = unitType || config.unitType || 'soldier';
    if (requestedType === 'king' && units.some(unit => unit.team === team && unit.unitType === 'king')) return null;
    return createUnit(team, requestedType);
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

  if (config.modeId === 'map_builder') {
    return;
  }

  if (config.modeId === 'unit_comparison') {
    spawnComparisonUnits(config);
    return;
  }

  const unitRoster = getConfiguredUnitRoster(config);
  const playableTeams = config.modeId === 'tower_defense' ? ['red'] : getConfiguredTeams(config);
  const unitsPerTeam = Object.values(unitRoster).reduce((total, count) => total + count, 0);

  for (const team of playableTeams) {
    let spawnIndex = 0;
    for (const [unitType, count] of Object.entries(unitRoster)) {
      for (let i = 0; i < count; i++) {
        const unit = createConfiguredUnit(team, unitType);
        if (!unit) continue;
        if (config.modeId === 'tower_defense') {
          spawnTowerDefenseDefender(unit, team, spawnIndex, unitsPerTeam);
        } else if (!spawnUnitInsideTeamCastle(unit, team, spawnIndex, unitsPerTeam)) {
          spawnUnitToRandomSpot(unit, team);
        }
        spawnIndex++;
      }
    }
  }

}

function spawnTowerDefenseDefender(unit, team, index, total) {
  const home = typeof getTeamHome === 'function' ? getTeamHome(team) : null;
  if (!home) {
    spawnUnitToRandomSpot(unit, team);
    return;
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, total))));
  const row = Math.floor(index / columns);
  const col = index % columns;
  const centerOffset = (col - (columns - 1) * 0.5) * tileSize * 0.9;
  const preferred = {
    x: home.x + centerOffset,
    y: (home.tileY + home.height + 1.5 + row * 0.85) * tileSize
  };
  const movementOptions = unit.getMovementOptions ? unit.getMovementOptions() : {};
  const point = findNearestWalkablePoint(preferred.x, preferred.y, unit.size, 16, movementOptions) ||
    findNearestWalkablePoint(home.x, home.y + home.height * tileSize * 0.75, unit.size, 16, movementOptions);

  if (point) {
    unit.x = point.x;
    unit.y = point.y;
    units.push(unit);
    return;
  }

  spawnUnitToRandomSpot(unit, team);
}

function spawnComparisonUnits(config) {
  const leftRoster = getComparisonUnitList(config.leftUnitRoster, {
    [config.redUnitType || 'soldier']: config.redUnitCount || 5
  });
  const rightRoster = getComparisonUnitList(config.rightUnitRoster, {
    [config.blueUnitType || 'soldier']: config.blueUnitCount || 5
  });

  for (let i = 0; i < leftRoster.length; i++) {
    const unit = createUnit('red', leftRoster[i]);
    const point = findComparisonSpawnPoint('red', i, leftRoster.length, unit.size);
    unit.x = point.x;
    unit.y = point.y;
    units.push(unit);
  }

  for (let i = 0; i < rightRoster.length; i++) {
    const unit = createUnit('blue', rightRoster[i]);
    const point = findComparisonSpawnPoint('blue', i, rightRoster.length, unit.size);
    unit.x = point.x;
    unit.y = point.y;
    units.push(unit);
  }

  issueComparisonAttackOrders();
}

function getComparisonUnitList(roster, fallbackRoster) {
  const source = roster && typeof roster === 'object' ? roster : fallbackRoster;
  const allowedUnits = getGameModeDefinition('unit_comparison').allowedUnits || Object.keys(window.UNIT_DEFINITIONS || {});
  const unitTypes = [];

  for (const unitType of allowedUnits) {
    const definition = getUnitDefinition(unitType);
    const maximum = Number.isFinite(Number(definition.maxPerTeam))
      ? Math.max(0, Math.floor(Number(definition.maxPerTeam)))
      : 80;
    const count = Math.min(maximum, Math.max(0, Math.floor(Number(source?.[unitType]) || 0)));
    for (let i = 0; i < count; i++) unitTypes.push(unitType);
  }

  return unitTypes.length > 0 ? unitTypes : ['soldier'];
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
    if (other.hiddenInHouse) continue;
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
    if (unit.isDead || unit.hiddenInHouse) continue;
    const target = findNearestEnemyForUnit(unit);
    if (target) unit.issueAttackCommand(target);
  }
}

function updateActiveGameMode(dt, aliveUnits) {
  const modeResult = OpenRTS.modes?.runtime?.update(dt, {
    aliveUnits,
    units,
    buildings: typeof getBuildings === 'function' ? getBuildings() : [],
    config: getActiveModeConfig()
  });
  if (modeResult) return modeResult;

  const config = getActiveModeConfig();
  if (config.modeId !== 'unit_comparison') return;

  for (const unit of aliveUnits) {
    if (unit.attackOrderTarget && unit.isEnemyValid(unit.attackOrderTarget)) continue;
    const target = findNearestEnemyForUnit(unit);
    if (target) unit.issueAttackCommand(target);
  }
}

function startGameSession(config = getActiveModeConfig()) {
  const teams = getConfiguredTeams(config);
  const buildings = typeof getBuildings === 'function' ? getBuildings() : [];

  if (OpenRTS.modes?.runtime) {
    OpenRTS.modes.runtime.activate(config.modeId || 'versus', config, {
      frame: OpenRTS.runtime?.frame ?? 0,
      seed: OpenRTS.random.getSeed()
    });
  }

  gameSession.active = true;
  gameSession.finished = false;
  gameSession.teams = teams.length >= 2 ? teams : ['red', 'blue'];
  gameSession.initialHomesByTeam = {};
  gameSession.initialKingsByTeam = {};
  gameSession.initialUnitsByTeam = {};

  for (const team of gameSession.teams) {
    gameSession.initialHomesByTeam[team] = buildings.filter(building =>
      building.team === team && building.type === 'home'
    ).length;
    gameSession.initialKingsByTeam[team] = units.filter(unit =>
      unit.team === team && unit.unitType === 'king'
    ).length;
    gameSession.initialUnitsByTeam[team] = units.filter(unit => unit.team === team).length;
  }
  OpenRTS.events.emit(OpenRTS.events.types.MATCH_STARTED, {
    modeId: config.modeId,
    teams: [...gameSession.teams],
    seed: OpenRTS.random.getSeed()
  });
}

function resetGameSession() {
  gameSession.active = false;
  gameSession.finished = false;
  gameSession.teams = [];
  gameSession.initialHomesByTeam = {};
  gameSession.initialKingsByTeam = {};
  gameSession.initialUnitsByTeam = {};
  OpenRTS.events.emit(OpenRTS.events.types.MATCH_RESET);
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
  OpenRTS.events.emit(OpenRTS.events.types.MATCH_ENDED, result);
  if (typeof showGameOverScreen === 'function') showGameOverScreen(result);
}

function evaluateGameFinishRules(aliveUnits = units.filter(unit => !unit.isDead)) {
  const buildings = typeof getBuildings === 'function' ? getBuildings() : [];
  return OpenRTS.rules.match.evaluate({
    ...gameSession,
    aliveUnits,
    buildings
  });
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

  if (!canSpawnAt(x, y, unit.size, unit.getMovementOptions ? unit.getMovementOptions() : {})) return false;
  unit.x = x;
  unit.y = y;
  units.push(unit);
  return true;
}

function spawnUnitToRandomSpot(unit, preferredTeam = unit.team) {
  const home = typeof getTeamHome === 'function' ? getTeamHome(preferredTeam) : null;

  if (home) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const angle = simulationRandom() * Math.PI * 2;
      const radius = 70 + simulationRandom() * 120;
      unit.x = home.x + Math.cos(angle) * radius;
      unit.y = home.y + Math.sin(angle) * radius;

      if (canSpawnAt(unit.x, unit.y, unit.size, unit.getMovementOptions ? unit.getMovementOptions() : {})) {
        units.push(unit);
        return;
      }
    }
  }

  for (let attempt = 0; attempt < 120; attempt++) {
    const spot = randomSpotOnTeamHalf(preferredTeam);
    unit.x = spot.x;
    unit.y = spot.y;

    if (canSpawnAt(unit.x, unit.y, unit.size, unit.getMovementOptions ? unit.getMovementOptions() : {})) {
      units.push(unit);
      return;
    }
  }
}

function spawnUnitForTeam(team) {
  const unit = createConfiguredUnit(team);
  if (!unit) return;
  spawnUnitToRandomSpot(unit, team);
}

function spawnTowerDefenseEnemy({ team = 'blue', unitType = 'soldier', laneOffset = 0 } = {}) {
  const unit = createUnit(team, unitType);
  const targetHome = typeof getTeamHome === 'function' ? getTeamHome('red') : null;
  const spawnX = getMapWidthPx() - tileSize * 2.5;
  const spawnY = targetHome
    ? targetHome.y + laneOffset
    : getMapHeightPx() * 0.5 + laneOffset;
  const point = findNearestWalkablePoint(spawnX, Math.max(tileSize, Math.min(getMapHeightPx() - tileSize, spawnY)), unit.size, 16, unit.getMovementOptions ? unit.getMovementOptions() : {}) ||
    randomSpotOnTeamHalf(team);
  unit.x = point.x;
  unit.y = point.y;
  units.push(unit);
  if (targetHome) unit.issueAttackCommand(targetHome);
  return unit;
}

function randomSpotOnTeamHalf(team) {
  const mapWidth = getMapWidthPx();
  const teams = getConfiguredTeams();
  const teamIndex = Math.max(0, teams.indexOf(team));
  const teamCount = Math.max(2, teams.length);
  const sliceWidth = mapWidth / teamCount;
  const minX = teamCount === 2
    ? (teamIndex === 0 ? 0 : mapWidth * 0.5)
    : teamIndex * sliceWidth;
  const maxX = teamCount === 2
    ? (teamIndex === 0 ? mapWidth * 0.5 : mapWidth)
    : Math.min(mapWidth, minX + sliceWidth);

  for (let attempt = 0; attempt < 400; attempt++) {
    const x = minX + simulationRandom() * (maxX - minX);
    const y = simulationRandom() * getMapHeightPx();
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);

    if (isWalkableTile(tileX, tileY, unit.getMovementOptions ? unit.getMovementOptions() : {})) {
      return { x, y };
    }
  }

  return randomSpotOnMap();
}
