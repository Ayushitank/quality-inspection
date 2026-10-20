import { z } from 'zod';
import {
  DEFECT_TYPES,
  MAX_MACHINE_ID_LENGTH,
  MAX_TEXT_LENGTH,
  SEVERITIES,
  SORT_KEYS,
  STATUSES,
} from './inspection.constants.js';

function isRealDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isRealDate, 'Not a real calendar date');

const optionalText = z
  .string()
  .trim()
  .max(MAX_TEXT_LENGTH, `Must be ${MAX_TEXT_LENGTH} characters or fewer`)
  .nullish()
  .transform((value) => value || null);

const machineId = z
  .string()
  .trim()
  .min(1, 'Machine / line ID is required')
  .max(MAX_MACHINE_ID_LENGTH, `Must be ${MAX_MACHINE_ID_LENGTH} characters or fewer`);

export const createInspectionBody = z.object({
  id: z.uuid().optional(),
  inspectionDate: isoDate,
  machineId,
  defectType: z.enum(DEFECT_TYPES),
  severity: z.enum(SEVERITIES),
  remarks: optionalText,
});

export const resolveInspectionBody = z.object({
  resolutionNote: z
    .string()
    .trim()
    .min(1, 'A resolution note is required')
    .max(MAX_TEXT_LENGTH, `Must be ${MAX_TEXT_LENGTH} characters or fewer`),
});

export const idParams = z.object({ id: z.uuid('Inspection id must be a UUID') });

export const listInspectionsQuery = z
  .object({
    severity: z.enum(SEVERITIES).optional(),
    status: z.enum(STATUSES).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    sortBy: z.enum(SORT_KEYS).default('inspectionDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });
