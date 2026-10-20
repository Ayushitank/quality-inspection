import { SEVERITIES, SORT_OPTIONS, STATUSES } from './constants.js';

export const DEFAULT_SORT = { sortBy: 'inspectionDate', order: 'desc' };

const isOneOf = (options, value) => options.some((option) => option.value === value);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function parseFilters(searchParams) {
  const read = (key) => searchParams.get(key) ?? '';
  const severity = read('severity');
  const status = read('status');
  const from = read('from');
  const to = read('to');
  const sortBy = read('sortBy');
  const order = read('order');

  const filters = {
    severity: isOneOf(SEVERITIES, severity) ? severity : '',
    status: isOneOf(STATUSES, status) ? status : '',
    from: isDate(from) ? from : '',
    to: isDate(to) ? to : '',
    sortBy: isOneOf(SORT_OPTIONS, sortBy) ? sortBy : DEFAULT_SORT.sortBy,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_SORT.order,
  };

  if (filters.from && filters.to && filters.from > filters.to) filters.to = '';
  return filters;
}

export function toSearchParams(filters) {
  const params = new URLSearchParams();
  for (const key of ['severity', 'status', 'from', 'to']) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.sortBy !== DEFAULT_SORT.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.order !== DEFAULT_SORT.order) params.set('order', filters.order);
  return params;
}

export function applyFilterChange(filters, patch) {
  const next = { ...filters, ...patch };
  if (next.from && next.to && next.from > next.to) {
    if ('from' in patch) next.to = next.from;
    else next.from = next.to;
  }
  return next;
}

export function orderLabel(sortBy, order) {
  const descending = order === 'desc';
  if (sortBy === 'inspectionDate' || sortBy === 'createdAt') return descending ? 'Newest first' : 'Oldest first';
  if (sortBy === 'severity') return descending ? 'Most severe first' : 'Least severe first';
  if (sortBy === 'status') return descending ? 'Resolved first' : 'Open first';
  return descending ? 'Z to A' : 'A to Z';
}

export function countAdvancedFilters(filters) {
  return ['severity', 'from', 'to'].filter((key) => filters[key]).length;
}
