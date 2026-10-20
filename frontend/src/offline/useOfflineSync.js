import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useToast } from '../components/Toast.jsx';
import { inspectionKeys } from '../hooks/useInspections.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { STORAGE_KEY } from './pendingQueue.js';
import { pendingQueue } from './store.js';
import { syncPending } from './sync.js';
import { usePendingInspections } from './usePendingInspections.js';

const RETRY_INTERVAL_MS = 30_000;

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const online = useOnlineStatus();
  const hasWaiting = usePendingInspections().some((item) => !item.failure);

  const syncNow = useCallback(async () => {
    const { synced } = await syncPending();
    if (synced > 0) {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.all });
      toast(synced === 1 ? '1 offline inspection synced' : `${synced} offline inspections synced`);
    }
  }, [queryClient, toast]);

  useEffect(() => {
    if (!online || !hasWaiting) return undefined;
    syncNow();
    const timer = setInterval(syncNow, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, hasWaiting, syncNow]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) pendingQueue.refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { syncNow };
}
