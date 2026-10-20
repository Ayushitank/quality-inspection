import { describe, expect, it } from 'vitest';
import { applyFilterChange, countAdvancedFilters, orderLabel, parseFilters, toSearchParams } from './filters.js';

const parse = (query) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
  it('returns defaults for an empty query string', () => {
    expect(parse('')).toEqual({ severity: '', status: '', from: '', to: '', sortBy: 'inspectionDate', order: 'desc' });
  });

  it('reads valid values and ignores invalid ones', () => {
    expect(parse('severity=CRITICAL&status=OPEN&from=2026-10-01&sortBy=severity&order=asc')).toMatchObject({
      severity: 'CRITICAL',
      status: 'OPEN',
      from: '2026-10-01',
      sortBy: 'severity',
      order: 'asc',
    });
    expect(parse('severity=HIGH&status=DONE&from=yesterday&sortBy=remarks&order=up')).toEqual(parse(''));
  });

  it('drops `to` when the range is inverted so the API never receives it', () => {
    expect(parse('from=2026-10-20&to=2026-10-01')).toMatchObject({ from: '2026-10-20', to: '' });
  });
});

describe('toSearchParams', () => {
  it('omits empty and default values', () => {
    expect(toSearchParams(parse('')).toString()).toBe('');
    expect(toSearchParams({ ...parse(''), severity: 'MAJOR', order: 'asc' }).toString()).toBe('severity=MAJOR&order=asc');
  });

  it('round-trips through parseFilters', () => {
    const filters = { severity: 'MINOR', status: 'RESOLVED', from: '2026-10-01', to: '2026-10-19', sortBy: 'machineId', order: 'asc' };
    expect(parseFilters(toSearchParams(filters))).toEqual(filters);
  });
});

describe('applyFilterChange', () => {
  const base = parse('from=2026-10-05&to=2026-10-10');

  it('moves `to` up when `from` is set past it', () => {
    expect(applyFilterChange(base, { from: '2026-10-15' })).toMatchObject({ from: '2026-10-15', to: '2026-10-15' });
  });

  it('moves `from` down when `to` is set before it', () => {
    expect(applyFilterChange(base, { to: '2026-10-01' })).toMatchObject({ from: '2026-10-01', to: '2026-10-01' });
  });

  it('leaves a valid range alone', () => {
    expect(applyFilterChange(base, { severity: 'MAJOR' })).toMatchObject({ from: '2026-10-05', to: '2026-10-10', severity: 'MAJOR' });
  });
});

describe('helpers', () => {
  it('counts only the filters inside the collapsible panel', () => {
    expect(countAdvancedFilters(parse('status=OPEN'))).toBe(0);
    expect(countAdvancedFilters(parse('status=OPEN&severity=MAJOR&from=2026-10-01'))).toBe(2);
  });

  it('words the sort direction for the chosen column', () => {
    expect(orderLabel('inspectionDate', 'desc')).toBe('Newest first');
    expect(orderLabel('severity', 'desc')).toBe('Most severe first');
    expect(orderLabel('machineId', 'asc')).toBe('A to Z');
  });
});
