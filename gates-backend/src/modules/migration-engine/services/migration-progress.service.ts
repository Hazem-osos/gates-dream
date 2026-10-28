export type MilestoneReadiness = {
  id: string;
  label: string;
  weight: number;
  implemented: boolean;
  tested: boolean;
  dataMigrated: boolean;
  reconciled: boolean;
  productionReady: boolean;
  evidence: string;
};

export function migrationMilestones(): MilestoneReadiness[] {
  return [
    {
      id: 'FOUNDATION',
      label: 'Foundation',
      weight: 15,
      implemented: true,
      tested: true,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: 'Engine stage + unit/integration tests. Pilot data only when run locally against LegacyForensic.',
    },
    {
      id: 'COA',
      label: 'COA Mapping',
      weight: 20,
      implemented: true,
      tested: true,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: 'COA stage, owner-approved override for 102060101003 → 1020101001, unit tests.',
    },
    {
      id: 'PARTIES',
      label: 'Customers / Suppliers',
      weight: 10,
      implemented: true,
      tested: true,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: 'Parties stage + unit tests. Mozana cache not imported.',
    },
    {
      id: 'ACCOUNTING',
      label: 'Historical journals',
      weight: 20,
      implemented: true,
      tested: true,
      dataMigrated: true,
      reconciled: true,
      productionReady: false,
      evidence:
        'Isolated accounting pilot PASS for company 0001: 223 imported unique journals, TB 62,661,687.38, 0 account diffs. Not production-ready.',
    },
    {
      id: 'OPENING',
      label: 'Opening balances',
      weight: 5,
      implemented: true,
      tested: true,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: 'Policy GL_ONLY when BG01 exists; BalanceAccounts skipped to prevent double-count.',
    },
    {
      id: 'MASTER',
      label: 'Remaining master data',
      weight: 10,
      implemented: true,
      tested: true,
      dataMigrated: true,
      reconciled: true,
      productionReady: false,
      evidence: 'Isolated ITEMS pilot: 28 leaf items, 19 units, 5 warehouses, 4 categories. Tax/payment terms still out of engine.',
    },
    {
      id: 'INVENTORY',
      label: 'Inventory',
      weight: 15,
      implemented: true,
      tested: true,
      dataMigrated: true,
      reconciled: false,
      productionReady: false,
      evidence:
        'Isolated inventory pilot: 331 movements, mapped qty diffs 0, TB unchanged 62,661,687.38. Valuation and inventory-to-GL BLOCKED. See INVENTORY_PILOT_SIGNOFF.md.',
    },
    {
      id: 'COMMERCIAL',
      label: 'Historical invoices / returns',
      weight: 8,
      implemented: true,
      tested: true,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: 'COMMERCIAL + TREASURY + SETTLEMENT + CHEQUE stages in pipeline; unit decision tests.',
    },
    {
      id: 'UI',
      label: 'Settings migration wizard',
      weight: 7,
      implemented: true,
      tested: false,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence: '/accounting-settings/database-tools/database-migration — upload, SSE/poll progress, activation.',
    },
    {
      id: 'E2E',
      label: 'Owner validation on real legacy DB',
      weight: 5,
      implemented: true,
      tested: false,
      dataMigrated: false,
      reconciled: false,
      productionReady: false,
      evidence:
        'Engine + UI complete for owner testing. Inventory valuation / inv-GL policy still owner-gated. See MIGRATION_OWNER_TESTING.md.',
    },
  ];
}

/** Percent of engine capability that is implemented and tested. Data migration is tracked separately. */
export function overallImplementationPercent(rows = migrationMilestones()): number {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const earned = rows.reduce((sum, row) => {
    if (row.implemented && row.tested) return sum + row.weight;
    if (row.implemented) return sum + row.weight * 0.5;
    return sum;
  }, 0);
  return Math.round((earned / total) * 100);
}
