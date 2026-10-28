import fs from 'node:fs';
import path from 'node:path';
import { importerForTable, MIGRATION_IMPORTER_REGISTRY } from './migration-importer-registry';
import { parseLegacySchemaFile } from './migration-legacy-schema-coverage.service';
import {
  aliasEvidenceFor,
  isStandardIdMapKeyColumn,
  type ColumnAliasEvidence,
} from './migration-legacy-column-aliases';
import { INVOICE_HEADER_MAPPED_KEYS } from '../commercial/migration-invoice-legacy-metadata';
import {
  customerMappedLegacyColumn,
  supplierMappedLegacyColumn,
} from './migration-party-legacy-metadata.service';
import {
  IMPORTER_PRESERVE_CONFIG,
  isConfiguredMappedColumn,
  preserveConfigForTable,
} from './migration-core-importer-preserve-config';

export type FieldPreservationMode =
  | 'MAPPED'
  | 'TRANSFORMED'
  | 'METADATA'
  | 'ID_MAP_KEY'
  | 'EVIDENCE_BLOCKED'
  | 'MISSING_IMPLEMENTATION';

export type MachineReadableFieldRow = {
  sourceTable: string;
  sourceColumn: string;
  targetDestination: string;
  transformation: string;
  importerFunction: string;
  preservationMode: FieldPreservationMode;
  testReference: string | null;
  notes: string | null;
};

export type MachineReadableFieldReport = {
  generatedAt: string;
  schemaPath: string;
  totals: {
    coreColumns: number;
    mapped: number;
    transformed: number;
    metadata: number;
    idMapKey: number;
    evidenceBlocked: number;
    missingImplementation: number;
  };
  rows: MachineReadableFieldRow[];
  remainingGaps: MachineReadableFieldRow[];
};

const CORE_TABLES = new Set(
  [
    'Branch',
    'Year',
    'Currency',
    'CurrencyHistory',
    'CostCenter',
    'Store',
    'CompanySetting',
    'Account',
    'GLTrxHeader',
    'GLTrxDetail',
    'BalanceAccountsH',
    'BalanceAccountsD',
    'Customer',
    'Supplier',
    'Item',
    'ItemUnit',
    'InvoiceTrxHeader',
    'InvoiceTrxDetail',
    'CashTrxHeader',
    'CashTrxDetail',
    'CashTrxotherDetail',
    'BankBoxRights',
    'SettlementTrxHeader',
    'CKTrxDetail',
    'CKTrxDetailSub',
    'PKTrxDetail',
    'PKTrxDetailSub',
    'StoreTransHeader',
    'StoreTransDetail',
    'StoreCollHeader',
    'StoreCollDetail',
    'StoreAdjustHeader',
    'StoreAdjustDetail',
    'ItemCost',
    'StoreCheckHeader',
    'StoreCheckDetail',
  ].map((t) => t.toLowerCase())
);

const EVIDENCE_BLOCKED: Array<{ table: string; column: string; reason: string }> = [
  {
    table: 'GLTrxHeader',
    column: 'reversalOfJournalEntryId',
    reason: 'No Rev/Contra column on GLTrxHeader in erp_schema.txt; runtime probe only',
  },
  {
    table: 'SettlementTrxHeader',
    column: '*',
    reason: 'Table absent from erp_schema.txt; migration blocks when rows exist without catalog',
  },
  {
    table: 'StoreDistHeader',
    column: '*',
    reason: 'Listed in numbering sync only; no core catalog importer — movements via StoreTrans/Coll',
  },
  {
    table: 'StoreDistHeader',
    column: '*',
    reason: 'StoreDist* absent from erp_schema.txt — no SQL evidence; do not invent movements',
  },
  {
    table: 'Customer',
    column: 'OpeningBalance',
    reason: 'GL is source of truth; party balance not fabricated on import',
  },
];

