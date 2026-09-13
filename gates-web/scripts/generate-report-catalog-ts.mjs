#!/usr/bin/env node
/**
 * Generates lib/reports/reportCatalog.ts from report-inventory.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INV = path.join(__dirname, '../lib/reports/report-inventory.json');
const OUT = path.join(__dirname, '../lib/reports/reportCatalog.ts');

const AR_TITLES = {
  'sales-reports': 'تقارير المبيعات',
  'sales-and-purchase-tax': 'الضريبة على المبيعات والمشتريات',
  'purchase-reports': 'تقارير المشتريات',
  'item-movement-reports': 'تقرير حركة الأصناف',
  'general-ledger': 'دفتر الأستاذ العام',
  'daftar-ostaz': 'دفتر الأستاذ',
  'review-balance': 'ميزان المراجعة',
  valuation: 'تقييم المخزون',
  'slow-moving': 'أصناف بطيئة الحركة',
  reorder: 'نقاط إعادة الطلب',
  'item-movements': 'حركات الأصناف',
  'item-balances': 'أرصدة الأصناف',
  expiry: 'تقرير الصلاحية',
  reports: 'التقارير',
};

function registryPathFromRel(rel) {
  if (rel.startsWith('accounting/account-reports/')) {
    return rel.replace(/^accounting\//, 'accounting/');
  }
  return rel.replace(/\/preview$/, '');
}

function titleFor(entry) {
  const fromJson = typeof entry.titleAr === 'string' ? entry.titleAr.trim() : '';
  if (fromJson && /[\u0600-\u06FF]/.test(fromJson) && !/[A-Za-z]{4,}/.test(fromJson)) {
    return fromJson;
  }
  if (AR_TITLES[entry.reportKey]) return AR_TITLES[entry.reportKey];
  if (fromJson && /[\u0600-\u06FF]/.test(fromJson)) return fromJson;
  return 'تقرير';
}

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));

const catalogEntries = inv.entries.map((e) => {
  const isPreview = e.kind === 'preview';
  const filterRel = isPreview ? e.rel.replace(/\/preview$/, '') : e.rel;
  const registryPath = registryPathFromRel(filterRel);
  return {
    urlPath: e.urlPath,
    registryPath,
    reportKey: e.reportKey.replace(/[^a-z0-9-]/gi, '-'),
    titleAr: titleFor(e),
    module: e.module,
    kind: e.kind,
    status: e.status,
    previewPath: e.previewPath,
    filterPath: isPreview ? '/' + filterRel : e.kind === 'preview' ? null : e.urlPath,
  };
});

const byUrl = Object.fromEntries(catalogEntries.map((c) => [c.urlPath, c]));

const ts = `/* eslint-disable max-lines -- auto-generated from report-inventory.json */
/**
 * Central catalog for all report routes. Regenerate: npm run reports:inventory && npm run reports:catalog
 */
import inventory from './report-inventory.json';

export type ReportCatalogStatus = 'active' | 'stub' | 'hub';
export type ReportCatalogKind = 'filter' | 'preview' | 'stub' | 'hub';

export type ReportCatalogEntry = {
  urlPath: string;
  registryPath: string;
  reportKey: string;
  titleAr: string;
  module: string;
  kind: ReportCatalogKind;
  status: ReportCatalogStatus;
  previewPath: string | null;
  filterPath: string | null;
};

const GENERATED: ReportCatalogEntry[] = ${JSON.stringify(catalogEntries, null, 2)} as ReportCatalogEntry[];

export const REPORT_CATALOG: ReportCatalogEntry[] = GENERATED;

export const REPORT_CATALOG_BY_URL: Record<string, ReportCatalogEntry> = ${JSON.stringify(byUrl, null, 2)};

export function getReportByUrlPath(urlPath: string): ReportCatalogEntry | undefined {
  const normalized = urlPath.replace(/\\/$/, '') || '/';
  return REPORT_CATALOG_BY_URL[normalized];
}

export function getReportByRegistryPath(registryPath: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((e) => e.registryPath === registryPath && e.kind !== 'preview');
}

export function getPreviewEntryForFilter(filterUrlPath: string): ReportCatalogEntry | undefined {
  const entry = getReportByUrlPath(filterUrlPath);
  if (!entry?.previewPath) return undefined;
  return getReportByUrlPath(entry.previewPath);
}

/** Inventory JSON row count — must match catalog length for filters+previews+hub+stubs */
export const REPORT_INVENTORY_COUNT = inventory.count;

export const REPORT_CATALOG_COUNT = REPORT_CATALOG.length;
`;

fs.writeFileSync(OUT, ts);
console.log(`Wrote ${catalogEntries.length} catalog entries to ${OUT}`);
