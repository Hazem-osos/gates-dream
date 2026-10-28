/**
 * Real LegacyForensic SQL Server integration — skipped unless LEGACY_FORENSIC_URL is set.
 * Fixture decision tests live in settlement-cheque-migration.spec.ts.
 */
describe('settlement-cheque migration integration (LegacyForensic)', () => {
  const url = process.env.LEGACY_FORENSIC_URL ?? process.env.LEGACY_MSSQL_URL;
  const itReal = url ? it : it.skip;

  itReal('loads CashTrxDetail invoice allocation batch from legacy', async () => {
    const { LegacyGatesSqlServerAdapter } = await import(
      '../../modules/migration-engine/adapters/legacy-gates-sqlserver.adapter'
    );
    const { loadCashInvoiceAllocationBatch } = await import(
      '../../modules/migration-engine/services/legacy-settlement-data.service'
    );
    const adapter = new LegacyGatesSqlServerAdapter(url!);
    await adapter.testConnection();
    const batch = await loadCashInvoiceAllocationBatch(adapter, '0001', null, 5);
    expect(Array.isArray(batch.rows)).toBe(true);
    await adapter.close();
  });
});
