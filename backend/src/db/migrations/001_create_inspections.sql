CREATE TABLE inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_date DATE NOT NULL,
  machine_id      TEXT NOT NULL CHECK (char_length(machine_id) BETWEEN 1 AND 50),
  defect_type     TEXT NOT NULL CHECK (defect_type IN
                    ('WEAVE_DEFECT', 'SHADE_VARIATION', 'HOLE_TEAR', 'COUNT_DEVIATION', 'OTHER')),
  severity        TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR')),
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  remarks         TEXT CHECK (char_length(remarks) <= 1000),
  resolution_note TEXT CHECK (char_length(resolution_note) <= 1000),
  resolved_at     TIMESTAMPTZ,
  source          TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'SAP')),
  external_ref    TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resolved_requires_note CHECK (
    (status = 'OPEN'     AND resolution_note IS NULL AND resolved_at IS NULL)
    OR
    (status = 'RESOLVED' AND resolved_at IS NOT NULL
                         AND resolution_note IS NOT NULL AND btrim(resolution_note) <> '')
  )
);

CREATE INDEX inspections_date_idx ON inspections (inspection_date DESC);
CREATE INDEX inspections_status_severity_idx ON inspections (status, severity);
