(function registerProductionQueueSystem(root) {
  'use strict';

  const app = root.OpenRTS = root.OpenRTS || {};
  app.systems = app.systems || {};

  function createProductionQueueSystem(deps = {}) {
    const {
      resources = app.systems.resources,
      techTree = null,
      units = {},
      buildings = {},
      abilities = {},
      spawnUnit = null,
      completeResearch = null,
      onComplete = null
    } = deps;
    const queuesByProducer = new Map();
    let nextItemId = 1;

    function definitionFor(kind, id) {
      if (kind === 'unit') return units[id] || null;
      if (kind === 'building') return buildings[id] || null;
      if (kind === 'research' || kind === 'ability') return abilities[id] || null;
      return null;
    }

    function costFor(kind, id) {
      const definition = definitionFor(kind, id);
      return definition?.cost && typeof definition.cost === 'object' ? definition.cost : {};
    }

    function durationFor(kind, id) {
      const definition = definitionFor(kind, id) || {};
      return Math.max(0.1, Number(definition.buildTime ?? definition.trainTime ?? definition.researchTime ?? 3) || 3);
    }

    function queueFor(producerId) {
      const key = String(producerId || 'global');
      if (!queuesByProducer.has(key)) queuesByProducer.set(key, []);
      return queuesByProducer.get(key);
    }

    function enqueue({ producerId, team, kind = 'unit', id, state = {} }) {
      const targetId = String(id || '');
      const targetKind = kind === 'ability' ? 'research' : String(kind || 'unit');
      if (!targetId) return { accepted: false, reason: 'missing production id' };
      const definition = definitionFor(targetKind, targetId);
      if (!definition) return { accepted: false, reason: `unknown ${targetKind} "${targetId}"` };
      if (techTree && !techTree.isUnlocked(targetId, state)) return { accepted: false, reason: `${targetId} is locked by tech tree` };
      const cost = costFor(targetKind, targetId);
      if (resources && !resources.spend(team, cost)) return { accepted: false, reason: 'insufficient resources' };
      const item = {
        id: `production-${nextItemId++}`,
        producerId: String(producerId || 'global'),
        team: String(team || 'neutral'),
        kind: targetKind,
        targetId,
        elapsed: 0,
        duration: durationFor(targetKind, targetId),
        cost: { ...cost }
      };
      queueFor(item.producerId).push(item);
      return { accepted: true, item: { ...item } };
    }

    function refund(team, cost = {}) {
      if (!resources?.add) return;
      for (const [type, amount] of Object.entries(cost || {})) resources.add(team, type, amount);
    }

    function cancel(producerId, itemId, { refundCost = true } = {}) {
      const queue = queuesByProducer.get(String(producerId || 'global'));
      if (!queue) return { accepted: false, reason: 'producer has no queue' };
      const index = queue.findIndex(item => item.id === itemId);
      if (index < 0) return { accepted: false, reason: 'production item not found' };
      const [item] = queue.splice(index, 1);
      if (refundCost) refund(item.team, item.cost);
      if (queue.length === 0) queuesByProducer.delete(String(producerId || 'global'));
      return { accepted: true, item: { ...item } };
    }

    function completeItem(item) {
      let result = null;
      if (item.kind === 'unit' && typeof spawnUnit === 'function') {
        result = spawnUnit(item);
      } else if (item.kind === 'research' && typeof completeResearch === 'function') {
        result = completeResearch(item);
      }
      if (typeof onComplete === 'function') onComplete(item, result);
      return result;
    }

    function update(dt) {
      const completed = [];
      const delta = Math.max(0, Number(dt) || 0);
      for (const [producerId, queue] of queuesByProducer.entries()) {
        if (queue.length === 0) continue;
        const item = queue[0];
        item.elapsed += delta;
        if (item.elapsed < item.duration) continue;
        queue.shift();
        completed.push({ ...item, result: completeItem(item) });
        if (queue.length === 0) queuesByProducer.delete(producerId);
      }
      return completed;
    }

    function getQueue(producerId) {
      return queueFor(producerId).map(item => ({ ...item }));
    }

    function progress(producerId) {
      return getQueue(producerId).map(item => ({
        ...item,
        progress: item.duration > 0 ? Math.max(0, Math.min(1, item.elapsed / item.duration)) : 1,
        remaining: Math.max(0, item.duration - item.elapsed)
      }));
    }

    function describe() {
      return {
        schemaVersion: 1,
        queues: Object.fromEntries([...queuesByProducer.entries()].map(([producerId, queue]) => [producerId, queue.map(item => ({ ...item }))]))
      };
    }

    return Object.freeze({
      enqueue,
      cancel,
      update,
      getQueue,
      progress,
      describe
    });
  }

  app.systems.productionQueues = Object.freeze({ createProductionQueueSystem });
})(globalThis);
