#!/usr/bin/env node
/**
 * Scans app/ for all report page.tsx files per rollout scope.
 * Output: lib/reports/report-inventory.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '../app');
const OUT = path.join(__dirname, '../lib/reports/report-inventory.json');

// M21 fix (Item 36): `valuation`, `reorder`, `item-movements`, `item-balances`,
// and `expiry` used to be listed here, but their page.tsx files now redirect
// to the real, working report that already covers the same data
// (inventory-reports, items-exceeding-order-limit, item-movement-reports,
// inventory-reports, expiry-date-report respectively) — see the "M21 fix"
// comments in each of those page.tsx files. Only `slow-moving` has no
// backend report behind it and remains a genuine stub.
const INVENTORY_STUBS = new Set(['inventory/reports/slow-moving']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name === 'page.tsx') acc.push(full);
  }
  return acc;
}

function relFromApp(abs) {
  return path.relative(APP_ROOT, abs).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
}

function inScope(rel) {
  if (rel.includes('/preview/')) return true;
  if (rel.startsWith('hr/') && /report/i.test(rel)) return true;
  if (rel.startsWith('accounting/account-reports/')) return true;
  if (/\/reports\//.test(rel) || rel.endsWith('/reports')) return true;
  return false;
}

function moduleFromRel(rel) {
  const first = rel.split('/')[0];
  if (first === 'accounting') return 'accounting';
  return first;
}

function kindFromRel(rel) {
  if (rel === 'hr/reports') return 'hub';
  if (rel.endsWith('/preview')) return 'preview';
  if (INVENTORY_STUBS.has(rel)) return 'stub';
  return 'filter';
}

function urlPath(rel) {
  return '/' + rel;
}

function previewPathForFilter(rel) {
  const previewRel = rel + '/preview';
  const previewFile = path.join(APP_ROOT, previewRel, 'page.tsx');
  if (fs.existsSync(previewFile)) return urlPath(previewRel);
  return null;
}

function reportKeyFromRel(rel) {
  const parts = rel.split('/');
  const slug = parts[parts.length - 1];
  if (slug === 'preview') return parts[parts.length - 2];
  return slug;
}

function titleArFromSlug(slug) {
  return slug.replace(/-/g, ' ');
}

const allPages = walk(APP_ROOT)
  .map(relFromApp)
  .filter(inScope)
  .sort();

const entries = allPages.map((rel) => {
  const kind = kindFromRel(rel);
  const isPreview = kind === 'preview';
  const filterRel = isPreview ? rel.replace(/\/preview$/, '') : rel;
  return {
    rel,
    urlPath: urlPath(rel),
    kind,
    module: moduleFromRel(rel),
    reportKey: reportKeyFromRel(rel),
    titleAr: titleArFromSlug(reportKeyFromRel(rel)),
    previewPath: isPreview ? urlPath(rel) : previewPathForFilter(rel),
    filterPath: isPreview ? urlPath(filterRel) : kind === 'preview' ? null : urlPath(rel),
    hasPreviewPair: isPreview
      ? fs.existsSync(path.join(APP_ROOT, filterRel, 'page.tsx'))
      : previewPathForFilter(rel) != null,
    status: kind === 'stub' ? 'stub' : kind === 'hub' ? 'hub' : 'active',
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  count: entries.length,
  entries,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${entries.length} entries to ${OUT}`);
