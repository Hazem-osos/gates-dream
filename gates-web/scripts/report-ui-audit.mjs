#!/usr/bin/env node
/**
 * Validates report rollout: inventory ↔ catalog, legacy UI patterns on filter pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const INV = path.join(ROOT, 'lib/reports/report-inventory.json');

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
const catalogPath = path.join(ROOT, 'lib/reports/reportCatalog.ts');
const catalogSrc = fs.readFileSync(catalogPath, 'utf8');

const errors = [];
const warnings = [];

for (const e of inv.entries) {
  if (!catalogSrc.includes(`"${e.urlPath}"`)) {
    errors.push(`Missing catalog entry for ${e.urlPath}`);
  }
}

function readPage(rel) {
  const file = path.join(APP, rel, 'page.tsx');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

let legacyActionButtons = 0;
let legacyClose = 0;
let legacyMaxW3xl = 0;
let missingUnifiedCard = 0;
let missingCatalogPreview = 0;
let legacySettingsButton = 0;
let legacyBlueTitle = 0;
let legacyInputCls = 0;
let duplicateSidebar = 0;
let englishCatalogTitles = 0;

for (const e of inv.entries) {
  const src = readPage(e.rel);
  if (!src) {
    errors.push(`Missing page.tsx for ${e.rel}`);
    continue;
  }
  if (src.includes('redirect(') && e.kind === 'filter') continue;

  if (e.kind === 'filter' && e.status === 'active') {
    const titleMatch = catalogSrc.match(
      new RegExp(`"urlPath": "${e.urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"titleAr": "([^"]+)"`)
    );
    const titleAr = titleMatch?.[1] ?? e.titleAr ?? '';
    if (/[A-Za-z]{4,}/.test(titleAr)) englishCatalogTitles++;
  }

  if (e.kind === 'filter' || e.kind === 'stub') {
    if (e.status === 'stub') {
      if (!src.includes('ReportStubFilterPage') && !src.includes('UnifiedReportFilterCard') && !src.includes('redirect(')) {
        warnings.push(`Stub ${e.rel} not using ReportStubFilterPage`);
      }
      continue;
    }
    if (e.kind === 'filter' && e.status === 'active') {
      if (/import.*ActionButtons|<ActionButtons/.test(src)) legacyActionButtons++;
      if (/cancelText=["']إغلاق["']/.test(src) || /["']إغلاق["'].*ActionButtons/.test(src)) legacyClose++;
      if (src.includes('max-w-3xl') && src.includes('UnifiedReportFilterCard')) legacyMaxW3xl++;
      if (
        /onClick=\{handleSettingsClick\}|>[\s\n]*إعدادات التقرير[\s\n]*<\//.test(src) &&
        /<button[^>]*[\s\S]{0,200}إعدادات التقرير/.test(src)
      ) {
        legacySettingsButton++;
      }
      if (src.includes('CatalogReportFilterShell') && /<h1[^>]*text-\[#0E78AA\]/.test(src)) {
        legacyBlueTitle++;
      }
      if (
        (e.rel.includes('reports') || e.rel.includes('account-reports')) &&
        /const inputCls\s*=/.test(src) &&
        !/const inputCls = reportFilterInputClass/.test(src)
      ) {
        legacyInputCls++;
      }
      if (
        src.includes('CatalogReportFilterShell') &&
        /import ReportSettingsSidebar|<ReportSettingsSidebar/.test(src) &&
        /settingsOpen|onSettingsOpenChange/.test(src)
      ) {
        duplicateSidebar++;
      }
      if (
        !src.includes('UnifiedReportFilterCard') &&
        !src.includes('CatalogReportFilterShell') &&
        !src.includes('HrEmployeePickerReportPage') &&
        !src.includes('HrSimpleReportFilterPage') &&
        !src.includes('ReportStubFilterPage') &&
        !src.includes('ElectronicInvoiceReportFilterPage') &&
        e.rel !== 'hr/reports'
      ) {
        missingUnifiedCard++;
      }
    }
  }

  if (e.kind === 'preview') {
    const usesEngine =
      src.includes('CatalogReportPreviewPage') ||
      src.includes('UniversalReportViewer') ||
      src.includes('UniversalReportView') ||
      src.includes('ElectronicInvoiceReportPreviewPage');
    if (!usesEngine) missingCatalogPreview++;
  }
}

console.log('--- Report UI Audit ---');
console.log(`Inventory entries: ${inv.count}`);
console.log(`Filter pages missing UnifiedReportFilterCard (excl HR picker/hub): ${missingUnifiedCard}`);
console.log(`Filters with ActionButtons: ${legacyActionButtons}`);
console.log(`Previews not on report engine: ${missingCatalogPreview}`);
console.log(`Legacy «إعدادات التقرير» in filter pages: ${legacySettingsButton}`);
console.log(`Duplicate blue h1 with CatalogReportFilterShell: ${legacyBlueTitle}`);
console.log(`Filters with const inputCls: ${legacyInputCls}`);
console.log(`Duplicate ReportSettingsSidebar in shell pages: ${duplicateSidebar}`);
console.log(`English catalog titleAr (active filters): ${englishCatalogTitles}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length) warnings.slice(0, 20).forEach((w) => console.warn('WARN', w));
if (errors.length) {
  errors.forEach((e) => console.error('ERROR', e));
  process.exit(1);
}

const strict = process.argv.includes('--strict');
if (
  strict &&
  (missingUnifiedCard > 0 ||
    legacyActionButtons > 0 ||
    missingCatalogPreview > 0 ||
    legacySettingsButton > 0 ||
    legacyBlueTitle > 0 ||
    legacyInputCls > 0 ||
    duplicateSidebar > 0 ||
    englishCatalogTitles > 0)
) {
  console.error('Strict audit failed — migrate remaining pages.');
  process.exit(1);
}

console.log('Audit completed.');
