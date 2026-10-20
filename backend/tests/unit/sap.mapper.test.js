import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sapNotificationSchema, toInspectionInput } from '../../src/modules/integrations/sap.mapper.js';

const payload = {
  notificationId: 'QN-100234',
  workCenter: 'LOOM-07',
  defectCode: 'HOLE',
  priority: '1',
  reportedOn: '2026-10-19',
  description: 'Hole near selvedge, roll R-4471',
};

describe('SAP mapper', () => {
  it('maps a notification onto an inspection flagged as SAP-sourced', () => {
    assert.deepEqual(toInspectionInput(sapNotificationSchema.parse(payload)), {
      inspectionDate: '2026-10-19',
      machineId: 'LOOM-07',
      defectType: 'HOLE_TEAR',
      severity: 'CRITICAL',
      remarks: 'Hole near selvedge, roll R-4471',
      source: 'SAP',
      externalRef: 'QN-100234',
    });
  });

  it('maps every priority and falls back to OTHER for unknown defect codes', () => {
    const map = (overrides) => toInspectionInput(sapNotificationSchema.parse({ ...payload, ...overrides }));
    assert.equal(map({ priority: '2' }).severity, 'MAJOR');
    assert.equal(map({ priority: 3 }).severity, 'MINOR');
    assert.equal(map({ defectCode: 'weave' }).defectType, 'WEAVE_DEFECT');
    assert.equal(map({ defectCode: 'XYZ' }).defectType, 'OTHER');
  });

  it('treats a missing description as null remarks', () => {
    const { description, ...withoutDescription } = payload;
    assert.equal(toInspectionInput(sapNotificationSchema.parse(withoutDescription)).remarks, null);
  });

  it('rejects out-of-range priorities and missing identifiers', () => {
    assert.equal(sapNotificationSchema.safeParse({ ...payload, priority: '4' }).success, false);
    assert.equal(sapNotificationSchema.safeParse({ ...payload, notificationId: '' }).success, false);
  });
});