function resolveSchemaPath(): string {
  const candidates = [
    path.join(process.cwd(), 'erp', 'erp_schema.txt'),
    path.join(process.cwd(), '..', 'erp', 'erp_schema.txt'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('erp_schema.txt not found');
}

function rowFromAlias(alias: ColumnAliasEvidence): MachineReadableFieldRow {
  const mode: FieldPreservationMode =
    alias.preservationMode === 'ID_MAP_KEY'
      ? 'ID_MAP_KEY'
      : alias.preservationMode === 'METADATA'
        ? 'METADATA'
        : alias.preservationMode === 'TRANSFORMED'
          ? 'TRANSFORMED'
          : 'MAPPED';
  return {
    sourceTable: alias.legacyTable,
    sourceColumn: alias.schemaColumn,
    targetDestination: `${alias.targetModel}.${alias.targetField}`,
    transformation: alias.transformation ?? alias.sqlSourceColumn ?? alias.schemaColumn,
    importerFunction: alias.importer,
    preservationMode: mode,
    testReference: alias.testRef ?? null,
    notes: null,
  };
}

function classifyColumn(table: string, column: string): MachineReadableFieldRow {
  const blocked = EVIDENCE_BLOCKED.find(
    (b) =>
      b.table.toLowerCase() === table.toLowerCase() &&
      (b.column === '*' || b.column.toLowerCase() === column.toLowerCase())
  );
  if (blocked) {
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: '(none)',
      transformation: blocked.reason,
      importerFunction: '(none)',
      preservationMode: 'EVIDENCE_BLOCKED',
      testReference: 'migration-field-evidence.service.ts',
      notes: blocked.reason,
    };
  }

  const alias = aliasEvidenceFor(table, column);
  if (alias) return rowFromAlias(alias);

  if (isStandardIdMapKeyColumn(column)) {
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'MigrationIdMap.sourceKeyParts',
      transformation: 'Composite legacy identity key',
      importerFunction: 'MigrationIdMapService.recordMapping',
      preservationMode: 'ID_MAP_KEY',
      testReference: 'migration-engine.spec.ts',
      notes: null,
    };
  }

  const preserveCfgEarly = preserveConfigForTable(table);
  if (preserveCfgEarly) {
    if (isConfiguredMappedColumn(table, column)) {
      return {
        sourceTable: table,
        sourceColumn: column,
        targetDestination: preserveCfgEarly.stage,
        transformation: 'Direct map or transform in stage loader',
        importerFunction: `${preserveCfgEarly.stage} stage`,
        preservationMode: 'MAPPED',
        testReference: preserveCfgEarly.testRef ?? null,
        notes: null,
      };
    }
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: `CompanySettingEntry migration.${preserveCfgEarly.preserveNamespace}.*`,
      transformation: 'preserveLegacySnapshot on import (SELECT * / extended loader row)',
      importerFunction: 'preserveLegacySnapshot',
      preservationMode: 'METADATA',
      testReference: 'migration-legacy-snapshot-preserve.service.ts',
      notes: null,
    };
  }

  const imp = importerForTable(table);
  const lc = column.toLowerCase();
  if (imp?.mappedFields.some((f) => f.toLowerCase() === lc)) {
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: imp.targetModels.join('|'),
      transformation: 'Direct field map',
      importerFunction: `${imp.stage} stage`,
      preservationMode: 'MAPPED',
      testReference: null,
      notes: null,
    };
  }
  if (imp?.metadataFields?.some((f) => f.toLowerCase() === lc)) {
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'CompanySettingEntry | MigrationIssue',
      transformation: 'Structured legacy metadata',
      importerFunction: `${imp.stage} stage`,
      preservationMode: 'METADATA',
      testReference: null,
      notes: null,
    };
  }

  if (table === 'InvoiceTrxHeader' && imp) {
    if (INVOICE_HEADER_MAPPED_KEYS.has(column)) {
      return {
        sourceTable: table,
        sourceColumn: column,
        targetDestination: 'Invoice',
        transformation: 'transformHistoricalInvoiceHeader',
        importerFunction: 'COMMERCIAL stage',
        preservationMode: 'MAPPED',
        testReference: 'commercial-document-migration.spec.ts',
        notes: null,
      };
    }
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'Invoice.internalNotes.legacyMigration',
      transformation: 'pickLegacyInvoiceHeaderMetadata (any non-mapped header field on row)',
      importerFunction: 'pickLegacyInvoiceHeaderMetadata',
      preservationMode: 'METADATA',
      testReference: 'migration-field-evidence.spec.ts',
      notes: 'Requires column present on loader row; extend INVOICE_HEADER_SELECT for SQL-only columns',
    };
  }

  if (table === 'Customer' && imp) {
    if (customerMappedLegacyColumn(column)) {
      return {
        sourceTable: table,
        sourceColumn: column,
        targetDestination: 'Customer',
        transformation: 'transformCustomerRow / legacy-party-data.service',
        importerFunction: 'PARTIES stage',
        preservationMode: 'MAPPED',
        testReference: 'migration-engine.spec.ts',
        notes: null,
      };
    }
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'CompanySettingEntry migration.legacyCustomer.*',
      transformation: 'preserveCustomerLegacyMetadata',
      importerFunction: 'preserveCustomerLegacyMetadata',
      preservationMode: 'METADATA',
      testReference: 'migration-party-legacy-metadata.service.ts',
      notes: null,
    };
  }

  if (table === 'Supplier' && imp) {
    if (supplierMappedLegacyColumn(column)) {
      return {
        sourceTable: table,
        sourceColumn: column,
        targetDestination: 'Supplier',
        transformation: 'transformSupplierRow',
        importerFunction: 'PARTIES stage',
        preservationMode: 'MAPPED',
        testReference: null,
        notes: null,
      };
    }
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'CompanySettingEntry migration.legacySupplier.*',
      transformation: 'preserveSupplierLegacyMetadata',
      importerFunction: 'preserveSupplierLegacyMetadata',
      preservationMode: 'METADATA',
      testReference: null,
      notes: null,
    };
  }

  if (table === 'CashTrxHeader' && imp && !isStandardIdMapKeyColumn(column)) {
    const mapped = imp.mappedFields.some((f) => f.toLowerCase() === lc);
    if (mapped) {
      return {
        sourceTable: table,
        sourceColumn: column,
        targetDestination: 'CashTransaction',
        transformation: 'transformHistoricalCashHeader',
        importerFunction: 'TREASURY_HISTORICAL stage',
        preservationMode: 'MAPPED',
        testReference: 'settlement-cheque-migration.spec.ts',
        notes: null,
      };
    }
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: 'CashTransaction.internalNotes',
      transformation: 'Legacy cash header metadata preserve',
      importerFunction: 'TREASURY_HISTORICAL stage',
      preservationMode: 'METADATA',
      testReference: null,
      notes: null,
    };
  }

  if (!imp) {
    return {
      sourceTable: table,
      sourceColumn: column,
      targetDestination: '(none)',
      transformation: 'No importer registered',
      importerFunction: '(none)',
      preservationMode: 'MISSING_IMPLEMENTATION',
      testReference: null,
      notes: 'Register importer or evidence-block with reason',
    };
  }

  return {
    sourceTable: table,
    sourceColumn: column,
    targetDestination: '(pending)',
    transformation: 'Not yet wired in loader/transform',
    importerFunction: `${imp.stage} stage`,
    preservationMode: 'MISSING_IMPLEMENTATION',
    testReference: null,
    notes: 'Extend preserve config or loader SQL',
  };
}

