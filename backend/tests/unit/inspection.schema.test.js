import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInspectionBody,
  idParams,
  listInspectionsQuery,
  resolveInspectionBody,
} from '../../src/modules/inspections/inspection.schema.js';

const valid = {
  inspectionDate: '2026-10-19',
  machineId: '  LOOM-07 ',
  defectType: 'HOLE_TEAR',
  severity: 'CRITICAL',
};

describe('createInspectionBody', () => {
  it('accepts a minimal payload, trimming text and defaulting remarks to null', () => {
    const parsed = createInspectionBody.parse(valid);
    assert.equal(parsed.machineId, 'LOOM-07');
    assert.equal(parsed.remarks, null);
  });

  it('turns blank remarks into null and keeps real remarks trimmed', () => {
    assert.equal(createInspectionBody.parse({ ...valid, remarks: '   ' }).remarks, null);
    assert.equal(createInspectionBody.parse({ ...valid, remarks: ' hole ' }).remarks, 'hole');
  });

  it('does not let clients set source or externalRef', () => {
    const parsed = createInspectionBody.parse({ ...valid, source: 'SAP', externalRef: 'QN-1' });
    assert.equal('source' in parsed, false);
    assert.equal('externalRef' in parsed, false);
  });

  it('rejects impossible calendar dates and wrong formats', () => {
    assert.equal(createInspectionBody.safeParse({ ...valid, inspectionDate: '2026-02-30' }).success, false);
    assert.equal(createInspectionBody.safeParse({ ...valid, inspectionDate: '19/10/2026' }).success, false);
  });

  it('rejects blank machine id, unknown enums and a non-uuid id', () => {
    assert.equal(createInspectionBody.safeParse({ ...valid, machineId: '   ' }).success, false);
    assert.equal(createInspectionBody.safeParse({ ...valid, defectType: 'SCRATCH' }).success, false);
    assert.equal(createInspectionBody.safeParse({ ...valid, severity: 'HIGH' }).success, false);
    assert.equal(createInspectionBody.safeParse({ ...valid, id: 'not-a-uuid' }).success, false);
  });
});

describe('resolveInspectionBody', () => {
  it('requires a non-blank resolution note', () => {
    assert.equal(resolveInspectionBody.safeParse({}).success, false);
    assert.equal(resolveInspectionBody.safeParse({ resolutionNote: '   ' }).success, false);
    assert.equal(resolveInspectionBody.parse({ resolutionNote: ' fixed ' }).resolutionNote, 'fixed');
  });
});

describe('idParams', () => {
  it('only accepts UUIDs', () => {
    assert.equal(idParams.safeParse({ id: 'summary' }).success, false);
    assert.equal(idParams.safeParse({ id: crypto.randomUUID() }).success, true);
  });
});

describe('listInspectionsQuery', () => {
  it('applies defaults', () => {
    assert.deepEqual(listInspectionsQuery.parse({}), {
      sortBy: 'inspectionDate',
      order: 'desc',
      page: 1,
      pageSize: 20,
    });
  });

  it('coerces paging numbers from the query string and caps pageSize', () => {
    assert.equal(listInspectionsQuery.parse({ page: '3', pageSize: '50' }).page, 3);
    assert.equal(listInspectionsQuery.safeParse({ pageSize: '500' }).success, false);
    assert.equal(listInspectionsQuery.safeParse({ page: '0' }).success, false);
  });

  it('rejects sort keys outside the whitelist', () => {
    assert.equal(listInspectionsQuery.safeParse({ sortBy: 'remarks; DROP TABLE inspections' }).success, false);
  });

  it('rejects a date range where from is after to, and accepts equal dates', () => {
    assert.equal(listInspectionsQuery.safeParse({ from: '2026-10-20', to: '2026-10-19' }).success, false);
    assert.equal(listInspectionsQuery.safeParse({ from: '2026-10-19', to: '2026-10-19' }).success, true);
  });
});
