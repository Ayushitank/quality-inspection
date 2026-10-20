import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createInspectionService } from '../../src/modules/inspections/inspection.service.js';
import { createFakeRepository } from '../helpers/fakeRepository.js';

const input = (overrides = {}) => ({
  inspectionDate: '2026-10-19',
  machineId: 'LOOM-07',
  defectType: 'HOLE_TEAR',
  severity: 'CRITICAL',
  remarks: null,
  ...overrides,
});

describe('inspection service', () => {
  let service;

  beforeEach(() => {
    service = createInspectionService(createFakeRepository());
  });

  describe('create', () => {
    it('stores a new OPEN inspection', async () => {
      const { inspection, created } = await service.create(input());
      assert.equal(created, true);
      assert.equal(inspection.status, 'OPEN');
    });

    it('replays a retried client id instead of duplicating it', async () => {
      const id = crypto.randomUUID();
      const first = await service.create(input({ id }));
      const retry = await service.create(input({ id }));
      assert.equal(first.created, true);
      assert.equal(retry.created, false);
      assert.equal(retry.inspection.id, first.inspection.id);
    });

    it('replays a retried SAP notification by external reference', async () => {
      const sap = input({ source: 'SAP', externalRef: 'QN-1' });
      const first = await service.create(sap);
      const retry = await service.create(sap);
      assert.equal(retry.created, false);
      assert.equal(retry.inspection.id, first.inspection.id);
    });
  });

  describe('resolve', () => {
    it('marks an open inspection as resolved with the note', async () => {
      const { inspection } = await service.create(input());
      const resolved = await service.resolve(inspection.id, 'Reed replaced');
      assert.equal(resolved.status, 'RESOLVED');
      assert.equal(resolved.resolutionNote, 'Reed replaced');
    });

    it('fails with 404 for an unknown inspection', async () => {
      await assert.rejects(service.resolve(crypto.randomUUID(), 'note'), { status: 404, code: 'NOT_FOUND' });
    });

    it('fails with 409 when already resolved', async () => {
      const { inspection } = await service.create(input());
      await service.resolve(inspection.id, 'first');
      await assert.rejects(service.resolve(inspection.id, 'second'), { status: 409, code: 'ALREADY_RESOLVED' });
    });
  });

  describe('get', () => {
    it('fails with 404 for an unknown inspection', async () => {
      await assert.rejects(service.get(crypto.randomUUID()), { status: 404 });
    });
  });

  describe('summary', () => {
    it('returns every severity zero-filled, most severe first', async () => {
      assert.deepEqual(await service.summary(), {
        totals: { open: 0, resolved: 0, total: 0 },
        bySeverity: [
          { severity: 'CRITICAL', open: 0, resolved: 0, total: 0 },
          { severity: 'MAJOR', open: 0, resolved: 0, total: 0 },
          { severity: 'MINOR', open: 0, resolved: 0, total: 0 },
        ],
      });
    });

    it('counts open and resolved per severity and in total', async () => {
      const critical = await service.create(input({ severity: 'CRITICAL' }));
      await service.create(input({ severity: 'CRITICAL' }));
      await service.create(input({ severity: 'MINOR' }));
      await service.resolve(critical.inspection.id, 'done');

      const { totals, bySeverity } = await service.summary();
      assert.deepEqual(totals, { open: 2, resolved: 1, total: 3 });
      assert.deepEqual(bySeverity[0], { severity: 'CRITICAL', open: 1, resolved: 1, total: 2 });
      assert.deepEqual(bySeverity[1], { severity: 'MAJOR', open: 0, resolved: 0, total: 0 });
      assert.deepEqual(bySeverity[2], { severity: 'MINOR', open: 1, resolved: 0, total: 1 });
    });
  });
});
