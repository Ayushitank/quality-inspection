import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterBar } from '../components/FilterBar.jsx';
import { InspectionCard } from '../components/InspectionCard.jsx';
import { PendingList } from '../components/PendingList.jsx';
import { ResolveSheet } from '../components/ResolveSheet.jsx';
import { useInspectionList } from '../hooks/useInspections.js';
import { applyFilterChange, countAdvancedFilters, orderLabel, parseFilters, toSearchParams } from '../lib/filters.js';
import styles from './Page.module.css';

export function InspectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [resolving, setResolving] = useState(null);
  const query = useInspectionList(filters);

  const changeFilters = (patch) => setSearchParams(toSearchParams(applyFilterChange(filters, patch)), { replace: true });
  const clearFilters = () => changeFilters({ status: '', severity: '', from: '', to: '' });
  const isFiltered = filters.status !== '' || countAdvancedFilters(filters) > 0;

  const inspections = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0].meta.total ?? 0;

  return (
    <div className={styles.page}>
      <PendingList />
      <FilterBar filters={filters} onChange={changeFilters} onClear={clearFilters} />

      {query.isPending && (
        <div className={styles.skeletons} aria-busy="true" aria-label="Loading inspections">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`card ${styles.skeleton}`} />
          ))}
        </div>
      )}

      {query.isError && (
        <div className="notice notice--error" role="alert">
          <p>{query.error.message}</p>
          <button type="button" className={`btn btn--secondary btn--small ${styles.retry}`} onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && (
        <>
          <p className={styles.count} aria-live="polite">
            {total} inspection{total === 1 ? '' : 's'} · {orderLabel(filters.sortBy, filters.order)}
          </p>

          {inspections.length === 0 ? (
            <div className={`notice ${styles.empty}`}>
              {isFiltered ? (
                <>
                  <p>No inspections match these filters.</p>
                  <button type="button" className="btn btn--secondary btn--small" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p>No inspections logged yet.</p>
                  <Link to="/new" className="btn btn--primary btn--small">
                    Log the first one
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className={styles.list} aria-busy={query.isFetching && !query.isFetchingNextPage}>
              {inspections.map((inspection) => (
                <li key={inspection.id}>
                  <InspectionCard inspection={inspection} onResolve={setResolving} />
                </li>
              ))}
            </ul>
          )}

          {query.hasNextPage && (
            <button
              type="button"
              className="btn btn--secondary btn--block"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {resolving && <ResolveSheet key={resolving.id} inspection={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
