(function registerRandomService(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before randomService.js');

  let rootSeed = 0;
  const streams = new Map();

  function hash(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
    const text = String(value ?? '');
    let result = 2166136261;
    for (let index = 0; index < text.length; index++) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function mix(seed, label) {
    let value = (seed ^ hash(label) ^ 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
  }

  function createGenerator(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createStream(label, seed = rootSeed) {
    const nextValue = createGenerator(mix(hash(seed), label));
    return Object.freeze({
      next: nextValue,
      range(min, max) {
        return min + nextValue() * (max - min);
      },
      int(min, maxExclusive) {
        if (maxExclusive <= min) throw new RangeError('maxExclusive must be greater than min');
        return Math.floor(min + nextValue() * (maxExclusive - min));
      },
      chance(probability) {
        return nextValue() < Math.max(0, Math.min(1, probability));
      },
      pick(values) {
        return Array.isArray(values) && values.length ? values[Math.floor(nextValue() * values.length)] : undefined;
      },
      shuffle(values) {
        for (let index = values.length - 1; index > 0; index--) {
          const swapIndex = Math.floor(nextValue() * (index + 1));
          [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
        }
        return values;
      }
    });
  }

  function stream(label = 'default') {
    const key = String(label);
    if (!streams.has(key)) streams.set(key, createStream(key));
    return streams.get(key);
  }

  function setSeed(seed) {
    rootSeed = hash(seed);
    streams.clear();
    return rootSeed;
  }

  function generateSeed() {
    if (root.crypto?.getRandomValues) {
      return root.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return hash(`${Date.now()}:${Math.random()}`);
  }

  function getSeed() {
    return rootSeed;
  }

  app.random = Object.freeze({ hash, setSeed, getSeed, generateSeed, stream, createStream });
})(globalThis);
