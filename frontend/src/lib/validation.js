import { MAX_MACHINE_ID_LENGTH, MAX_TEXT_LENGTH } from './constants.js';
import { todayISO } from './format.js';

export function validateInspection(values) {
  const errors = {};

  if (!values.inspectionDate) errors.inspectionDate = 'Select the inspection date';
  else if (values.inspectionDate > todayISO()) errors.inspectionDate = 'The date cannot be in the future';

  const machineId = values.machineId.trim();
  if (!machineId) errors.machineId = 'Enter the machine or line ID';
  else if (machineId.length > MAX_MACHINE_ID_LENGTH) errors.machineId = `Use ${MAX_MACHINE_ID_LENGTH} characters or fewer`;

  if (!values.defectType) errors.defectType = 'Select a defect type';
  if (!values.severity) errors.severity = 'Select a severity';
  if (values.remarks.length > MAX_TEXT_LENGTH) errors.remarks = `Use ${MAX_TEXT_LENGTH} characters or fewer`;

  return errors;
}

export function validateResolutionNote(note) {
  if (!note.trim()) return 'A resolution note is required';
  if (note.length > MAX_TEXT_LENGTH) return `Use ${MAX_TEXT_LENGTH} characters or fewer`;
  return '';
}
