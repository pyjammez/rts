(function registerMatchRules(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before matchRules.js');

  function opponentOf(teams, team) {
    return teams.find(candidate => candidate !== team) || null;
  }

  function teamName(team, fallback) {
    return team ? `${team.charAt(0).toUpperCase()}${team.slice(1)}` : fallback;
  }

  function resultFor(teams, loser, reason) {
    return { winner: opponentOf(teams, loser), loser, reason };
  }

  function evaluate({
    active,
    finished,
    teams,
    initialHomesByTeam,
    initialKingsByTeam,
    initialDefeatCriticalLabelsByTeam,
    initialUnitsByTeam,
    aliveUnits,
    buildings
  }) {
    if (!active || finished || !Array.isArray(teams) || teams.length < 2) return null;
    const liveUnits = Array.isArray(aliveUnits) ? aliveUnits : [];
    const liveBuildings = Array.isArray(buildings) ? buildings : [];

    for (const team of teams) {
      if ((initialKingsByTeam?.[team] || 0) <= 0) continue;
      const hasLiveCriticalUnit = liveUnits.some(unit =>
        unit.team === team &&
        (unit.defeatCritical || unit.unitType === 'king') &&
        !unit.isDead
      );
      if (!hasLiveCriticalUnit) {
        const winner = opponentOf(teams, team);
        const label = String(initialDefeatCriticalLabelsByTeam?.[team] || 'king').toLowerCase();
        return resultFor(
          teams,
          team,
          `${teamName(team)}'s ${label} has fallen. ${teamName(winner, 'The opposing team')} wins.`
        );
      }
    }

    for (const team of teams) {
      if ((initialHomesByTeam?.[team] || 0) <= 0) continue;
      const hasLiveHome = liveBuildings.some(building =>
        !building.isDead && building.team === team && building.type === 'home'
      );
      if (!hasLiveHome) {
        const winner = opponentOf(teams, team);
        return resultFor(
          teams,
          team,
          `${teamName(team)}'s castle was destroyed. ${teamName(winner, 'The attacker')} wins.`
        );
      }
    }

    for (const team of teams) {
      if ((initialUnitsByTeam?.[team] || 0) <= 0) continue;
      const hasLiveUnit = liveUnits.some(unit => unit.team === team && !unit.isDead);
      if (!hasLiveUnit) {
        const winner = opponentOf(teams, team);
        return resultFor(
          teams,
          team,
          `${teamName(team)} has no units left. ${teamName(winner, 'The opposing team')} wins.`
        );
      }
    }

    return null;
  }

  app.rules.match = Object.freeze({ evaluate });
})(globalThis);
