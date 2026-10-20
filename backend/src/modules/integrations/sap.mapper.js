import { z } from 'zod';
import { isoDate } from '../inspections/inspection.schema.js';

export const sapNotificationSchema = z.object({
  notificationId: z.string().trim().min(1).max(50),
  workCenter: z.string().trim().min(1).max(50),
  defectCode: z.string().trim().min(1).max(20),
  priority: z.coerce.string().trim().pipe(z.enum(['1', '2', '3'], 'priority must be 1, 2 or 3')),
  reportedOn: isoDate,
  description: z.string().trim().max(1000).optional(),
});

const DEFECT_CODE_TO_TYPE = {
  WEAVE: 'WEAVE_DEFECT',
  SHADE: 'SHADE_VARIATION',
  HOLE: 'HOLE_TEAR',
  COUNT: 'COUNT_DEVIATION',
};

const PRIORITY_TO_SEVERITY = { 1: 'CRITICAL', 2: 'MAJOR', 3: 'MINOR' };

export function toInspectionInput(notification) {
  return {
    inspectionDate: notification.reportedOn,
    machineId: notification.workCenter,
    defectType: DEFECT_CODE_TO_TYPE[notification.defectCode.toUpperCase()] ?? 'OTHER',
    severity: PRIORITY_TO_SEVERITY[notification.priority],
    remarks: notification.description || null,
    source: 'SAP',
    externalRef: notification.notificationId,
  };
}
