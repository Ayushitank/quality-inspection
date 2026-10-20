export function createFakeRepository() {
  const rows = new Map();

  return {
    rows,

    async insert(input) {
      const id = input.id ?? crypto.randomUUID();
      const duplicateRef = input.externalRef && [...rows.values()].some((row) => row.externalRef === input.externalRef);
      if (rows.has(id) || duplicateRef) return null;

      const inspection = {
        ...input,
        id,
        status: 'OPEN',
        resolutionNote: null,
        resolvedAt: null,
        source: input.source ?? 'MANUAL',
        externalRef: input.externalRef ?? null,
      };
      rows.set(id, inspection);
      return inspection;
    },

    async findById(id) {
      return rows.get(id) ?? null;
    },

    async findByExternalRef(externalRef) {
      return [...rows.values()].find((row) => row.externalRef === externalRef) ?? null;
    },

    async resolve(id, resolutionNote) {
      const row = rows.get(id);
      if (!row || row.status !== 'OPEN') return null;
      Object.assign(row, { status: 'RESOLVED', resolutionNote, resolvedAt: new Date().toISOString() });
      return row;
    },

    async list() {
      return { items: [...rows.values()], total: rows.size };
    },

    async countBySeverityAndStatus() {
      const counts = new Map();
      for (const { severity, status } of rows.values()) {
        const entry = counts.get(severity) ?? { severity, open: 0, resolved: 0 };
        if (status === 'OPEN') entry.open += 1;
        else entry.resolved += 1;
        counts.set(severity, entry);
      }
      return [...counts.values()];
    },
  };
}
