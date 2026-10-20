import { Link } from 'react-router-dom';
import { SeverityBadge } from '../components/Badges.jsx';
import { useSummary } from '../hooks/useInspections.js';
import styles from './Page.module.css';

function CountLink({ count, filter, label }) {
  if (count === 0) return <span className={styles.zero}>0</span>;
  return (
    <Link className={styles.countLink} to={`/?${new URLSearchParams(filter)}`} aria-label={`${count} ${label}`}>
      {count}
    </Link>
  );
}

export function SummaryPage() {
  const { data, isPending, isError, error, refetch } = useSummary();

  if (isPending) {
    return <div className={`card ${styles.skeleton}`} aria-busy="true" aria-label="Loading summary" />;
  }

  if (isError) {
    return (
      <div className="notice notice--error" role="alert">
        <p>{error.message}</p>
        <button type="button" className={`btn btn--secondary btn--small ${styles.retry}`} onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const { totals, bySeverity } = data;

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Summary</h2>

      <div className={styles.stats}>
        <Link to="/?status=OPEN" className={`card ${styles.stat} ${styles.statOpen}`}>
          <span className={styles.statValue}>{totals.open}</span>
          <span className={styles.statLabel}>Open</span>
        </Link>
        <Link to="/?status=RESOLVED" className={`card ${styles.stat} ${styles.statResolved}`}>
          <span className={styles.statValue}>{totals.resolved}</span>
          <span className={styles.statLabel}>Resolved</span>
        </Link>
      </div>

      <table className={`card ${styles.table}`}>
        <caption className="visually-hidden">Inspections by severity and status</caption>
        <thead>
          <tr>
            <th scope="col">Severity</th>
            <th scope="col">Open</th>
            <th scope="col">Resolved</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {bySeverity.map(({ severity, open, resolved, total }) => (
            <tr key={severity}>
              <th scope="row">
                <SeverityBadge severity={severity} />
              </th>
              <td>
                <CountLink count={open} filter={{ severity, status: 'OPEN' }} label={`open ${severity.toLowerCase()} inspections`} />
              </td>
              <td>
                <CountLink count={resolved} filter={{ severity, status: 'RESOLVED' }} label={`resolved ${severity.toLowerCase()} inspections`} />
              </td>
              <td>
                <CountLink count={total} filter={{ severity }} label={`${severity.toLowerCase()} inspections in total`} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All</th>
            <td>{totals.open}</td>
            <td>{totals.resolved}</td>
            <td>{totals.total}</td>
          </tr>
        </tfoot>
      </table>

      <p className={styles.hint}>Tap a number to see those inspections.</p>
    </div>
  );
}
