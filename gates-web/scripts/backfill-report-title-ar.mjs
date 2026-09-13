#!/usr/bin/env node
/**
 * Fills titleAr in report-inventory.json from page h1 Arabic text or AR_TITLES map.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INV = path.join(__dirname, '../lib/reports/report-inventory.json');
const APP = path.join(__dirname, '../app');

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
  'customer-account-items': 'تقرير حساب العملاء بالأصناف',
};

function extractTitleFromPage(rel) {
  const file = path.join(APP, rel, 'page.tsx');
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  // NOTE: two generic patterns used to live here —
  // `title="([^"]{4,})"` and `title:\s*['"]([^'"]{4,})['"]` — that matched
  // *any* JSX attribute or object property literally named `title`
  // anywhere in the page (e.g. a date-field `title` tooltip, unrelated to
  // the report's own heading). Against this codebase's current
  // shared-shell page structure (few pages render a raw `<h1>` directly;
  // most delegate to CatalogReportFilterShell/ReportFilterPageShell) those
  // two patterns matched the wrong element far more often than the real
  // title, silently overwriting ~180/234 good curated titles with garbage
  // like "التواريخ"/"الأطراف"/"المحتوى" the one time this was run. Removed;
  // only match an actual `<h1>` heading now.
  const patterns = [
    /<h1[^>]*>\s*([^<]+?)\s*<\/h1>/,
    /<h1[^>]*className="[^"]*text-\[#0E78AA\][^"]*"[^>]*>\s*([^<]+?)\s*<\/h1>/,
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (m?.[1]) {
      const t = m[1].trim();
      if (/[\u0600-\u06FF]/.test(t) && !/sales and purchase/i.test(t)) return t;
    }
  }
  return null;
}

function isGoodArabicTitle(s) {
  if (!s?.trim()) return false;
  if (/[A-Za-z]{4,}/.test(s)) return false;
  return /[\u0600-\u06FF]/.test(s);
}

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
const byKey = new Map();

for (const e of inv.entries) {
  if (e.kind === 'preview') continue;
  const fromPage = extractTitleFromPage(e.rel);
  const fromMap = AR_TITLES[e.reportKey];
  const title = isGoodArabicTitle(fromPage)
    ? fromPage
    : isGoodArabicTitle(fromMap)
      ? fromMap
      : isGoodArabicTitle(e.titleAr)
        ? e.titleAr
        : fromMap ?? fromPage ?? `تقرير`;
  byKey.set(e.reportKey, title.trim());
}

let updated = 0;
for (const e of inv.entries) {
  const next = byKey.get(e.reportKey);
  if (next && e.titleAr !== next) {
    e.titleAr = next;
    updated++;
  }
}

fs.writeFileSync(INV, JSON.stringify(inv, null, 2) + '\n');
console.log(`Updated ${updated} titleAr fields; ${byKey.size} report keys.`);
