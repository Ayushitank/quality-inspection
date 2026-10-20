import { isRetryable } from '../api/http.js';

export const STORAGE_KEY = 'qit.pendingInspections';

export function createPendingQueue(storage, key = STORAGE_KEY) {
  const listeners = new Set();

  const read = () => {
    try {
      const parsed = JSON.parse(storage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  let snapshot = read();

  const update = (change) => {
    const next = change(read());
    storage.setItem(key, JSON.stringify(next));
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    refresh() {
      snapshot = read();
      listeners.forEach((listener) => listener());
    },

    enqueue(payload) {
      update((items) =>
        items.some((item) => item.id === payload.id)
          ? items
          : [...items, { id: payload.id, payload, queuedAt: new Date().toISOString() }],
      );
    },

    remove(id) {
      update((items) => items.filter((item) => item.id !== id));
    },

    markFailed(id, failure) {
      update((items) => items.map((item) => (item.id === id ? { ...item, failure } : item)));
    },

    retry(id) {
      update((items) =>
        items.map((item) => {
          if (item.id !== id) return item;
          const { failure, ...rest } = item;
          return rest;
        }),
      );
    },
  };
}

export async function flushQueue(queue, send) {
  let synced = 0;

  for (const item of queue.getSnapshot().filter((candidate) => !candidate.failure)) {
    try {
      await send(item.payload);
      queue.remove(item.id);
      synced += 1;
    } catch (error) {
      if (isRetryable(error)) break;
      queue.markFailed(item.id, error.message);
    }
  }

  return { synced };
}
