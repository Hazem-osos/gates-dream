#!/usr/bin/env node
/**
 * map-legacy-web-routes.mjs
 *
 * Match legacy screens to web routes by normalized Arabic title against
 * sidebar labels and extracted web-screen titles. High-confidence unique
 * matches are written to web_route; ambiguous ones go to a review list.
 *
 * Usage:
 *   node scripts/legacy/map-legacy-web-routes.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  parseArgs,
  readJson,
  writeJson,
  writeText,
  normalizeArabic,
  stripArabicChrome,
  flattenMenu,
  KNOWN_ROUTE_OVERRIDES,
} from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['web', 'parity']);
const WEB_DIR = path.resolve(args.web || path.join(REPO_ROOT, 'gates-web'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));

const SEED_FORM_ROUTES = {
  ...KNOWN_ROUTE_OVERRIDES,
  frmitem: '/inventory/creations/item-card',
  frmpinovice: '/inventory/operations/final-purchase-invoice',
  frmrinovice: '/inventory/operations/purchase-returns',
  frmsinvoice: '/inventory/operations/sales-invoice',
  frmsalesinvoice: '/inventory/operations/sales-invoice',
  frmgl: '/accounting/operations/journal-entry',
  frmpaymentorder: '/accounting/operations/treasury/payment-voucher',
  frmcustomerorder: '/accounting/operations/treasury/receipt-voucher',
  frmcustomer: '/accounting/cards/customer',
  frmsupplier: '/accounting/cards/supplier',
  frmperson: '/accounting/cards/delegate',
  frmaccountcard: '/accounting/cards/account',
  frmccentercard: '/accounting/cards/cost-center',
  frmcurrency: '/accounting/create/currencies',
  frmyear: '/accounting/create/periods',
  frmstore: '/inventory/creations/stores',
  frmstores: '/inventory/creations/stores',
  frmchartofaccounts: '/accounting/guide/chart-of-accounts',
  frmchartofitems: '/inventory/guide/items',
  frmchartofccenters: '/accounting/guide/cost-center',
  frmpaymentcheck: '/accounting/operations/securities/payment',
  frmrecievecheck: '/accounting/operations/securities/reciept',
  frmreceivecheck: '/accounting/operations/securities/reciept',
  frmpricelist: '/inventory/creations/price-lists',
  frmitemsorder: '/inventory/operations/purchase-order',
  frmpos: '/pos/point-of-sale',
  frmstorecheck: '/inventory/operations/stocktaking',
  frmstoretrans: '/inventory/operations/transfer',
  frmmanufproc: '/manufacturing/operations/operation',
  frmmanufplan: '/manufacturing/creations/manufacturing-plan',
  frmmanuflevels: '/manufacturing/creations/manufacturing-model',
  frmproject: '/extracts/operations/projects',
  frmemployee: '/hr/employee-data',
  frmetemad: '/importexport/accreditations/documentary-credit',
  frmeinvoiceinfo: '/electronic-invoices/settings',
  frmeinvoicesettings: '/electronic-invoices/settings',
  frmpostall: '/accounting-settings/operations-management/post-all',
  frmrenumber: '/accounting-settings/database-tools/renumber-financial-operations',
  frmmenurights: '/accounting-settings/create-user-groups',
  frmnewmodule: '/accounting-settings/operations-management/define-new-operation-screens',
  frmbp: '/accounting/operations/treasury/payment-voucher',
  frmcp: '/accounting/operations/treasury/receipt-voucher',
  frmcompany: '/accounting-settings/company-data',
  frmbranch: '/settings/company',
  frmchartofstores: '/inventory/guide',
  frmbankboxrights: '/accounting-settings/company-settings/accounting-settings',
  frmbalanceaccounts: '/accounting-settings/company-settings/financial-position-settings',
  frmdaribacustom: '/inventory/operations/other-additions-discounts',
  frmitemsfirsttime: '/inventory/operations/opening-stock',
  frmstorecoll: '/inventory/operations/assembly',
  frmstoredist: '/inventory/operations/disassembly',
  frmbg: '/inventory/operations/opening-stock',
  frmpaymentcheckmany: '/accounting/operations/securities/payment',
  frmrecievecheckmany: '/accounting/operations/securities/reciept',
  frmreceivecheckmany: '/accounting/operations/securities/reciept',
  frmdaman: '/importexport/accreditations/letters-of-guarantee',
  frmdamansetting: '/importexport/accreditations/letter-of-guarantee-settings',
  frmcontractorpayment: '/extracts/operations/extract-payment',
  frmstoreissue: '/inventory/operations/issue',
  frmia: '/inventory/operations/issue',
  frmsa: '/inventory/operations/receipt',
  frmassembly: '/inventory/operations/assembly',
  frmdisassembly: '/inventory/operations/disassembly',
  frmadjustment: '/inventory/operations/adjustment',
  frmitemoffer: '/inventory/operations/item-offers',
  frmpricequote: '/inventory/operations/price-quote',
  frmcustomercontract: '/inventory/creations/customer-contract',
  frmunit: '/inventory/creations/unit',
  frmitemgroup: '/inventory/creations/item-groups',
  frmlocation: '/inventory/creations/location',
  frmopeningbalance: '/accounting/operations/basic-operations/opening-balance',
  frmmoveaccount: '/accounting/operations/account-movement',
  frmcopyaccount: '/accounting/operations/account-movement',
  frmccentermove: '/accounting/operations/cost-center-movement',
  frmcopyccenter: '/accounting/operations/cost-center-movement',
  frmpersongroup: '/accounting/cards/delegate-group',
  frmpersonitems: '/inventory/creations/representatives-commissions-policy',
  frmpersonitemsvalues: '/inventory/creations/representatives-commission-values',
  frmabstractsprojects: '/extracts/operations/projects',
  frmabssettings: '/extracts/operations/extract-contractor-settings',
  frmcontractorstatement: '/extracts/operations/contractor',
  frmemployees: '/hr/employee-data',
  frmhrsettings: '/hr/settings',
};

const SIDEBAR_FILES = [
  'app/components/Sidebar.tsx',
  'app/components/InventorySidebar.tsx',
  'app/components/ExtractsSidebar.tsx',
  'app/components/ElectronicInvoicesSidebar.tsx',
  'app/components/ExportImportSidebar.tsx',
  'app/components/ManufacturingSidebar.tsx',
  'app/components/SidebarEstsmar3akary.tsx',
  'app/components/SalesSidebar.tsx',
  'app/components/hr/hr-sidebar.config.ts',
];

function extractNavLinks() {
  const links = [];
  for (const rel of SIDEBAR_FILES) {
    const full = path.join(WEB_DIR, rel);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const pairs = [
      ...text.matchAll(/label:\s*['"]([^'"]+)['"][\s\S]{0,220}?href:\s*['"]([^'"]+)['"]/g),
      ...text.matchAll(/href:\s*['"]([^'"]+)['"][\s\S]{0,220}?label:\s*['"]([^'"]+)['"]/g),
    ];
    for (const m of pairs) {
      const a = m[1];
      const b = m[2];
      const href = a.startsWith('/') ? a : b;
      const label = a.startsWith('/') ? b : a;
      if (href.startsWith('/') && label) {
        links.push({ href, label, source: rel });
      }
    }
  }
  return links;
}

function tokens(value) {
  return new Set(
    normalizeArabic(value)
      .split(' ')
      .filter((w) => w && w.length > 1 && !['من', 'الي', 'على', 'في', 'و'].includes(w))
  );
}

function tokenScore(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  return union ? (inter / union) * 85 : 0;
}

function score(a, b) {
  if (!a || !b) return 0;
  const na = normalizeArabic(a);
  const nb = normalizeArabic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const sa = stripArabicChrome(a);
  const sb = stripArabicChrome(b);
  if (sa && sa === sb) return 92;
  const ts = tokenScore(na, nb);
  if (sa && sb && (sa.includes(sb) || sb.includes(sa))) {
    const shorter = Math.min(sa.length, sb.length);
    const longer = Math.max(sa.length, sb.length);
    if (shorter >= 4 && shorter / longer >= 0.6) return Math.max(78, ts);
  }
  return ts;
}

function disambiguate(formKey, titleAr, hits) {
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const title = `${formKey} ${titleAr || ''}`;
  const keywords = [];
  if (/pinovice|purchase|مشتريات/.test(title)) keywords.push('purchase', 'final-purchase');
  if (/sinvoice|sales|مبيعات/.test(title)) keywords.push('sales-invoice', 'sales-returns');
  if (/paymentorder|frmbp\b|صرف نقد/.test(title)) keywords.push('payment-voucher', 'cash-payment');
  if (/customerorder|frmcp\b|توريد|قبض نقد/.test(title)) keywords.push('receipt-voucher', 'cash-receipt');
  if (/storecheck|جرد/.test(title)) keywords.push('stocktaking');
  if (/storetrans|نقل/.test(title)) keywords.push('transfer');
  if (/pricelist|اسعار|أسعار/.test(title)) keywords.push('price-lists');
  if (keywords.length) {
    const preferred = hits.find((h) => keywords.some((k) => h.href.includes(k)));
    if (preferred) return preferred;
  }
  const navHit = hits.find((h) => h.source === 'nav');
  return navHit || hits[0];
}

function bestMatches(queryLabels, candidates) {
  const byHref = new Map();
  for (const cand of candidates) {
    if (/\/preview$/.test(cand.href)) continue;
    let best = 0;
    for (const q of queryLabels) {
      best = Math.max(best, score(q, cand.label), score(q, cand.labelNorm));
    }
    if (best < 68) continue;
    const prev = byHref.get(cand.href);
    if (!prev || best > prev.score || (best === prev.score && cand.source === 'nav' && prev.source !== 'nav')) {
      byHref.set(cand.href, { ...cand, score: best });
    }
  }
  return [...byHref.values()].sort((a, b) => b.score - a.score);
}

function main() {
  console.log('Mapping legacy screens to web routes...');
  const matrix = readJson(path.join(PARITY_DIR, 'legacy-parity-matrix.json'), { rows: [] });
  const screensDir = path.join(PARITY_DIR, 'screens');
  const webIndex = readJson(path.join(PARITY_DIR, 'web-screens-index.json'), { screens: [] });
  const menuTree = readJson(path.join(PARITY_DIR, 'menu-tree.json'), { mainMenus: [] });
  const menuFlat = flattenMenu(menuTree);
  const nav = extractNavLinks();

  const candidates = [];
  const seenHref = new Set();
  for (const link of nav) {
    const key = `${normalizeArabic(link.label)}|${link.href}`;
    if (seenHref.has(key)) continue;
    seenHref.add(key);
    candidates.push({
      href: link.href,
      label: link.label,
      labelNorm: normalizeArabic(link.label),
      source: 'nav',
    });
  }
  for (const s of webIndex.screens || []) {
    if (!s.titleAr) continue;
    candidates.push({
      href: s.route,
      label: s.titleAr,
      labelNorm: normalizeArabic(s.titleAr),
      source: 'page-title',
    });
  }

  const screenByForm = new Map();
  if (fs.existsSync(screensDir)) {
    for (const file of fs.readdirSync(screensDir).filter((f) => f.endsWith('.json'))) {
      const screen = readJson(path.join(screensDir, file));
      screenByForm.set(String(screen.formName || '').toLowerCase(), { screen, file });
    }
  }

  const review = [];
  let high = 0;
  let medium = 0;
  let unmatched = 0;

  for (const row of matrix.rows || []) {
    if (!row.formName) {
      row.web_route = row.web_route || '';
      row.match_confidence = row.match_confidence || '';
      continue;
    }
    const formKey = row.formName.toLowerCase();
    const packed = screenByForm.get(formKey);
    const screen = packed?.screen;
    const seed = SEED_FORM_ROUTES[formKey];
    if (screen && (!screen.menuPath || screen.menuPath.length === 0)) {
      const titleNorm = normalizeArabic(screen.titleAr || row.captionAr || '');
      const menuHit = menuFlat.find((m) => normalizeArabic(m.hintAr) === titleNorm && m.hintAr);
      if (menuHit) {
        screen.menuPath = menuHit.pathAr;
        screen.menuLinks = [
          {
            menuItemName: menuHit.menuItemName,
            hintAr: menuHit.hintAr,
            captionEn: menuHit.captionEn,
            pathAr: menuHit.pathAr,
            pathEn: menuHit.pathEn,
          },
        ];
      }
    }

    const labels = [
      screen?.titleAr,
      screen?.titleEn,
      ...(screen?.menuLinks || []).map((l) => l.hintAr),
      ...(screen?.menuPath || []),
      row.captionAr,
    ].filter(Boolean);

    if (seed) {
      row.web_route = seed;
      row.match_confidence = 'seed';
      row.parity_status = row.parity_status || 'mapped';
      if (screen) {
        screen.webRoute = seed;
        screen.matchConfidence = 'seed';
        writeJson(path.join(screensDir, packed.file), screen);
      }
      high++;
      continue;
    }

    const hits = bestMatches(labels, candidates);
    const top = disambiguate(formKey, screen?.titleAr || row.captionAr, hits);
    const rivals = hits.filter((h) => h.href !== top?.href && h.score >= (top?.score || 0) - 4);
    const uniqueHigh = top && top.score >= 90 && rivals.length === 0;
    const uniqueMedium = top && top.score >= 78 && rivals.length === 0;

    if (uniqueHigh) {
      row.web_route = top.href;
      row.match_confidence = 'high';
      row.parity_status = 'mapped';
      if (screen) {
        screen.webRoute = top.href;
        screen.matchConfidence = 'high';
        writeJson(path.join(screensDir, packed.file), screen);
      }
      high++;
    } else if (uniqueMedium) {
      row.web_route = top.href;
      row.match_confidence = 'medium';
      row.parity_status = 'mapped-medium';
      if (screen) {
        screen.webRoute = top.href;
        screen.matchConfidence = 'medium';
        writeJson(path.join(screensDir, packed.file), screen);
      }
      medium++;
    } else {
      row.web_route = '';
      row.match_confidence = hits.length ? 'ambiguous' : 'unmatched';
      row.parity_status = row.match_confidence;
      if (screen) {
        screen.webRoute = '';
        screen.matchConfidence = row.match_confidence;
        screen.matchCandidates = hits.slice(0, 5).map((h) => ({ href: h.href, label: h.label, score: h.score }));
        writeJson(path.join(screensDir, packed.file), screen);
      }
      review.push({
        formName: row.formName,
        unitName: row.unitName,
        titleAr: screen?.titleAr || row.captionAr || '',
        titleEn: screen?.titleEn || '',
        menuPath: (screen?.menuPath || []).join(' > '),
        reason: row.match_confidence,
        candidates: hits.slice(0, 5).map((h) => ({ href: h.href, label: h.label, score: h.score })),
      });
      unmatched++;
    }
  }

  writeJson(path.join(PARITY_DIR, 'legacy-parity-matrix.json'), matrix);

  const csvLines = [
    ['unitName', 'formName', 'captionAr', 'web_route', 'parity_status', 'match_confidence', 'review_notes'].join(','),
  ];
  for (const row of matrix.rows || []) {
    const cells = [
      row.unitName,
      row.formName || '',
      row.captionAr || '',
      row.web_route || '',
      row.parity_status || '',
      row.match_confidence || '',
      row.review_notes || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    csvLines.push(cells.join(','));
  }
  writeText(path.join(PARITY_DIR, 'legacy-parity-matrix.csv'), csvLines.join('\n'));

  writeJson(path.join(PARITY_DIR, 'route-mapping-review.json'), {
    generatedAt: new Date().toISOString(),
    high,
    medium,
    unmatched,
    review,
  });

  const reviewMd = [
    '# Legacy → Web Route Mapping Review',
    '',
    `Generated ${new Date().toISOString()}.`,
    '',
    `- high/seed: ${high}`,
    `- medium: ${medium}`,
    `- unmatched/ambiguous: ${unmatched}`,
    '',
    '| Form | Arabic title | Menu | Reason | Top candidates |',
    '|---|---|---|---|---|',
    ...review.slice(0, 400).map((r) => {
      const cands = (r.candidates || []).map((c) => `${c.label} (${c.href}, ${c.score})`).join('<br>');
      return `| ${r.formName} | ${r.titleAr || '—'} | ${r.menuPath || '—'} | ${r.reason} | ${cands || '—'} |`;
    }),
    '',
  ].join('\n');
  writeText(path.join(PARITY_DIR, 'route-mapping-review.md'), reviewMd);

  console.log(`  mapped high/seed=${high} medium=${medium} unmatched=${unmatched}`);
}

main();
