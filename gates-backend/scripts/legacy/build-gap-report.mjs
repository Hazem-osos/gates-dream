#!/usr/bin/env node
/**
 * build-gap-report.mjs
 *
 * Compare docs/parity/screens/*.json against docs/parity/web-screens/*.json
 * and emit GAP-REPORT.md, per-module files, and gap-report.json.
 *
 * Usage:
 *   node scripts/legacy/build-gap-report.mjs
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
  moduleFromRoute,
  isOutOfScopeForm,
  KNOWN_ROUTE_OVERRIDES,
} from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['parity']);
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const GAPS_DIR = path.join(PARITY_DIR, 'gaps');

const GENERIC_LABELS = new Set(
  [
    'حفظ',
    'تراجع',
    'الغاء',
    'إلغاء',
    'بحث',
    'مساعده',
    'مساعدة',
    'حذف',
    'تعديل',
    'اضافه',
    'إضافة',
    'اغلاق',
    'إغلاق',
    'طباعه',
    'طباعة',
    'ترحيل',
    'فك ترحيل',
    'جديد',
    'ok',
    'save',
    'cancel',
    'search',
    'help',
    'serial',
    'السيريال',
    'مسلسل',
  ].map(normalizeArabic)
);

function labelsOf(fields) {
  return (fields || [])
    .map((f) => normalizeArabic(f.labelAr || f.labelEn || f.name || ''))
    .filter((s) => s && !GENERIC_LABELS.has(s) && s.length > 1);
}

function gridLabels(gridsOrHeaders) {
  if (!gridsOrHeaders) return [];
  if (Array.isArray(gridsOrHeaders) && gridsOrHeaders[0]?.columns) {
    return gridsOrHeaders.flatMap((g) =>
      (g.columns || [])
        .map((c) => normalizeArabic(c.labelAr || c.labelEn || ''))
        .filter((s) => s && s.length > 1)
    );
  }
  return (gridsOrHeaders || []).map(normalizeArabic).filter((s) => s && s.length > 1);
}

function missingFrom(legacyLabels, webLabels) {
  const web = new Set(webLabels);
  const webChrome = new Set(webLabels.map(stripArabicChrome));
  const missing = [];
  const seen = new Set();
  for (const label of legacyLabels) {
    if (seen.has(label) || GENERIC_LABELS.has(label)) continue;
    seen.add(label);
    const chrome = stripArabicChrome(label);
    if (web.has(label) || webChrome.has(chrome)) continue;
    const fuzzy = [...web].some((w) => w.includes(label) || label.includes(w) || stripArabicChrome(w) === chrome);
    if (fuzzy) continue;
    missing.push(label);
  }
  return missing;
}

function severityOf(screen, gaps) {
  const flags = screen.saveBehavior?.flags || {};
  if (gaps.noWebPage && (flags.autoGl || flags.stockCost)) return 100;
  if (gaps.missingPostSave.includes('autoGl') || gaps.missingPostSave.includes('stockCost')) return 90;
  if (gaps.noWebPage) return 70;
  if (gaps.missingInputs.length >= 8) return 60;
  if (gaps.missingGridColumns.length >= 4) return 55;
  if (gaps.missingPostSave.length) return 50;
  if (gaps.missingInputs.length) return 30;
  return 10;
}

function flagList(flags = {}) {
  return Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

function inferWebFlags(web) {
  const models = new Set((web?.prismaModelsWritten || []).map((m) => m.toLowerCase()));
  const apis = (web?.apiPaths || []).join(' ').toLowerCase();
  const hay = `${[...models].join(' ')} ${apis}`;
  return {
    autoGl: /journal|invoice/.test(hay),
    stockCost: /itemquantity|itemcost|stock|receipt|issue|transfer|invoice|opening-stock|stocktaking|assembly|disassembly|adjustment/.test(hay),
    treasury: /treasury|cash|safe|cheque|securit/.test(hay),
    tax: /tax|invoice|dariba/.test(hay),
    alarms: false,
    autoPost: /\/post\b|posting/.test(apis),
    autoPrint: /print/.test(apis),
    saveTrace: false,
  };
}

function loadAll(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(dir, f)));
}

function moduleOf(screen, web) {
  if (web?.module) return web.module;
  const hint = (screen.menuPath || [])[0] || '';
  if (/مخزن|صنف|مبيعات|مشتريات/.test(hint)) return 'inventory';
  if (/حساب|خزين|قيد|عميل|مورد/.test(hint)) return 'accounting';
  if (/موارد|موظف/.test(hint)) return 'hr';
  if (/مستخلص|مشروع/.test(hint)) return 'extracts';
  if (/تصنيع/.test(hint)) return 'manufacturing';
  if (/عقار/.test(hint)) return 'real-estate-investment';
  if (/الكترون/.test(hint)) return 'electronic-invoices';
  if (/استيراد|اعتماد/.test(hint)) return 'importexport';
  return moduleFromRoute(screen.webRoute);
}

function main() {
  console.log('Building gap report...');
  const screens = loadAll(path.join(PARITY_DIR, 'screens'));
  const webScreens = loadAll(path.join(PARITY_DIR, 'web-screens'));
  const screensIndex = readJson(path.join(PARITY_DIR, 'screens-index.json'), {});
  const webByRoute = new Map(webScreens.map((w) => [w.route, w]));

  const rows = [];
  let skippedOutOfScope = 0;
  for (const screen of screens) {
    if (isOutOfScopeForm(screen.formName, [...(screen.menuPath || []), screen.titleAr])) {
      skippedOutOfScope++;
      continue;
    }
    const formKey = String(screen.formName || '').toLowerCase();
    const override = KNOWN_ROUTE_OVERRIDES[formKey];
    if (override) {
      screen.webRoute = override;
      screen.matchConfidence = 'seed';
    }
    const web = screen.webRoute ? webByRoute.get(screen.webRoute) : null;
    const legacyFieldLabels = labelsOf((screen.fields || []).filter((f) => f.isInput && (f.labelAr || f.boundDbField)));
    const webFieldLabels = labelsOf(web?.fields || []);
    const missingInputs = web
      ? missingFrom(legacyFieldLabels, webFieldLabels)
      : legacyFieldLabels;
    const missingGridColumns = web
      ? missingFrom(gridLabels(screen.grids), [...webFieldLabels, ...gridLabels(web.gridHeaders)])
      : gridLabels(screen.grids);

    const legacyFlags = flagList(screen.saveBehavior?.flags);
    const webFlags = inferWebFlags(web);
    const missingPostSave = web
      ? legacyFlags.filter((k) => ['autoGl', 'stockCost', 'treasury', 'tax'].includes(k) && !webFlags[k])
      : legacyFlags.filter((k) => ['autoGl', 'stockCost', 'treasury', 'tax'].includes(k));

    const gaps = {
      noWebPage: !web,
      missingInputs,
      missingGridColumns,
      missingPostSave,
    };
    const row = {
      formName: screen.formName,
      unitName: screen.unitName,
      titleAr: screen.titleAr,
      titleEn: screen.titleEn,
      menuPath: screen.menuPath || [],
      isReport: Boolean(screen.isReport) || /Rep$|Options$|Filter$|Search|Calender|Calendar|Dlg$|Dialog$|Select|FromExcel|fram_/i.test(screen.formName || '') || /تقرير/.test(screen.titleAr || ''),
      webRoute: screen.webRoute || '',
      matchConfidence: screen.matchConfidence || '',
      module: moduleOf(screen, web),
      legacyInputCount: legacyFieldLabels.length,
      webFieldCount: webFieldLabels.length,
      missingInputs,
      missingGridColumns,
      missingPostSave,
      noWebPage: !web,
      saveFlags: screen.saveBehavior?.flags || {},
      storedProcs: screen.saveBehavior?.storedProcs || [],
      tablesWritten: (screen.saveBehavior?.tablesWritten || []).map((t) => t.table),
      validations: (screen.saveBehavior?.validations || []).slice(0, 12),
    };
    row.severity = severityOf(screen, gaps);
    rows.push(row);
  }

  rows.sort((a, b) => b.severity - a.severity || a.titleAr.localeCompare(b.titleAr, 'ar'));

  const operational = rows.filter((r) => !r.isReport);
  const unmapped = operational.filter((r) => r.noWebPage);
  const withInputGaps = operational.filter((r) => r.missingInputs.length && !r.noWebPage);
  const withSaveGaps = operational.filter((r) => r.missingPostSave.length);
  const glGaps = operational.filter((r) => r.missingPostSave.includes('autoGl') || (r.noWebPage && r.saveFlags.autoGl));
  const stockGaps = operational.filter((r) => r.missingPostSave.includes('stockCost') || (r.noWebPage && r.saveFlags.stockCost));

  const report = {
    generatedAt: new Date().toISOString(),
    stats: {
      legacyScreens: screens.length - skippedOutOfScope,
      skippedOutOfScope: skippedOutOfScope + (screensIndex.skippedOutOfScope || 0),
      webScreens: webScreens.length,
      operationalScreens: operational.length,
      reportScreens: rows.filter((r) => r.isReport).length,
      mapped: operational.filter((r) => !r.noWebPage).length,
      unmappedOperational: unmapped.length,
      screensWithMissingInputs: withInputGaps.length,
      screensWithMissingPostSave: withSaveGaps.length,
      missingAutoGl: glGaps.length,
      missingStockCost: stockGaps.length,
    },
    screens: rows,
  };
  writeJson(path.join(PARITY_DIR, 'gap-report.json'), report);

  fs.mkdirSync(GAPS_DIR, { recursive: true });
  for (const f of fs.readdirSync(GAPS_DIR).filter((x) => x.endsWith('.md'))) fs.unlinkSync(path.join(GAPS_DIR, f));

  const byModule = new Map();
  for (const row of operational) {
    const key = row.module || 'unmapped';
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key).push(row);
  }

  function screenSection(row) {
    const lines = [
      `### ${row.titleAr || row.formName} \`${row.formName}\``,
      '',
      `- Web: ${row.webRoute || '_none_'} (${row.matchConfidence || 'unmatched'})`,
      `- Menu: ${(row.menuPath || []).join(' > ') || '—'}`,
      `- Severity: ${row.severity}`,
    ];
    if (row.storedProcs.length) lines.push(`- Stored procs: ${row.storedProcs.join(', ')}`);
    if (row.noWebPage) lines.push('- **No matching web page**');
    if (row.missingPostSave.length) {
      lines.push(`- Missing post-save: ${row.missingPostSave.join(', ')}`);
    }
    if (row.missingInputs.length) {
      lines.push(`- Missing inputs (${row.missingInputs.length}): ${row.missingInputs.slice(0, 25).join(' · ')}`);
    }
    if (row.missingGridColumns.length) {
      lines.push(`- Missing grid columns (${row.missingGridColumns.length}): ${row.missingGridColumns.slice(0, 20).join(' · ')}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  for (const [mod, list] of [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const md = [
      `# Gaps — ${mod}`,
      '',
      `${list.length} operational legacy screens.`,
      '',
      ...list.filter((r) => r.severity >= 30).map(screenSection),
    ].join('\n');
    writeText(path.join(GAPS_DIR, `${mod}.md`), md);
  }

  const top = operational.filter((r) => r.severity >= 50).slice(0, 60);
  const md = [
    '# Legacy Parity Gap Report (Clean)',
    '',
    `Generated ${report.generatedAt}.`,
    '',
    'Core ERP backlog only. Schools, paint-color POS, and obsolete utility shells',
    'are excluded. Known false-negative routes are forced via `KNOWN_ROUTE_OVERRIDES`.',
    '',
    'Field matching is by normalized Arabic label. Post-save flags come from the',
    'legacy Save*Click handler (and callees). Stored-procedure internals are flagged',
    '`needs-db-access` because SP bodies are not in the repo.',
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Legacy screens inventoried | ${report.stats.legacyScreens} |`,
    `| Excluded (schools / color POS / utilities) | ${report.stats.skippedOutOfScope} |`,
    `| Web pages inventoried | ${report.stats.webScreens} |`,
    `| Operational (non-report) screens | ${report.stats.operationalScreens} |`,
    `| Mapped to a web route | ${report.stats.mapped} |`,
    `| Operational screens with no web page | ${report.stats.unmappedOperational} |`,
    `| Mapped screens missing inputs | ${report.stats.screensWithMissingInputs} |`,
    `| Screens missing post-save behavior | ${report.stats.screensWithMissingPostSave} |`,
    `| Missing auto GL posting | ${report.stats.missingAutoGl} |`,
    `| Missing stock/cost effects | ${report.stats.missingStockCost} |`,
    '',
    '## Highest-severity gaps',
    '',
    'Sorted with missing GL posting / stock-cost first, then screens with no web page,',
    'then missing required-looking inputs.',
    '',
    ...top.map(screenSection),
    '',
    '## Unmapped operational screens',
    '',
    '| Form | Arabic | Menu | Save flags |',
    '|---|---|---|---|',
    ...unmapped.slice(0, 200).map((r) => {
      const flags = flagList(r.saveFlags).filter((k) => k !== 'needsDbAccess').join(', ') || '—';
      return `| ${r.formName} | ${r.titleAr || '—'} | ${(r.menuPath || []).join(' > ') || '—'} | ${flags} |`;
    }),
    '',
    '## Per-module files',
    '',
    ...[...byModule.keys()].sort().map((m) => `- [${m}](gaps/${m}.md)`),
    '',
    '## How to read this',
    '',
    '- `missing inputs` = legacy labeled input/bound field with no counterpart Arabic label on the web page.',
    '- `missing grid columns` = line-grid headers present in the Delphi form and absent from the web page.',
    '- `missing post-save` = the Delphi save handler writes GL / stock / treasury / tax and the web save path does not show the matching Prisma model or API.',
    '- Route matches with `medium` confidence should be reviewed in [route-mapping-review.md](route-mapping-review.md).',
    '',
  ].join('\n');
  writeText(path.join(PARITY_DIR, 'GAP-REPORT.md'), md);
  writeText(path.join(PARITY_DIR, 'GAP-REPORT-CLEAN.md'), md);

  console.log(`  ${report.stats.operationalScreens} operational screens`);
  console.log(`  ${report.stats.unmappedOperational} unmapped, ${report.stats.screensWithMissingInputs} input gaps, ${report.stats.missingAutoGl} GL gaps`);
  console.log(`  excluded ${skippedOutOfScope} out-of-scope screens`);
  console.log(`  wrote ${path.join(PARITY_DIR, 'GAP-REPORT-CLEAN.md')}`);
}

main();
