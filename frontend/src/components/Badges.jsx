import { labelOf, SEVERITIES, STATUSES } from '../lib/constants.js';
import styles from './Badges.module.css';

export function SeverityBadge({ severity }) {
  return <span className={`${styles.badge} ${styles[severity.toLowerCase()]}`}>{labelOf(SEVERITIES, severity)}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`${styles.badge} ${styles[status.toLowerCase()]}`}>{labelOf(STATUSES, status)}</span>;
}
