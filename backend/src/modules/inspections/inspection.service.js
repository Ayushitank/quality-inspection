import { AppError } from '../../utils/AppError.js';
import { SEVERITIES } from './inspection.constants.js';

export function createInspectionService(repository) {
  return {
    async create(input) {
      const inserted = await repository.insert(input);
      if (inserted) return { inspection: inserted, created: true };

      const existing =
        (input.id && (await repository.findById(input.id))) ||
        (input.externalRef && (await repository.findByExternalRef(input.externalRef)));
      if (!existing) throw new Error('Insert conflicted but no existing inspection was found');

      return { inspection: existing, created: false };
    },

    async list(query) {
      const { items, total } = await repository.list(query);
      return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
    },

    async get(id) {
      const inspection = await repository.findById(id);
      if (!inspection) throw AppError.notFound('Inspection not found');
      return inspection;
    },

    async resolve(id, resolutionNote) {
      const resolved = await repository.resolve(id, resolutionNote);
      if (resolved) return resolved;

      const existing = await repository.findById(id);
      if (!existing) throw AppError.notFound('Inspection not found');
      throw AppError.alreadyResolved();
    },

    async summary() {
      const rows = await repository.countBySeverityAndStatus();
      const bySeverity = SEVERITIES.map((severity) => {
        const row = rows.find((candidate) => candidate.severity === severity);
        const open = row?.open ?? 0;
        const resolved = row?.resolved ?? 0;
        return { severity, open, resolved, total: open + resolved };
      });

      const open = bySeverity.reduce((sum, row) => sum + row.open, 0);
      const resolved = bySeverity.reduce((sum, row) => sum + row.resolved, 0);
      return { totals: { open, resolved, total: open + resolved }, bySeverity };
    },
  };
}
