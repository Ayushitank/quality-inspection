import { useState } from 'react';
import { SEVERITIES, SORT_OPTIONS, STATUSES } from '../lib/constants.js';
import { countAdvancedFilters, orderLabel } from '../lib/filters.js';
import styles from './FilterBar.module.css';

const STATUS_TABS = [{ value: '', label: 'All' }, ...STATUSES];

export function FilterBar({ filters, onChange, onClear }) {
  const advancedCount = countAdvancedFilters(filters);
  const [panelOpen, setPanelOpen] = useState(advancedCount > 0);
  const hasAnyFilter = advancedCount > 0 || filters.status !== '';
  const nextOrder = filters.order === 'asc' ? 'desc' : 'asc';

  return (
    <section className={styles.bar} aria-label="Filter and sort inspections">
      <div className={styles.tabs} role="group" aria-label="Status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={styles.tab}
            aria-pressed={filters.status === tab.value}
            onClick={() => onChange({ status: tab.value })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className="btn btn--secondary btn--small"
          aria-expanded={panelOpen}
          aria-controls="filter-panel"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          Filters
          {advancedCount > 0 && <span className={styles.count}>{advancedCount}</span>}
        </button>

        <label className="visually-hidden" htmlFor="sort-by">
          Sort by
        </label>
        <select
          id="sort-by"
          className={`input ${styles.sort}`}
          value={filters.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`btn btn--secondary ${styles.order}`}
          aria-label={`${orderLabel(filters.sortBy, filters.order)}. Switch to ${orderLabel(filters.sortBy, nextOrder)}`}
          onClick={() => onChange({ order: nextOrder })}
        >
          <span aria-hidden="true">{filters.order === 'asc' ? '↑' : '↓'}</span>
        </button>
      </div>

      {panelOpen && (
        <div id="filter-panel" className={styles.panel}>
          <div className="field">
            <label className="field__label" htmlFor="filter-severity">
              Severity
            </label>
            <select
              id="filter-severity"
              className="input"
              value={filters.severity}
              onChange={(event) => onChange({ severity: event.target.value })}
            >
              <option value="">All severities</option>
              {SEVERITIES.map((severity) => (
                <option key={severity.value} value={severity.value}>
                  {severity.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dates}>
            <div className="field">
              <label className="field__label" htmlFor="filter-from">
                From
              </label>
              <input
                id="filter-from"
                type="date"
                className="input"
                value={filters.from}
                onChange={(event) => onChange({ from: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="filter-to">
                To
              </label>
              <input
                id="filter-to"
                type="date"
                className="input"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => onChange({ to: event.target.value })}
              />
            </div>
          </div>

          {hasAnyFilter && (
            <button type="button" className="btn btn--secondary btn--small" onClick={onClear}>
              Clear all filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
