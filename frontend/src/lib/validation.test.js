import { describe, expect, it } from 'vitest';
import { todayISO } from './format.js';
import { validateInspection, validateResolutionNote } from './validation.js';

const valid = { inspectionDate: '2026-10-19', machineId: 'LOOM-07', defectType: 'HOLE_TEAR', severity: 'MAJOR', remarks: '' };

describe('validateInspection', () => {
  it('accepts a complete form (remarks optional)', () => {
    expect(validateInspection(valid)).toEqual({});
  });

  it('flags every missing required field', () => {
    const errors = validateInspection({ inspectionDate: '', machineId: '   ', defectType: '', severity: '', remarks: '' });
    expect(Object.keys(errors).sort()).toEqual(['defectType', 'inspectionDate', 'machineId', 'severity']);
  });

  it('rejects a future date but accepts today (local time)', () => {
    expect(validateInspection({ ...valid, inspectionDate: '2999-01-01' }).inspectionDate).toBeDefined();
    expect(validateInspection({ ...valid, inspectionDate: todayISO() }).inspectionDate).toBeUndefined();
  });

  it('enforces length limits', () => {
    expect(validateInspection({ ...valid, machineId: 'x'.repeat(51) }).machineId).toBeDefined();
    expect(validateInspection({ ...valid, remarks: 'x'.repeat(1001) }).remarks).toBeDefined();
  });
});

describe('validateResolutionNote', () => {
  it('requires a non-blank note', () => {
    expect(validateResolutionNote('   ')).not.toBe('');
    expect(validateResolutionNote('Replaced reed')).toBe('');
  });
});

describe('todayISO', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