export function buildMachineReadableFieldReport(schemaPath?: string): MachineReadableFieldReport {
  const resolved = schemaPath ?? resolveSchemaPath();
  const parsed = parseLegacySchemaFile(resolved);
  const rows: MachineReadableFieldRow[] = [];

  for (const [table, columns] of parsed.entries()) {
    if (!CORE_TABLES.has(table.toLowerCase())) continue;
    for (const col of columns) {
      rows.push(classifyColumn(table, col));
    }
  }

  const totals = {
    coreColumns: rows.length,
    mapped: 0,
    transformed: 0,
    metadata: 0,
    idMapKey: 0,
    evidenceBlocked: 0,
    missingImplementation: 0,
  };
  for (const r of rows) {
    switch (r.preservationMode) {
      case 'MAPPED':
        totals.mapped += 1;
        break;
      case 'TRANSFORMED':
        totals.transformed += 1;
        break;
      case 'METADATA':
        totals.metadata += 1;
        break;
      case 'ID_MAP_KEY':
        totals.idMapKey += 1;
        break;
      case 'EVIDENCE_BLOCKED':
        totals.evidenceBlocked += 1;
        break;
      case 'MISSING_IMPLEMENTATION':
        totals.missingImplementation += 1;
        break;
      default:
        break;
    }
  }

  const remainingGaps = rows.filter(
    (r) => r.preservationMode === 'MISSING_IMPLEMENTATION' || r.preservationMode === 'EVIDENCE_BLOCKED'
  );

  return {
    generatedAt: new Date().toISOString(),
    schemaPath: resolved,
    totals,
    rows,
    remainingGaps,
  };
}

