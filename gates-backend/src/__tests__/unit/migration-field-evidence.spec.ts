import {
  auditRuntimePreserveWiring,
  buildMachineReadableFieldReport,
} from '../../modules/migration-engine/services/migration-field-evidence.service';
import { mapLegacyInvoiceSourceDocumentType } from '../../modules/migration-engine/commercial/legacy-invoice-source-type';
import { pickLegacyInvoiceHeaderMetadata } from '../../modules/migration-engine/commercial/migration-invoice-legacy-metadata';
import { buildSchemaCoverageReport } from '../../modules/migration-engine/services/migration-legacy-schema-coverage.service';

describe('migration field evidence', () => {
  it('builds machine-readable report with core totals', () => {
    const report = buildMachineReadableFieldReport();
    expect(report.totals.coreColumns).toBeGreaterThan(100);
    expect(report.rows.length).toBe(report.totals.coreColumns);
    expect(report.totals.missingImplementation).toBe(0);
    expect(
      report.totals.mapped +
        report.totals.transformed +
        report.totals.metadata +
        report.totals.idMapKey
    ).toBe(report.totals.coreColumns);
    if (process.env.LOG_FIELD_EVIDENCE === '1') {
      // eslint-disable-next-line no-console
      console.log('FIELD_EVIDENCE_TOTALS', JSON.stringify(report.totals));
    }
  });

  it('maps invoice source types from legacy prefixes', () => {
    expect(mapLegacyInvoiceSourceDocumentType('QT01', '100')).toBe('QUOTATION');
    expect(mapLegacyInvoiceSourceDocumentType('PI01', '50')).toBe('PURCHASE_INVOICE');
    expect(mapLegacyInvoiceSourceDocumentType('SO01', '9')).toBe('SALES_ORDER');
  });

  it('preserves selected legacy invoice header fields in metadata payload', () => {
    const meta = pickLegacyInvoiceHeaderMetadata({
      IANum: '77',
      CustomeValue1: 10,
      DescE: 'note',
    });
    expect(meta.IANum).toBe('77');
    expect(meta.CustomeValue1).toBe(10);
  });

  it('schema coverage improves with store check/adjust importers', () => {
    const cov = buildSchemaCoverageReport();
    expect(cov.totals.coreTablesWithImporter).toBeGreaterThanOrEqual(30);
    expect(cov.totals.coreColumnsMapped).toBeGreaterThan(150);
  });

  it('preserve-config tables wire preserveLegacySnapshot in stage sources', () => {
    const audit = auditRuntimePreserveWiring();
    expect(audit.gaps).toEqual([]);
    expect(audit.ok).toBe(true);
  });
});
