import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { migrate } from '../../src/db/migrate.js';
import { createPool } from '../../src/db/pool.js';
import { createInspectionRepository } from '../../src/modules/inspections/inspection.repository.js';
import { createInspectionService } from '../../src/modules/inspections/inspection.service.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://qit:qit@localhost:5433/qit';
const WEBHOOK_SECRET = 'test-secret-123';

async function isReachable(url) {
  const probe = createPool(url, { connectionTimeoutMillis: 2000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end();
  }
}

const reachable = await isReachable(DATABASE_URL);

describe('API (PostgreSQL)', { skip: !reachable && 'PostgreSQL not reachable (docker compose up -d db)' }, () => {
  const schema = `test_${randomBytes(4).toString('hex')}`;
  let admin;
  let pool;
  let api;

  const body = (overrides = {}) => ({
    inspectionDate: '2026-10-19',
    machineId: 'LOOM-07',
    defectType: 'HOLE_TEAR',
    severity: 'CRITICAL',
    ...overrides,
  });

  const create = async (overrides) => (await api.post('/api/inspections').send(body(overrides)).expect(201)).body.data;

  before(async () => {
    admin = createPool(DATABASE_URL);
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = createPool(DATABASE_URL, { options: `-c search_path=${schema}` });
    await migrate(pool, { log: { info() {} } });

    api = request(
      createApp({
        inspectionService: createInspectionService(createInspectionRepository(pool)),
        checkDb: () => pool.query('SELECT 1'),
        sapWebhookSecret: WEBHOOK_SECRET,
        logRequests: false,
      }),
    );
  });

  after(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it('reports health', async () => {
    const res = await api.get('/api/health').expect(200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  describe('POST /api/inspections', () => {
    it('creates an OPEN inspection (201) with a Location header and date kept as YYYY-MM-DD', async () => {
      const res = await api.post('/api/inspections').send(body({ remarks: ' near selvedge ' })).expect(201);

      assert.match(res.headers.location, /^\/api\/inspections\/[0-9a-f-]{36}$/);
      assert.equal(res.body.data.status, 'OPEN');
      assert.equal(res.body.data.inspectionDate, '2026-10-19');
      assert.equal(res.body.data.remarks, 'near selvedge');
      assert.equal(res.body.data.source, 'MANUAL');
      assert.equal(res.body.data.resolutionNote, null);
    });

    it('returns 400 with per-field details for invalid input', async () => {
      const res = await api.post('/api/inspections').send({ machineId: '', severity: 'HIGH' }).expect(400);

      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      const fields = res.body.error.details.map((detail) => detail.field);
      assert.ok(['machineId', 'severity', 'inspectionDate', 'defectType'].every((field) => fields.includes(field)));
    });

    it('is idempotent for a client-supplied id (200 replay, no duplicate row)', async () => {
      const id = crypto.randomUUID();
      const first = await api.post('/api/inspections').send(body({ id })).expect(201);
      const replay = await api.post('/api/inspections').send(body({ id, machineId: 'CHANGED' })).expect(200);

      assert.equal(replay.body.data.id, first.body.data.id);
      assert.equal(replay.body.data.machineId, 'LOOM-07');
    });

    it('returns 400 (not 500) for malformed JSON', async () => {
      const res = await api.post('/api/inspections').set('Content-Type', 'application/json').send('{oops').expect(400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
    });
  });

  describe('GET /api/inspections/:id', () => {
    it('returns one inspection', async () => {
      const created = await create();
      const res = await api.get(`/api/inspections/${created.id}`).expect(200);
      assert.equal(res.body.data.id, created.id);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      const missing = await api.get(`/api/inspections/${crypto.randomUUID()}`).expect(404);
      assert.equal(missing.body.error.code, 'NOT_FOUND');
      await api.get('/api/inspections/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/inspections (list)', () => {
    const fixtures = [
      { machineId: 'LIST-A', severity: 'MINOR', inspectionDate: '2026-01-10' },
      { machineId: 'LIST-B', severity: 'CRITICAL', inspectionDate: '2026-01-12' },
      { machineId: 'LIST-C', severity: 'MAJOR', inspectionDate: '2026-01-14' },
      { machineId: 'LIST-D', severity: 'CRITICAL', inspectionDate: '2026-01-16' },
    ];
    const listed = (query) => api.get('/api/inspections').query({ from: '2026-01-01', to: '2026-01-31', ...query });
    const machines = (res) => res.body.data.map((row) => row.machineId);

    before(async () => {
      const created = [];
      for (const fixture of fixtures) created.push(await create(fixture));
      await api.post(`/api/inspections/${created[1].id}/resolve`).send({ resolutionNote: 'fixed' }).expect(200);
    });

    it('defaults to newest inspection date first and reports paging meta', async () => {
      const res = await listed().expect(200);
      assert.deepEqual(machines(res), ['LIST-D', 'LIST-C', 'LIST-B', 'LIST-A']);
      assert.deepEqual(res.body.meta, { page: 1, pageSize: 20, total: 4 });
    });

    it('filters by severity, status and inclusive date range', async () => {
      assert.deepEqual(machines(await listed({ severity: 'CRITICAL' }).expect(200)), ['LIST-D', 'LIST-B']);
      assert.deepEqual(machines(await listed({ severity: 'CRITICAL', status: 'OPEN' }).expect(200)), ['LIST-D']);
      assert.deepEqual(machines(await listed({ status: 'RESOLVED' }).expect(200)), ['LIST-B']);
      assert.deepEqual(
        machines(await listed({ from: '2026-01-12', to: '2026-01-14' }).expect(200)),
        ['LIST-C', 'LIST-B'],
      );
    });

    it('sorts by severity by importance, in both directions', async () => {
      const desc = machines(await listed({ sortBy: 'severity', order: 'desc' }).expect(200));
      assert.deepEqual(desc.slice(0, 2).sort(), ['LIST-B', 'LIST-D']);
      assert.deepEqual(desc.slice(2), ['LIST-C', 'LIST-A']);

      const asc = machines(await listed({ sortBy: 'severity', order: 'asc' }).expect(200));
      assert.deepEqual(asc.slice(0, 2), ['LIST-A', 'LIST-C']);
    });

    it('sorts by machine id ascending', async () => {
      const res = await listed({ sortBy: 'machineId', order: 'asc' }).expect(200);
      assert.deepEqual(machines(res), ['LIST-A', 'LIST-B', 'LIST-C', 'LIST-D']);
    });

    it('pages without overlap and keeps the full total', async () => {
      const first = await listed({ pageSize: 3, page: 1 }).expect(200);
      const second = await listed({ pageSize: 3, page: 2 }).expect(200);

      assert.deepEqual(machines(first), ['LIST-D', 'LIST-C', 'LIST-B']);
      assert.deepEqual(machines(second), ['LIST-A']);
      assert.equal(second.body.meta.total, 4);
    });

    it('rejects bad query parameters with 400', async () => {
      await listed({ from: '2026-02-01', to: '2026-01-01' }).expect(400);
      await listed({ sortBy: 'remarks' }).expect(400);
      await listed({ severity: 'HIGH' }).expect(400);
      await listed({ pageSize: 1000 }).expect(400);
    });
  });

  describe('POST /api/inspections/:id/resolve', () => {
    it('requires a non-blank resolution note (400)', async () => {
      const { id } = await create();
      await api.post(`/api/inspections/${id}/resolve`).send({}).expect(400);
      const blank = await api.post(`/api/inspections/${id}/resolve`).send({ resolutionNote: '   ' }).expect(400);
      assert.equal(blank.body.error.code, 'VALIDATION_ERROR');
      assert.equal((await api.get(`/api/inspections/${id}`)).body.data.status, 'OPEN');
    });

    it('resolves an open inspection (200) and stamps resolvedAt', async () => {
      const { id } = await create();
      const res = await api.post(`/api/inspections/${id}/resolve`).send({ resolutionNote: ' Reed replaced ' }).expect(200);

      assert.equal(res.body.data.status, 'RESOLVED');
      assert.equal(res.body.data.resolutionNote, 'Reed replaced');
      assert.ok(Date.parse(res.body.data.resolvedAt));
    });

    it('returns 409 when resolved twice and keeps the first note', async () => {
      const { id } = await create();
      await api.post(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'first' }).expect(200);
      const again = await api.post(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'second' }).expect(409);

      assert.equal(again.body.error.code, 'ALREADY_RESOLVED');
      assert.equal((await api.get(`/api/inspections/${id}`)).body.data.resolutionNote, 'first');
    });

    it('returns 404 for an unknown inspection', async () => {
      await api.post(`/api/inspections/${crypto.randomUUID()}/resolve`).send({ resolutionNote: 'x' }).expect(404);
    });

    it('is backed by a database constraint, not just the service', async () => {
      const { id } = await create();
      await assert.rejects(
        pool.query("UPDATE inspections SET status = 'RESOLVED', resolved_at = now() WHERE id = $1", [id]),
        { constraint: 'resolved_requires_note' },
      );
    });
  });

  describe('GET /api/inspections/summary', () => {
    it('counts open and resolved per severity, consistent with the list totals', async () => {
      const { body: { data } } = await api.get('/api/inspections/summary').expect(200);
      const listTotal = (await api.get('/api/inspections').query({ pageSize: 1 })).body.meta.total;

      assert.deepEqual(data.bySeverity.map((row) => row.severity), ['CRITICAL', 'MAJOR', 'MINOR']);
      assert.equal(data.totals.total, listTotal);
      assert.equal(data.totals.open + data.totals.resolved, data.totals.total);
      for (const row of data.bySeverity) assert.equal(row.open + row.resolved, row.total);
    });
  });

  describe('POST /api/sap-webhook', () => {
    const notification = (overrides = {}) => ({
      notificationId: `QN-${randomBytes(3).toString('hex')}`,
      workCenter: 'LOOM-09',
      defectCode: 'HOLE',
      priority: '1',
      reportedOn: '2026-10-19',
      description: 'Hole near selvedge',
      ...overrides,
    });
    const post = (payload, secret = WEBHOOK_SECRET) => {
      const req = api.post('/api/sap-webhook');
      return (secret === null ? req : req.set('X-Webhook-Secret', secret)).send(payload);
    };

    it('rejects requests without or with a wrong secret (401)', async () => {
      const missing = await post(notification(), null).expect(401);
      assert.equal(missing.body.error.code, 'UNAUTHORIZED');
      await post(notification(), 'wrong').expect(401);
    });

    it('creates an inspection from a notification (201) and flags it as SAP', async () => {
      const payload = notification({ defectCode: 'SHADE', priority: 2 });
      const res = await post(payload).expect(201);

      assert.equal(res.body.data.source, 'SAP');
      assert.equal(res.body.data.externalRef, payload.notificationId);
      assert.equal(res.body.data.defectType, 'SHADE_VARIATION');
      assert.equal(res.body.data.severity, 'MAJOR');
      assert.equal(res.body.data.status, 'OPEN');
    });

    it('is idempotent per notificationId (200, same record)', async () => {
      const payload = notification();
      const first = await post(payload).expect(201);
      const retry = await post(payload).expect(200);
      assert.equal(retry.body.data.id, first.body.data.id);
    });

    it('returns 400 for an invalid payload', async () => {
      const res = await post(notification({ priority: '9', reportedOn: 'yesterday' })).expect(400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  it('returns the JSON error envelope for unknown API routes', async () => {
    const res = await api.get('/api/nope').expect(404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
