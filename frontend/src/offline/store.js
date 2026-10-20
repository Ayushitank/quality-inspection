import { createPendingQueue } from './pendingQueue.js';

function resolveStorage() {
  try {
    const probe = '__qit_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    };
  }
}

export const pendingQueue = createPendingQueue(resolveStorage());
