import { DEFECT_TYPES, labelOf } from '../lib/constants.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { SeverityBadge, StatusBadge } from './Badges.jsx';
import { ExpandableText } from './ExpandableText.jsx';
import styles from './InspectionCard.module.css';

export function InspectionCard({ inspection, onResolve }) {
  const { machineId, inspectionDate, defectType, severity, status, remarks, resolutionNote, resolvedAt, source } =
    inspection;

  return (
    <article className={`card ${styles.card}`} data-severity={severity}>
      <header className={styles.top}>
        <h3 className={styles.machine}>{machineId}</h3>
        <SeverityBadge severity={severity} />
      </header>

      <p className={styles.meta}>
        {labelOf(DEFECT_TYPES, defectType)} · <time dateTime={inspectionDate}>{formatDate(inspectionDate)}</time>
      </p>

      {remarks && <ExpandableText text={remarks} />}

      {status === 'RESOLVED' && (
        <div className={styles.resolution}>
          <p className={styles.resolutionLabel}>Resolved {formatDateTime(resolvedAt)}</p>
          <ExpandableText text={resolutionNote} />
        </div>
      )}

      <footer className={styles.bottom}>
        <div className={styles.tags}>
          <StatusBadge status={status} />
          {source === 'SAP' && <span className={styles.source}>via SAP</span>}
        </div>
        {status === 'OPEN' && (
          <button type="button" className="btn btn--primary btn--small" onClick={() => onResolve(inspection)}>
            Resolve
          </button>
        )}
      </footer>
    </article>
  );
}
