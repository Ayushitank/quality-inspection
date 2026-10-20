import { createInspection } from '../api/inspections.js';
import { flushQueue } from './pendingQueue.js';
import { pendingQueue } from './store.js';

let inFlight = false;

export async function syncPending() {
  if (inFlight) return { synced: 0 };

  inFlight = true;
  try {
    return await flushQueue(pendingQueue, createInspection);
  } finally {
    inFlight = false;
  }
}
