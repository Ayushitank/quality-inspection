import { createInspection } from '../api/inspections.js';
import { isRetryable } from '../api/http.js';
import { uuid } from '../lib/uuid.js';
import { pendingQueue } from './store.js';

export async function submitInspection(values, deps = {}) {
  const {
    queue = pendingQueue,
    send = createInspection,
    isOnline = () => navigator.onLine,
  } = deps;

  const payload = {
    id: uuid(),
    inspectionDate: values.inspectionDate,
    machineId: values.machineId.trim(),
    defectType: values.defectType,
    severity: values.severity,
    remarks: values.remarks.trim() || undefined,
  };

  if (!isOnline()) {
    queue.enqueue(payload);
    return { queued: true };
  }

  try {
    return { queued: false, inspection: await send(payload) };
  } catch (error) {
    if (!isRetryable(error)) throw error;
    queue.enqueue(payload);
    return { queued: true };
  }
}
