(function registerCastleUpgradeSystem(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before castleUpgradeSystem.js');

  const LEVEL_BONUS = Object.freeze({
    hp: 250,
    damage: 3,
    range: 30,
    cooldownMultiplier: 0.92,
    minimumCooldown: 0.55
  });

  function canUpgrade(building, king) {
    return !!building &&
      !building.isDead &&
      building.type === 'home' &&
      !!king &&
      !king.isDead &&
      king.unitType === 'king' &&
      king.team === building.team &&
      building.upgradeLevel < building.maxUpgradeLevel;
  }

  function upgrade(building, king) {
    if (!canUpgrade(building, king)) return false;
    building.upgradeLevel += 1;
    building.maxHp += LEVEL_BONUS.hp;
    building.hp = Math.min(building.maxHp, building.hp + LEVEL_BONUS.hp);
    building.damage += LEVEL_BONUS.damage;
    building.range += LEVEL_BONUS.range;
    building.attackCooldown = Math.max(
      LEVEL_BONUS.minimumCooldown,
      building.attackCooldown * LEVEL_BONUS.cooldownMultiplier
    );
    app.events?.emit(app.events.types.CASTLE_UPGRADED, {
      building,
      king,
      level: building.upgradeLevel
    });
    return true;
  }

  app.systems.castleUpgrades = Object.freeze({ canUpgrade, upgrade, levelBonus: LEVEL_BONUS });
})(globalThis);
