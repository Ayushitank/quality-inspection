export const DEFECT_TYPES = [
  { value: 'WEAVE_DEFECT', label: 'Weave Defect' },
  { value: 'SHADE_VARIATION', label: 'Shade Variation' },
  { value: 'HOLE_TEAR', label: 'Hole/Tear' },
  { value: 'COUNT_DEVIATION', label: 'Count Deviation' },
  { value: 'OTHER', label: 'Other' },
];

export const SEVERITIES = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'MINOR', label: 'Minor' },
];

export const STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export const SORT_OPTIONS = [
  { value: 'inspectionDate', label: 'Inspection date' },
  { value: 'severity', label: 'Severity' },
  { value: 'status', label: 'Status' },
  { value: 'machineId', label: 'Machine / line' },
  { value: 'createdAt', label: 'Date logged' },
];

export const MAX_TEXT_LENGTH = 1000;
export const MAX_MACHINE_ID_LENGTH = 50;
export const PAGE_SIZE = 20;

export const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? value;
