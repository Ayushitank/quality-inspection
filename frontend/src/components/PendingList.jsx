import { DEFECT_TYPES, labelOf } from '../lib/constants.js';
import { formatDate } from '../lib/format.js';
import { pendingQueue } from '../offline/store.js';
import { usePendingInspections } from '../offline/usePendingInspections.js';
import { SeverityBadge } from './Badges.jsx';
import styles from './PendingList.module.css';

export function PendingList() {
  const items = usePendingInspections();
  if (items.length === 0) return null;

  const discard = (id) => {
    if (window.confirm('Discard this inspection? It has not been saved to the server yet.')) pendingQueue.remove(id);
  };

  return (
    <section className={styles.list} aria-label="Waiting to sync">
      {items.map(({ id, payload, failure }) => (
        <article key={id} className={styles.card}>
          <header className={styles.top}>
            <h3 className={styles.machine}>{payload.machineId}</h3>
            <SeverityBadge severity={payload.severity} />
          </header>
          <p className={styles.meta}>
            {labelOf(DEFECT_TYPES, payload.defectType)} · {formatDate(payload.inspectionDate)}
          </p>

          {failure ? (
            <>
              <p className={styles.failure} role="alert">
                Could not sync: {failure}
              </p>
              <div className={styles.actions}>
                <button type="button" className="btn btn--secondary btn--small" onClick={() => pendingQueue.retry(id)}>
                  Retry
                </button>
                <button type="button" className="btn btn--danger btn--small" onClick={() => discard(id)}>
                  Discard
                </button>
              </div>
            </>
          ) : (
            <p className={styles.waiting}>Saved on this device · waiting to sync</p>
          )}
        </article>
      ))}
    </section>
  );
}
