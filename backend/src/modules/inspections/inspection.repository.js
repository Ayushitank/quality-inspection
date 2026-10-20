const COLUMNS = `
  id, inspection_date, machine_id, defect_type, severity, status, remarks,
  resolution_note, resolved_at, source, external_ref, created_at, updated_at`;

const SORT_SQL = {
  inspectionDate: 'inspection_date',
  severity: "array_position(ARRAY['MINOR', 'MAJOR', 'CRITICAL']::text[], severity)",
  status: 'status',
  machineId: 'machine_id',
  createdAt: 'created_at',
};

const toInspection = (row) => ({
  id: row.id,
  inspectionDate: row.inspection_date,
  machineId: row.machine_id,
  defectType: row.defect_type,
  severity: row.severity,
  status: row.status,
  remarks: row.remarks,
  resolutionNote: row.resolution_note,
  resolvedAt: row.resolved_at,
  source: row.source,
  externalRef: row.external_ref,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createInspectionRepository(pool) {
  return {
    async insert(input) {
      const { rows } = await pool.query(
        `INSERT INTO inspections
           (id, inspection_date, machine_id, defect_type, severity, remarks, source, external_ref)
         VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING ${COLUMNS}`,
        [
          input.id ?? null,
          input.inspectionDate,
          input.machineId,
          input.defectType,
          input.severity,
          input.remarks,
          input.source ?? 'MANUAL',
          input.externalRef ?? null,
        ],
      );
      return rows[0] ? toInspection(rows[0]) : null;
    },

    async findById(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM inspections WHERE id = $1`, [id]);
      return rows[0] ? toInspection(rows[0]) : null;
    },

    async findByExternalRef(externalRef) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM inspections WHERE external_ref = $1`, [externalRef]);
      return rows[0] ? toInspection(rows[0]) : null;
    },

    async list({ severity, status, from, to, sortBy, order, page, pageSize }) {
      const conditions = [];
      const params = [];
      const addFilter = (sql, value) => {
        params.push(value);
        conditions.push(sql.replace('?', `$${params.length}`));
      };

      if (severity) addFilter('severity = ?', severity);
      if (status) addFilter('status = ?', status);
      if (from) addFilter('inspection_date >= ?', from);
      if (to) addFilter('inspection_date <= ?', to);

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const direction = order === 'asc' ? 'ASC' : 'DESC';
      const paging = [pageSize, (page - 1) * pageSize];

      const [items, count] = await Promise.all([
        pool.query(
          `SELECT ${COLUMNS} FROM inspections ${where}
           ORDER BY ${SORT_SQL[sortBy]} ${direction}, created_at DESC, id
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, ...paging],
        ),
        pool.query(`SELECT count(*)::int AS total FROM inspections ${where}`, params),
      ]);

      return { items: items.rows.map(toInspection), total: count.rows[0].total };
    },

    async countBySeverityAndStatus() {
      const { rows } = await pool.query(`
        SELECT severity,
               count(*) FILTER (WHERE status = 'OPEN')::int     AS open,
               count(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved
        FROM inspections
        GROUP BY severity`);
      return rows;
    },

    async resolve(id, resolutionNote) {
      const { rows } = await pool.query(
        `UPDATE inspections
            SET status = 'RESOLVED', resolution_note = $2, resolved_at = now(), updated_at = now()
          WHERE id = $1 AND status = 'OPEN'
          RETURNING ${COLUMNS}`,
        [id, resolutionNote],
      );
      return rows[0] ? toInspection(rows[0]) : null;
    },

    async count() {
      const { rows } = await pool.query('SELECT count(*)::int AS total FROM inspections');
      return rows[0].total;
    },
  };
}
