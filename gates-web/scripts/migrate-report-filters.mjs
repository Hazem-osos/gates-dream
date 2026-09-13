#!/usr/bin/env node
/**
 * Migrates legacy report filter pages to CatalogReportFilterShell + removes ActionButtons/OuterCard wrappers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');
const INV = path.join(__dirname, '../lib/reports/report-inventory.json');

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));

const SHELL_IMPORT = `import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';`;

function migrateFile(rel, urlPath) {
  const file = path.join(APP, rel, 'page.tsx');
  if (!fs.existsSync(file)) return 'missing';
  let src = fs.readFileSync(file, 'utf8');

  if (src.includes('UnifiedReportFilterCard') || src.includes('CatalogReportFilterShell')) {
    return 'skip';
  }
  if (rel === 'hr/reports') return 'skip';
  if (!src.includes('ActionButtons') && !src.includes('OuterCard')) return 'skip';

  if (!src.includes('CatalogReportFilterShell')) {
    src = src.replace(
      /import ErrorToast from '@\/components\/ErrorToast';/,
      `import ErrorToast from '@/components/ErrorToast';\n${SHELL_IMPORT}`
    );
    if (!src.includes('CatalogReportFilterShell')) {
      const firstImport = src.indexOf('import ');
      if (firstImport >= 0) {
        src = src.slice(0, firstImport) + SHELL_IMPORT + '\n' + src.slice(firstImport);
      }
    }
  }

  src = src.replace(/import OuterCard from '@\/components\/OuterCard';\n?/g, '');
  src = src.replace(/import InnerCard from '@\/components\/InnerCard';\n?/g, '');
  src = src.replace(/import { ActionButtons } from '@\/components\/ui\/ActionButtons';\n?/g, '');

  src = src.replace(/\n\s*const handleCancel = \(\) => \{[\s\S]*?\};\n/g, '\n');

  src = src.replace(
    /<div className="flex[^"]*"[^>]*>\s*<ActionButtons[\s\S]*?\/>\s*<\/div>/g,
    ''
  );
  src = src.replace(/<ActionButtons[\s\S]*?\/>\s*/g, '');

  src = src.replace(/<OuterCard>\s*/g, '');
  src = src.replace(/<\/OuterCard>\s*/g, '');
  src = src.replace(/<InnerCard>\s*/g, '');
  src = src.replace(/<\/InnerCard>\s*/g, '');

  const settingsMatch = src.match(/const \[showSettings, setShowSettings\]/);
  const settingsOpen = settingsMatch ? 'showSettings' : 'false';
  const settingsChange = settingsMatch ? 'setShowSettings' : 'undefined';

  const shellOpen = settingsMatch
    ? `settingsOpen={showSettings}\n        onSettingsOpenChange={setShowSettings}\n        `
    : '';

  const errorProp = src.includes('const [error, setError]')
    ? `error={error}\n        onClearError={() => setError('')}\n        `
    : '';

  const previewHandler = src.includes('handlePreview') ? 'handlePreview' : 'onPreview';

  src = src.replace(
    /return \(\s*\n\s*<div className="[^"]*min-h-screen[^"]*"[^>]*>/,
    `return (\n    <CatalogReportFilterShell\n      urlPath="${urlPath}"\n      onPreview={${previewHandler}}\n      ${errorProp}${shellOpen}>\n      <div className="col-span-full">`
  );

  if (!src.includes('CatalogReportFilterShell')) return 'failed';

  src = src.replace(/\n\s*<\/div>\s*\n\s*\);\s*\n\}$/, '\n      </div>\n    </CatalogReportFilterShell>\n  );\n}\n');

  fs.writeFileSync(file, src);
  return 'ok';
}

let ok = 0;
let skip = 0;
let fail = 0;

for (const e of inv.entries) {
  if (e.kind !== 'filter' || e.status !== 'active') continue;
  const r = migrateFile(e.rel, e.urlPath);
  if (r === 'ok') ok++;
  else if (r === 'skip') skip++;
  else fail++;
}

console.log(`Filter migration: ${ok} ok, ${skip} skip, ${fail} fail/other`);