export function listImporterRegistrySummary() {
  return MIGRATION_IMPORTER_REGISTRY.map((r) => ({
    legacyTable: r.legacyTable,
    stage: r.stage,
    mappedFieldCount: r.mappedFields.length,
    metadataFieldCount: r.metadataFields?.length ?? 0,
  }));
}

const STAGE_FILE_BY_NAME: Record<string, string> = {
  FOUNDATION: 'foundation.stage.ts',
  COA: 'coa.stage.ts',
  PARTIES: 'parties.stage.ts',
  ACCOUNTING: 'accounting.stage.ts',
  ITEMS: 'items.stage.ts',
  INVENTORY: 'inventory.stage.ts',
  COMMERCIAL: 'commercial.stage.ts',
  TREASURY_HISTORICAL: 'treasury-historical.stage.ts',
  SETTLEMENT_HISTORICAL: 'settlement-historical.stage.ts',
  CHEQUE_HISTORICAL: 'cheque-historical.stage.ts',
};

function stageHasMetadataPreserve(stage: string, table: string, src: string): boolean {
  if (src.includes('preserveLegacySnapshot')) return true;
  if (stage === 'PARTIES') {
    if (table === 'Customer' && src.includes('preserveCustomerLegacyMetadata')) return true;
    if (table === 'Supplier' && src.includes('preserveSupplierLegacyMetadata')) return true;
  }
  return false;
}

/** Static audit: preserve-config tables wire snapshot/metadata preserve in their stage file. */
export function auditRuntimePreserveWiring(): { ok: boolean; gaps: string[] } {
  const stagesDir = path.join(process.cwd(), 'src/modules/migration-engine/stages');
  const gaps: string[] = [];
  const stageSrcCache = new Map<string, string>();

  for (const [table, cfg] of Object.entries(IMPORTER_PRESERVE_CONFIG)) {
    const stageFile = STAGE_FILE_BY_NAME[cfg.stage];
    if (!stageFile) {
      gaps.push(`${table}: unknown stage ${cfg.stage}`);
      continue;
    }
    const abs = path.join(stagesDir, stageFile);
    if (!fs.existsSync(abs)) {
      gaps.push(`${table}: missing stage file ${stageFile}`);
      continue;
    }
    let src = stageSrcCache.get(stageFile);
    if (src == null) {
      src = fs.readFileSync(abs, 'utf8');
      stageSrcCache.set(stageFile, src);
    }
    if (!stageHasMetadataPreserve(cfg.stage, table, src)) {
      gaps.push(`${table}: stage ${cfg.stage} missing metadata preserve hook`);
      continue;
    }
    if (
      cfg.stage !== 'PARTIES' &&
      !src.includes('IMPORTER_PRESERVE_CONFIG') &&
      !src.includes(cfg.preserveNamespace)
    ) {
      gaps.push(`${table}: stage ${cfg.stage} missing IMPORTER_PRESERVE_CONFIG or namespace ${cfg.preserveNamespace}`);
    }
  }

  return { ok: gaps.length === 0, gaps };
}
