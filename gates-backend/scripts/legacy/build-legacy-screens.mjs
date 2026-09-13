#!/usr/bin/env node
/**
 * build-legacy-screens.mjs
 *
 * Join parsed DFM control trees with LangLabelCaptions.txt + LangFormsTitles.txt
 * + menu-tree.json and emit one JSON per legacy form under docs/parity/screens/.
 *
 * Usage:
 *   node scripts/legacy/build-legacy-screens.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  parseArgs,
  readJson,
  writeJson,
  parseLangLabelCaptions,
  parseLangFormTitles,
  flattenMenu,
  walkControls,
  isOrphanUnit,
  isOutOfScopeForm,
  INPUT_CLASS_RE,
  CHROME_CLASS_RE,
  DATASET_FIELD_CLASS_RE,
  dfmJsonPath,
  safeFileSlug,
} from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['src', 'parity']);
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const OUT_DIR = path.join(PARITY_DIR, 'screens');

function pickLabel(control, langRec, translations) {
  const fromLang = langRec?.labels?.[0] || null;
  const fromTr = translations || null;
  const ar =
    fromLang?.ar ||
    fromTr?.ar ||
    control.hint ||
    control.caption ||
    '';
  const en =
    fromLang?.en ||
    fromTr?.en ||
    (/^[\x20-\x7E]+$/.test(control.caption || '') ? control.caption : '') ||
    '';
  return { ar, en };
}

function isInputControl(cls) {
  return INPUT_CLASS_RE.test(cls || '');
}

function main() {
  console.log('Building legacy screen inventory...');
  const matrix = readJson(path.join(PARITY_DIR, 'legacy-parity-matrix.json'), { rows: [] });
  const translations = readJson(path.join(PARITY_DIR, 'legacy-translations.json'), { forms: {} });
  const menuTree = readJson(path.join(PARITY_DIR, 'menu-tree.json'), { mainMenus: [] });
  const captions = parseLangLabelCaptions(path.join(SRC_DIR, 'LangLabelCaptions.txt'));
  const titles = parseLangFormTitles(path.join(SRC_DIR, 'LangFormsTitles.txt'));
  const menuFlat = flattenMenu(menuTree);

  const menuByItem = new Map(menuFlat.map((m) => [m.menuItemName.toLowerCase(), m]));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existing = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'));
  for (const f of existing) fs.unlinkSync(path.join(OUT_DIR, f));

  const index = [];
  let emitted = 0;
  let skippedOrphan = 0;
  let skippedFrame = 0;
  let skippedNoForm = 0;
  let skippedOutOfScope = 0;

  for (const row of matrix.rows || []) {
    if (!row.formName) {
      skippedNoForm++;
      continue;
    }
    if (isOrphanUnit(row.unitName)) {
      skippedOrphan++;
      continue;
    }
    if (/TFrame/i.test(row.formClass || '')) {
      skippedFrame++;
      continue;
    }
    const earlyMenu = (row.menuLinks || []).flatMap((l) => [l.hintAr, ...(l.pathAr || [])].filter(Boolean));
    if (isOutOfScopeForm(row.formName, earlyMenu)) {
      skippedOutOfScope++;
      continue;
    }

    const dfmPath = dfmJsonPath(PARITY_DIR, row.dfm?.file);
    const dfm = dfmPath ? readJson(dfmPath, null) : null;
    const formKey = row.formName.toLowerCase();
    const title = titles.get(formKey) || null;
    const langControls = captions.get(formKey) || new Map();
    const trForm = translations.forms?.[row.formName] || translations.forms?.[row.formClass] || {};

    const menuLinks = (row.menuLinks || []).map((link) => {
      const extra = menuByItem.get((link.menuItemName || '').toLowerCase());
      return {
        menuItemName: link.menuItemName,
        hintAr: link.hintAr || extra?.hintAr || '',
        captionEn: link.captionEn || extra?.captionEn || '',
        pathAr: extra?.pathAr || [link.hintAr].filter(Boolean),
        pathEn: extra?.pathEn || [link.captionEn].filter(Boolean),
        confidence: link.confidence || null,
      };
    });

    const nodes = dfm ? walkControls(dfm.controlTree) : [];
    const bindingByName = new Map(
      (dfm?.dataBindings || []).map((b) => [String(b.name || '').toLowerCase(), b])
    );

    const fields = [];
    const seen = new Set();
    for (const node of nodes) {
      const cls = node.class || '';
      if (!cls || CHROME_CLASS_RE.test(cls) && !isInputControl(cls) && !node.dataField) continue;
      if (DATASET_FIELD_CLASS_RE.test(cls)) continue;
      if (/Tpp|TraProgram|TUniQuery|TQuery|TDataSource|TTimer|TImageList|TPopupMenu|TMainMenu|TMenuItem|TAction/i.test(cls)) {
        continue;
      }
      const key = (node.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      const input = isInputControl(cls) || Boolean(node.dataField) || bindingByName.has(key);
      if (!input && !/Lookup|Combo|Check|Edit|Memo|Date|Radio|Grid/i.test(cls)) continue;
      seen.add(key);
      const langRec = langControls.get(key);
      const { ar, en } = pickLabel(node, langRec, trForm[node.name]);
      const binding = bindingByName.get(key);
      fields.push({
        controlName: node.name,
        class: cls,
        labelAr: ar,
        labelEn: en,
        boundDbField: node.dataField || binding?.dataField || null,
        dataSource: node.dataSource || binding?.dataSource || null,
        isInput: isInputControl(cls) || Boolean(node.dataField || binding?.dataField),
        tab: node.tab || null,
      });
    }

    const grids = (dfm?.grids || []).map((g) => {
      const langGrid = langControls.get(String(g.name || '').toLowerCase());
      const langCols = (langGrid?.labels || []).filter((l) => l.idx != null && l.idx > 0);
      const headers = (g.columnHeaders || []).filter((h) => h && String(h).trim());
      const columns =
        langCols.length > 0
          ? langCols
              .sort((a, b) => a.idx - b.idx)
              .map((l) => ({ index: l.idx, labelAr: l.ar, labelEn: l.en }))
          : headers.map((h, i) => ({ index: i + 1, labelAr: h, labelEn: '' }));
      return {
        name: g.name,
        class: g.class,
        columns,
      };
    });

    const tabs = [
      ...new Set(
        nodes
          .filter((n) => /TabSheet/i.test(n.class || ''))
          .map((n) => n.caption || n.hint || n.name)
          .filter(Boolean)
      ),
    ];

    const titleAr =
      title?.titleAr ||
      menuLinks[0]?.hintAr ||
      row.captionAr ||
      '';
    const titleEn = title?.titleEn || menuLinks[0]?.captionEn || '';
    const menuPath = menuLinks[0]?.pathAr || [];
    if (isOutOfScopeForm(row.formName, [...menuPath, titleAr])) {
      skippedOutOfScope++;
      continue;
    }

    const screen = {
      unitName: row.unitName,
      pasPath: row.pasPath,
      formName: row.formName,
      formClass: row.formClass,
      titleAr,
      titleEn,
      menuPath,
      menuLinks,
      isReport: /Rep$|Options$|report/i.test(row.formName || '') || /تقرير/.test(titleAr),
      fields,
      grids,
      tabs,
      bindingCount: dfm?.dataBindings?.length || 0,
      controlCount: nodes.length,
    };

    const outName = `${safeFileSlug(row.formName)}.json`;
    writeJson(path.join(OUT_DIR, outName), screen);
    emitted++;
    index.push({
      formName: row.formName,
      unitName: row.unitName,
      titleAr,
      titleEn,
      fieldCount: fields.filter((f) => f.isInput).length,
      gridCount: grids.length,
      isReport: screen.isReport,
      file: `screens/${outName}`,
    });
  }

  writeJson(path.join(PARITY_DIR, 'screens-index.json'), {
    generatedAt: new Date().toISOString(),
    emitted,
    skippedOrphan,
    skippedFrame,
    skippedNoForm,
    skippedOutOfScope,
    screens: index,
  });

  console.log(
    `  emitted ${emitted} screens (${skippedOrphan} orphan, ${skippedFrame} frames, ${skippedNoForm} no-form, ${skippedOutOfScope} out-of-scope)`
  );
  console.log(`  wrote ${OUT_DIR}`);
}

main();
