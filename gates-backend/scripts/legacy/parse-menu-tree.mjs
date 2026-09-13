#!/usr/bin/env node
/**
 * parse-menu-tree.mjs — Delphi parity matrix, Phase 0.
 *
 * Extracts `MainProgram/UntMain.dfm`'s `TMainMenu` -> `TMenuItem` tree into
 * `{ menuItemName, captionEn, hintAr, onClickHandler, children }`.
 *
 * `menuItemName` (the Delphi component name, e.g. `mnsmYear`) is the critical
 * join key: legacy per-group screen permissions live in
 * `HiddenScreen.MenuItem` (and its fallback `MosHiddenScreen.MenuItem`), so
 * every downstream permission/parity join keys off this exact name.
 *
 * Reuses parse-dfm.mjs's output for UntMain.dfm instead of re-parsing the
 * (3.3MB) form — run parse-dfm.mjs first.
 *
 * Usage:
 *   node scripts/legacy/parse-menu-tree.mjs [--dfm-json <docs/parity/dfm/UntMain.json>] [--out <docs/parity/menu-tree.json>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

function parseArgs(argv) {
  const out = { dfmJson: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dfm-json') out.dfmJson = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DFM_JSON_PATH = path.resolve(args.dfmJson || path.join(REPO_ROOT, 'docs/parity/dfm/UntMain.json'));
const OUT_PATH = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/menu-tree.json'));

const MENU_CLASSES = new Set(['TMenuItem']);
const MENU_ROOT_CLASSES = new Set(['TMainMenu']);

function toMenuNode(node) {
  const children = (node.children ?? [])
    .filter((c) => MENU_CLASSES.has(c.class))
    .map(toMenuNode);
  return {
    menuItemName: node.name,
    captionEn: node.caption ?? null,
    hintAr: node.hint ?? null,
    onClickHandler: node.onClick ?? null,
    children,
  };
}

function countNodes(node) {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

function flatten(node, out) {
  out.push({
    menuItemName: node.menuItemName,
    captionEn: node.captionEn,
    hintAr: node.hintAr,
    onClickHandler: node.onClickHandler,
    childCount: node.children.length,
  });
  for (const c of node.children) flatten(c, out);
  return out;
}

function findAll(node, predicate, out) {
  if (predicate(node)) out.push(node);
  for (const c of node.children ?? []) findAll(c, predicate, out);
  return out;
}

function main() {
  if (!fs.existsSync(DFM_JSON_PATH)) {
    console.error(`Missing ${DFM_JSON_PATH} — run parse-dfm.mjs first.`);
    process.exit(1);
  }
  const dfm = JSON.parse(fs.readFileSync(DFM_JSON_PATH, 'utf8'));
  const tree = dfm.controlTree;
  if (!tree) {
    console.error('UntMain.json has no controlTree — parse-dfm.mjs may have failed for this form.');
    process.exit(1);
  }

  const mainMenuRoots = findAll(tree, (n) => MENU_ROOT_CLASSES.has(n.class), []);
  const menuTrees = mainMenuRoots.map((root) => ({
    mainMenuName: root.name,
    items: (root.children ?? []).filter((c) => MENU_CLASSES.has(c.class)).map(toMenuNode),
  }));

  const flat = [];
  for (const mt of menuTrees) for (const item of mt.items) flatten(item, flat);

  const withoutHandler = flat.filter((f) => !f.onClickHandler);
  const withoutCaption = flat.filter((f) => !f.captionEn);
  const withoutHint = flat.filter((f) => !f.hintAr);

  const result = {
    generatedAt: new Date().toISOString(),
    sourceForm: dfm.file,
    mainMenus: menuTrees,
    stats: {
      totalMenuItems: flat.length,
      withOnClickHandler: flat.length - withoutHandler.length,
      withCaption: flat.length - withoutCaption.length,
      withArabicHint: flat.length - withoutHint.length,
      missingHandler: withoutHandler.map((f) => f.menuItemName),
    },
    flat,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  console.log(`Main menus: ${menuTrees.length}`);
  console.log(`Total menu items: ${flat.length}`);
  console.log(`  with onClickHandler: ${result.stats.withOnClickHandler}`);
  console.log(`  with captionEn: ${result.stats.withCaption}`);
  console.log(`  with hintAr: ${result.stats.withArabicHint}`);
  console.log(`Output: ${OUT_PATH}`);
}

main();
