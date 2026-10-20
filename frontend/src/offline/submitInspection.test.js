import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/http.js';
import { createPendingQueue } from './pendingQueue.js';
import { submitInspection } from './submitInspection.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

const form = {
  inspectionDate: '2026-10-19',
  machineId: '  LOOM-07 ',
  defectType: 'HOLE_TEAR',
  severity: 'CRITICAL',
  remarks: '   ',
};

describe('submitInspection', () => {
  let queue;

  beforeEach(() => {
    queue = createPendingQueue(memoryStorage());
  });

  it('sends a trimmed payload with a client-generated id when online', async () => {
    const send = vi.fn(async (payload) => ({ ...payload, status: 'OPEN' }));

    const result = await submitInspection(form, { queue, send, isOnline: () => true });

    expect(result.queued).toBe(false);
    const [payload] = send.mock.calls[0];
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(payload.machineId).toBe('LOOM-07');
    expect(payload.remarks).toBeUndefined();
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('queues without calling the API when the device is offline', async () => {
    const send = vi.fn();

    const result = await submitInspection(form, { queue, send, isOnline: () => false });

    expect(result).toEqual({ queued: true });
    expect(send).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toHaveLength(1);
  });

  it('queues when the request fails to reach the server, keeping the same id for the retry', async () => {
    const send = vi.fn().mockRejectedValue(new NetworkError());

    const result = await submitInspection(form, { queue, send, isOnline: () => true });

    expect(result).toEqual({ queued: true });
    const [queued] = queue.getSnapshot();
    expect(queued.id).toBe(send.mock.calls[0][0].id);
    expect(queued.payload.id).toBe(queued.id);
  });

  it('queues on a 5xx (server down)', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(503, 'HTTP_ERROR', 'Unavailable'));
    expect(await submitInspection(form, { queue, send, isOnline: () => true })).toEqual({ queued: true });
  });

  it('rethrows validation errors instead of queueing them', async () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Bad input', [{ field: 'machineId', message: 'Required' }]);
    const send = vi.fn().mockRejectedValue(error);

    await expect(submitInspection(form, { queue, send, isOnline: () => true })).rejects.toBe(error);
    expect(queue.getSnapshot()).toEqual([]);
  });
});
