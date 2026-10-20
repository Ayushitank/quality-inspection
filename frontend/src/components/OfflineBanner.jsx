import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { usePendingInspections } from '../offline/usePendingInspections.js';
import styles from './OfflineBanner.module.css';

export function OfflineBanner({ onSyncNow }) {
  const online = useOnlineStatus();
  const waiting = usePendingInspections().filter((item) => !item.failure).length;

  if (online && waiting === 0) return null;

  if (!online) {
    return (
      <div className={`${styles.banner} ${styles.offline}`} role="status">
        <p>
          You are offline. New inspections are saved on this device and sync automatically.
          {waiting > 0 && ` ${waiting} waiting.`}
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.banner} ${styles.syncing}`} role="status">
      <p>
        {waiting} inspection{waiting === 1 ? '' : 's'} waiting to sync
      </p>
      <button type="button" className="btn btn--secondary btn--small" onClick={onSyncNow}>
        Sync now
      </button>
    </div>
  );
}
