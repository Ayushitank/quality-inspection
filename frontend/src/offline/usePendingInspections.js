import { useSyncExternalStore } from 'react';
import { pendingQueue } from './store.js';

export function usePendingInspections() {
  return useSyncExternalStore(pendingQueue.subscribe, pendingQueue.getSnapshot);
}
