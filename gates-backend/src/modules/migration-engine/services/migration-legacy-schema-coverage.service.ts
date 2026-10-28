import fs from 'node:fs';
import path from 'node:path';
import { importerForTable, MIGRATION_IMPORTER_REGISTRY } from './migration-importer-registry';
import { buildMachineReadableFieldReport } from './migration-field-evidence.service';

export type ColumnCoverageClass = 'MAPPED' | 'METADATA' | 'UNSUPPORTED' | 'NO_IMPORTER';

export type TableCoverageRow = {
  table: string;
  moduleId: string | null;
  columnCount: number;
  mappedCount: number;
  metadataCount: number;
  unsupportedCount: number;
  hasImporter: boolean;
  stage: string | null;
  targetModels: string[];
};

export type SchemaCoverageReport = {
  generatedAt: string;
  schemaPath: string;
  totals: {
    discoveredTables: number;
    discoveredColumns: number;
    coreModuleTables: number;
    coreTablesWithImporter: number;
    coreColumns: number;
    coreColumnsMapped: number;
    coreColumnsMetadata: number;
    coreColumnsUnsupported: number;
    coreColumnsTransformed: number;
    coreColumnsIdMapKey: number;
    coreColumnsEvidenceBlocked: number;
    coreColumnsMissingImplementation: number;
    coreTablesWithoutImporter: string[];
  };
  tables: TableCoverageRow[];
  unresolvedDocumentTypes: string[];
};

const CORE_MODULE_TABLES: Record<string, string[]> = {
  FOUNDATION: ['Branch', 'Year', 'Currency', 'CurrencyHistory', 'CostCenter', 'Store', 'CompanySetting'],
  GL: ['Account', 'GLTrxHeader', 'GLTrxDetail', 'BalanceAccountsH', 'BalanceAccountsD'],
  PARTIES: ['Customer', 'Supplier'],
  SALES_PURCHASING: ['InvoiceTrxHeader', 'InvoiceTrxDetail'],
  TREASURY: ['CashTrxHeader', 'CashTrxDetail', 'CashTrxotherDetail', 'BankBoxRights'],
  SETTLEMENTS: ['CashTrxDetail', 'SettlementTrxHeader'],
  CHEQUES: ['CKTrxDetail', 'CKTrxDetailSub', 'PKTrxDetail', 'PKTrxDetailSub'],
  INVENTORY: [
    'Item',
    'ItemUnit',
    'StoreTransHeader',
    'StoreTransDetail',
    'StoreCollHeader',
    'StoreCollDetail',
    'StoreAdjustHeader',
    'StoreAdjustDetail',
    'ItemCost',
    'StoreCheckHeader',
    'StoreCheckDetail',
  ],
};

function resolveSchemaPath(): string {
  const candidates = [
    path.join(process.cwd(), 'erp', 'erp_schema.txt'),
    path.join(process.cwd(), '..', 'erp', 'erp_schema.txt'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('erp_schema.txt not found (expected at repo erp/erp_schema.txt)');
}

export function parseLegacySchemaFile(schemaPath?: string): Map<string, string[]> {
  const file = schemaPath ?? resolveSchemaPath();
  const text = fs.readFileSync(file, 'utf8');
  const map = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s/);
    if (!m) continue;
    const [, table, col] = m;
    const cols = map.get(table) ?? [];
    if (!cols.includes(col)) cols.push(col);
    map.set(table, cols);
  }
  return map;
}

function moduleForTable(table: string): string | null {
  for (const [mod, tables] of Object.entries(CORE_MODULE_TABLES)) {
    if (tables.some((t) => t.toLowerCase() === table.toLowerCase())) return mod;
  }
  return null;
}

export function buildSchemaCoverageReport(schemaPath?: string): SchemaCoverageReport {
  const resolved = schemaPath ?? resolveSchemaPath();
  const parsed = parseLegacySchemaFile(resolved);
  const coreTableSet = new Set(Object.values(CORE_MODULE_TABLES).flat());
  const fieldReport = buildMachineReadableFieldReport(resolved);
  const evidenceByKey = new Map(
    fieldReport.rows.map((r) => [`${r.sourceTable.toLowerCase()}|${r.sourceColumn.toLowerCase()}`, r])
  );

  const tables: TableCoverageRow[] = [];
  let coreColumns = 0;
  let coreColumnsMapped = 0;
  let coreColumnsMetadata = 0;
  let coreColumnsUnsupported = 0;
  let coreColumnsTransformed = 0;
  let coreColumnsIdMapKey = 0;
  let coreColumnsEvidenceBlocked = 0;
  let coreColumnsMissingImplementation = 0;
  let coreTablesWithImporter = 0;
  const coreTablesWithoutImporter: string[] = [];

  for (const [table, columns] of [...parsed.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const mod = moduleForTable(table);
    const isCore = coreTableSet.has(table);
    const imp = importerForTable(table);
    let mappedCount = 0;
    let metadataCount = 0;
    let unsupportedCount = 0;
    for (const col of columns) {
      if (!isCore) continue;
      coreColumns += 1;
      const ev = evidenceByKey.get(`${table.toLowerCase()}|${col.toLowerCase()}`);
      const mode = ev?.preservationMode ?? 'MISSING_IMPLEMENTATION';
      switch (mode) {
        case 'MAPPED':
          mappedCount += 1;
          coreColumnsMapped += 1;
          break;
        case 'TRANSFORMED':
          mappedCount += 1;
          coreColumnsMapped += 1;
          coreColumnsTransformed += 1;
          break;
        case 'METADATA':
          metadataCount += 1;
          coreColumnsMetadata += 1;
          break;
        case 'ID_MAP_KEY':
          metadataCount += 1;
          coreColumnsMetadata += 1;
          coreColumnsIdMapKey += 1;
          break;
        case 'EVIDENCE_BLOCKED':
          unsupportedCount += 1;
          coreColumnsUnsupported += 1;
          coreColumnsEvidenceBlocked += 1;
          break;
        case 'MISSING_IMPLEMENTATION':
        default:
          unsupportedCount += 1;
          coreColumnsUnsupported += 1;
          coreColumnsMissingImplementation += 1;
          break;
      }
    }
    if (isCore) {
      if (imp) coreTablesWithImporter += 1;
      else coreTablesWithoutImporter.push(table);
    }
    tables.push({
      table,
      moduleId: mod,
      columnCount: columns.length,
      mappedCount,
      metadataCount,
      unsupportedCount,
      hasImporter: Boolean(imp),
      stage: imp?.stage ?? null,
      targetModels: imp?.targetModels ?? [],
    });
  }

  const discoveredColumns = [...parsed.values()].reduce((n, c) => n + c.length, 0);
  return {
    generatedAt: new Date().toISOString(),
    schemaPath: resolved,
    totals: {
      discoveredTables: parsed.size,
      discoveredColumns,
      coreModuleTables: coreTableSet.size,
      coreTablesWithImporter,
      coreColumns,
      coreColumnsMapped,
      coreColumnsMetadata,
      coreColumnsUnsupported,
      coreColumnsTransformed,
      coreColumnsIdMapKey,
      coreColumnsEvidenceBlocked,
      coreColumnsMissingImplementation,
      coreTablesWithoutImporter,
    },
    tables: tables.filter((t) => t.moduleId),
    unresolvedDocumentTypes: [],
  };
}

export function listRegisteredImporters() {
  return MIGRATION_IMPORTER_REGISTRY.map((r) => r.legacyTable);
}
