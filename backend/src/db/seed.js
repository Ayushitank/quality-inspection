const DEMO_INSPECTIONS = [
  [0, 'LOOM-07', 'HOLE_TEAR', 'CRITICAL', 'Hole near selvedge, roll R-4471', null],
  [0, 'DYE-02', 'SHADE_VARIATION', 'MAJOR', 'Left-to-right shade shift on batch B-218', null],
  [1, 'LOOM-12', 'WEAVE_DEFECT', 'MAJOR', 'Broken pick every ~2 m', null],
  [1, 'FINISH-02', 'OTHER', 'MINOR', 'Oil stain on roll end', 'Wiped and re-inspected; cleared by QA'],
  [2, 'LOOM-03', 'COUNT_DEVIATION', 'MINOR', 'Warp count 2 ends below spec', null],
  [2, 'LOOM-07', 'HOLE_TEAR', 'MAJOR', null, 'Reed replaced, defect no longer reproduces'],
  [3, 'SIZING-01', 'OTHER', 'MINOR', 'Uneven size pick-up', 'Size box temperature recalibrated'],
  [3, 'DYE-01', 'SHADE_VARIATION', 'CRITICAL', 'Whole lot off-shade vs. approved lab dip', null],
  [4, 'LOOM-12', 'WEAVE_DEFECT', 'CRITICAL', 'Float across 40 cm width', 'Loom stopped, shed timing corrected'],
  [4, 'LINE-05', 'COUNT_DEVIATION', 'MAJOR', 'Weft density below tolerance', null],
  [5, 'FINISH-02', 'HOLE_TEAR', 'MINOR', 'Pin hole at stenter edge', null],
  [5, 'LOOM-03', 'WEAVE_DEFECT', 'MINOR', 'Slack end, intermittent', 'Warp tension rebalanced'],
  [6, 'DYE-02', 'SHADE_VARIATION', 'MINOR', 'Slight tailing at roll start', 'Within tolerance after re-check'],
  [7, 'LOOM-07', 'OTHER', 'MAJOR', 'Selvedge curling', null],
  [8, 'LINE-05', 'HOLE_TEAR', 'CRITICAL', 'Tear during inspection winding', null],
  [9, 'SIZING-01', 'COUNT_DEVIATION', 'MINOR', null, 'Count verified against lab report'],
  [10, 'LOOM-12', 'WEAVE_DEFECT', 'MAJOR', 'Double pick', null],
  [12, 'DYE-01', 'SHADE_VARIATION', 'MAJOR', 'Batch-to-batch variation', 'Recipe corrected for next batch'],
  [14, 'FINISH-02', 'OTHER', 'MINOR', 'Crease marks after calender', 'Roller pressure adjusted'],
  [16, 'LOOM-03', 'HOLE_TEAR', 'MAJOR', 'Cut mark from temple', 'Temple needles replaced'],
  [19, 'LINE-05', 'WEAVE_DEFECT', 'MINOR', 'Missing pick, single occurrence', 'No action; within AQL'],
  [22, 'DYE-02', 'SHADE_VARIATION', 'CRITICAL', 'Shade out of tolerance on export order', 'Re-dyed and approved by buyer rep'],
  [26, 'LOOM-07', 'COUNT_DEVIATION', 'MAJOR', 'Pick count drifting', 'Let-off motion serviced'],
  [30, 'SIZING-01', 'OTHER', 'MAJOR', 'Hard size on selvedge', 'Size recipe adjusted'],
];

const dateDaysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export async function seedDemoData(repository, { log = console } = {}) {
  if ((await repository.count()) > 0) return;

  for (const [daysAgo, machineId, defectType, severity, remarks, resolutionNote] of [...DEMO_INSPECTIONS].reverse()) {
    const inspection = await repository.insert({
      inspectionDate: dateDaysAgo(daysAgo),
      machineId,
      defectType,
      severity,
      remarks,
    });
    if (resolutionNote) await repository.resolve(inspection.id, resolutionNote);
  }
  log.info(`Seeded ${DEMO_INSPECTIONS.length} demo inspections`);
}
