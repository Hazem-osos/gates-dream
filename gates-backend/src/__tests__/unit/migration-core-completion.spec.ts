import {
  buildSchemaCoverageReport,
  parseLegacySchemaFile,
} from '../../modules/migration-engine/services/migration-legacy-schema-coverage.service';
import { buildMachineReadableFieldReport } from '../../modules/migration-engine/services/migration-field-evidence.service';
import { importerForTable } from '../../modules/migration-engine/services/migration-importer-registry';
import {
  mapLegacyChequeDirection,
  decideHistoricalChequeImport,
} from '../../modules/migration-engine/treasury/settlement-cheque-decision';
import { upsertDocumentSequenceCounter } from '../../modules/migration-engine/services/migration-document-sequence-sync.service';

describe('migration core completion', () => {
  it('parses erp_schema.txt with table/column counts', () => {
    const map = parseLegacySchemaFile();
    expect(map.size).toBeGreaterThan(100);
    expect(map.get('InvoiceTrxHeader')?.length).toBeGreaterThan(10);
  });

  it('builds schema coverage report with core column totals', () => {
    const report = buildSchemaCoverageReport();
    if (process.env.LOG_SCHEMA_COVERAGE === '1') {
      // eslint-disable-next-line no-console
      console.log('SCHEMA_TOTALS', JSON.stringify(report.totals));
    }
    expect(report.totals.discoveredTables).toBeGreaterThan(100);
    expect(report.totals.coreColumns).toBeGreaterThan(50);
    expect(report.totals.coreColumnsMapped).toBeGreaterThan(20);
    expect(report.totals.coreTablesWithoutImporter).not.toContain('StoreCollDetail');
    expect(report.totals.coreTablesWithoutImporter).not.toContain('StoreAdjustDetail');
  });

  it('builds machine-readable field report for core tables', () => {
    const report = buildMachineReadableFieldReport();
    expect(report.totals.coreColumns).toBeGreaterThan(100);
    expect(report.rows.some((r) => r.sourceTable === 'StoreCollDetail' && r.preservationMode === 'MAPPED')).toBe(
      true
    );
    expect(report.totals.missingImplementation).toBe(0);
    expect(report.remainingGaps.length).toBe(0);
  });

  it('registers inventory satellite importers with code-backed fields', () => {
    expect(importerForTable('StoreAdjustDetail')?.mappedFields).toContain('ItemAddQty');
    expect(importerForTable('BankBoxRights')?.stage).toBe('TREASURY_HISTORICAL');
  });

  it('maps CK02 inward and PK02 outward by prefix', () => {
    expect(mapLegacyChequeDirection('CK02', 'CKTrxDetail')).toBe('INWARD');
    expect(mapLegacyChequeDirection('PK02', 'PKTrxDetail')).toBe('OUTWARD');
    expect(mapLegacyChequeDirection('PK02', 'CKTrxDetail')).toBeNull();
  });

  it('imports CK02 when on CKTrxDetail', () => {
    const d = decideHistoricalChequeImport({
      row: { Type: 'CK02', Amount: 50, IdNum: '99', CKNum: '1' },
      sourceEntity: 'CKTrxDetail',
      alreadyMapped: false,
    });
    expect(d.action).toBe('IMPORT');
  });

  it('document sequence upsert keeps higher lastNumber (collision-safe)', async () => {
    const updates: Array<{ lastNumber: number }> = [];
    const ctx = {
      prisma: {
        documentSequence: {
          findFirst: async () => ({ id: 's1', lastNumber: 100 }),
          update: async (args: { data: { lastNumber: number } }) => {
            updates.push({ lastNumber: args.data.lastNumber });
          },
          create: async () => ({}),
        },
      },
    } as unknown as Parameters<typeof upsertDocumentSequenceCounter>[0];
    await upsertDocumentSequenceCounter(ctx, {
      companyId: 'c1',
      branchId: null,
      fiscalYearId: null,
      docType: 'GL',
      scope: 'Y',
      lastNumber: 50,
    });
    expect(updates.length).toBe(0);
    await upsertDocumentSequenceCounter(ctx, {
      companyId: 'c1',
      branchId: null,
      fiscalYearId: null,
      docType: 'GL',
      scope: 'Y',
      lastNumber: 150,
    });
    expect(updates[0]?.lastNumber).toBe(150);
  });
});
