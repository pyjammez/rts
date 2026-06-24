(function registerAbilityEffectSystem(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.systems = app.systems || {};

  function normalizeEffects(ability = {}) {
    if (Array.isArray(ability.effects)) return ability.effects;
    if (ability.effect && typeof ability.effect === 'object') return [ability.effect];
    return [];
  }

  function applyEffect(effect, context = {}) {
    const type = String(effect?.type || (effect?.damage ? 'damage' : '') || '');
    const target = context.target || null;
    const source = context.source || null;
    if (type === 'damage') {
      const amount = Math.max(0, Number(effect.damage ?? effect.amount) || 0);
      const multiplier = typeof context.getDamageMultiplier === 'function'
        ? context.getDamageMultiplier({ source, target, effect })
        : 1;
      const finalAmount = amount * multiplier;
      if (typeof target?.takeDamage === 'function') target.takeDamage(finalAmount, source);
      else if (target) target.hp = Math.max(0, Number(target.hp || 0) - finalAmount);
      return { type, amount: finalAmount };
    }
    if (type === 'heal') {
      const amount = Math.max(0, Number(effect.amount ?? effect.heal) || 0);
      if (target) target.hp = Math.min(Number(target.maxHp ?? target.hp ?? amount), Number(target.hp || 0) + amount);
      return { type, amount };
    }
    if (type === 'buff' || type === 'debuff') {
      if (target) {
        target.modifiers = Array.isArray(target.modifiers) ? target.modifiers : [];
        target.modifiers.push({
          type,
          stat: effect.stat || '',
          amount: Number(effect.amount) || 0,
          duration: Math.max(0, Number(effect.duration) || 0),
          sourceId: source?.id || null
        });
      }
      return { type, stat: effect.stat || '', amount: Number(effect.amount) || 0 };
    }
    if (typeof context.handlers?.[type] === 'function') {
      return { type, result: context.handlers[type](effect, context) };
    }
    return { type: type || 'unknown', ignored: true };
  }

  function applyAbility(ability, context = {}) {
    const results = normalizeEffects(ability).map(effect => applyEffect(effect, context));
    return {
      abilityId: ability?.id || null,
      applied: results
    };
  }

  function canPayCost(ability = {}, context = {}) {
    const cost = ability.cost && typeof ability.cost === 'object' ? ability.cost : {};
    if (!context.resources?.canAfford || !context.team) return true;
    return context.resources.canAfford(context.team, cost);
  }

  function createCooldownTracker() {
    const cooldowns = new Map();

    function key(sourceId, abilityId) {
      return `${sourceId || 'global'}:${abilityId || 'ability'}`;
    }

    function remaining(sourceId, abilityId, now = 0) {
      return Math.max(0, (cooldowns.get(key(sourceId, abilityId)) || 0) - Number(now || 0));
    }

    function canCast(sourceId, ability, { now = 0, resources = null, team = null } = {}) {
      if (!ability) return { accepted: false, reason: 'missing ability' };
      if (remaining(sourceId, ability.id, now) > 0) return { accepted: false, reason: 'ability is on cooldown' };
      if (!canPayCost(ability, { resources, team })) return { accepted: false, reason: 'insufficient resources' };
      return { accepted: true, reason: '' };
    }

    function start(sourceId, ability, now = 0) {
      cooldowns.set(key(sourceId, ability?.id), Number(now || 0) + Math.max(0, Number(ability?.cooldown) || 0));
    }

    function spendAndStart(sourceId, ability, { now = 0, resources = null, team = null } = {}) {
      const check = canCast(sourceId, ability, { now, resources, team });
      if (!check.accepted) return check;
      const cost = ability.cost && typeof ability.cost === 'object' ? ability.cost : {};
      if (resources?.spend && team) resources.spend(team, cost);
      start(sourceId, ability, now);
      return { accepted: true, reason: '' };
    }

    function tick(dt) {
      const delta = Math.max(0, Number(dt) || 0);
      if (delta <= 0) return;
      for (const [cooldownKey, expiresAt] of cooldowns.entries()) cooldowns.set(cooldownKey, Math.max(0, expiresAt - delta));
    }

    function describe(now = 0) {
      return {
        schemaVersion: 1,
        cooldowns: Object.fromEntries([...cooldowns.entries()].map(([cooldownKey, expiresAt]) => [cooldownKey, Math.max(0, expiresAt - Number(now || 0))]))
      };
    }

    return Object.freeze({
      remaining,
      canCast,
      start,
      spendAndStart,
      tick,
      describe
    });
  }

  app.systems.abilityEffects = Object.freeze({
    normalizeEffects,
    applyEffect,
    applyAbility,
    canPayCost,
    createCooldownTracker
  });
})(globalThis);
