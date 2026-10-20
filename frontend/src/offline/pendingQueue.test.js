import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/http.js';
import { createPendingQueue, flushQueue } from './pendingQueue.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

const payload = (id) => ({ id, machineId: `LOOM-${id}`, severity: 'MAJOR' });

describe('pending queue', () => {
  let storage;
  let queue;

  beforeEach(() => {
    storage = memoryStorage();
    queue = createPendingQueue(storage);
  });

  it('keeps items oldest-first and persists them across a reload', () => {
    queue.enqueue(payload('1'));
    queue.enqueue(payload('2'));

    const reloaded = createPendingQueue(storage);
    expect(reloaded.getSnapshot().map((item) => item.id)).toEqual(['1', '2']);
  });

  it('ignores a second enqueue of the same id', () => {
    queue.enqueue(payload('1'));
    queue.enqueue(payload('1'));
    expect(queue.getSnapshot()).toHaveLength(1);
  });

  it('survives corrupted storage', () => {
    storage.setItem('qit.pendingInspections', '{not json');
    expect(createPendingQueue(storage).getSnapshot()).toEqual([]);
  });

  it('notifies subscribers on every change until unsubscribed', () => {
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    queue.enqueue(payload('1'));
    queue.remove('1');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    queue.enqueue(payload('2'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite another tab's changes with a stale copy", () => {
    const otherTab = createPendingQueue(storage);
    queue.enqueue(payload('1'));
    otherTab.enqueue(payload('2'));
    queue.remove('1');

    expect(createPendingQueue(storage).getSnapshot().map((item) => item.id)).toEqual(['2']);
  });

  it('retry() clears a failure so the item is attempted again', () => {
    queue.enqueue(payload('1'));
    queue.markFailed('1', 'rejected');
    expect(queue.getSnapshot()[0].failure).toBe('rejected');

    queue.retry('1');
    expect(queue.getSnapshot()[0].failure).toBeUndefined();
  });

  it('throws when storage rejects the write, so nothing is reported as saved', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => createPendingQueue(full).enqueue(payload('1'))).toThrow('QuotaExceededError');
  });
});

describe('flushQueue', () => {
  let queue;

  beforeEach(() => {
    queue = createPendingQueue(memoryStorage());
    ['1', '2', '3'].forEach((id) => queue.enqueue(payload(id)));
  });

  it('sends everything oldest-first and empties the queue', async () => {
    const sent = [];
    const result = await flushQueue(queue, async (item) => sent.push(item.id));

    expect(sent).toEqual(['1', '2', '3']);
    expect(result).toEqual({ synced: 3 });
    expect(queue.getSnapshot()).toEqual([]);
  });

  it('stops at the first network failure and keeps the rest for later', async () => {
    const send = vi.fn(async (item) => {
      if (item.id === '2') throw new NetworkError();
    });

    const result = await flushQueue(queue, send);

    expect(result).toEqual({ synced: 1 });
    expect(send).toHaveBeenCalledTimes(2);    expect(queue.getSnapshot().map((item) => item.id)).toEqual(['2', '3']);
  });

  it('treats a 5xx as retryable (server down) and stops', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(502, 'HTTP_ERROR', 'Bad gateway'));

    await flushQueue(queue, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toHaveLength(3);
  });

  it('marks a 4xx rejection as failed but keeps syncing the items behind it', async () => {
    const send = vi.fn(async (item) => {
      if (item.id === '1') throw new ApiError(400, 'VALIDATION_ERROR', 'Bad input');
    });

    const result = await flushQueue(queue, send);

    expect(result).toEqual({ synced: 2 });
    expect(queue.getSnapshot()).toHaveLength(1);
    expect(queue.getSnapshot()[0]).toMatchObject({ id: '1', failure: 'Bad input' });
  });

  it('skips items already marked failed until they are retried', async () => {
    queue.markFailed('1', 'rejected');
    const send = vi.fn().mockResolvedValue({});

    await flushQueue(queue, send);

    expect(send.mock.calls.map(([item]) => item.id)).toEqual(['2', '3']);
    expect(queue.getSnapshot().map((item) => item.id)).toEqual(['1']);
  });
});
