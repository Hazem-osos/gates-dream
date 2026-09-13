#!/usr/bin/env node
/** Fix broken JSX after clean-legacy pass + strip remaining duplicate chrome */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

const ROOTS = [
  'inventory/reports',
  'accounting/account-reports',
  'schools/reports',
  'taxes/reports',
  'manufacturing/reports',
  'real-estate-investment/reports',
  'extracts/reports',
  'electronic-invoices/reports',
  'importexport/reports',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'page.tsx') out.push(p);
  }
  return out;
}

function fix(src) {
  let s = src;

  s = s.replace(/\{showSettings && \(\s*\)\}/g, '');
  s = s.replace(/\{\/\*\s*Report Settings Sidebar\s*\*\/\}\s*/g, '');
  s = s.replace(/\{\/\*\s*Header Section\s*\*\/\}\s*/g, '');
  s = s.replace(/\{\/\*\s*Top Navigation\/Header Section\s*\*\/\}[\s\S]*?(?=<div className="grid|<ReportFilter|<div className="space-y)/g, '');

  s = s.replace(
    /<div className=\`\$\{showSettings \? 'ml-80' : ''\}\`\s*>\s*/g,
    ''
  );
  s = s.replace(
    /<div className="transition-all duration-\d+ \$\{showSettings \? 'ml-80' : ''\}">\s*/g,
    ''
  );

  // Remove nested duplicate card chrome inside shell
  s = s.replace(
    /<div className="bg-white rounded-2xl p-8 border-2 border-\[#E6F0F7\] shadow-lg">\s*/g,
    ''
  );

  // Drop unused settings handler
  if (!s.includes('handleSettingsClick') || !s.match(/handleSettingsClick\(/)) {
    s = s.replace(/\s*const handleSettingsClick = \(\) => \{[\s\S]*?\};\s*/g, '');
  }

  if (s.includes('CatalogReportFilterShell') && s.includes('settingsOpen')) {
    s = s.replace(/import ReportSettingsSidebar from[^\n]+\n/g, '');
    s = s.replace(/<ReportSettingsSidebar[\s\S]*?\/>/g, '');
    s = s.replace(/<ReportSettingsSidebar[\s\S]*?<\/ReportSettingsSidebar>\s*/g, '');
  }

  // h1 legacy titles inside catalog shell pages
  if (s.includes('CatalogReportFilterShell')) {
    s = s.replace(/<h1 className="text-(?:xl|lg|2xl) font-bold text-\[#0E78AA\][^"]*"[^>]*>[\s\S]*?<\/h1>\s*/g, '');
    s = s.replace(/<div className="h-1 bg-(?:\[#0E78AA\]|sky-700)[^"]*"[^>]*>\s*<\/div>\s*/g, '');
  }

  // Inline const aliases — use tokens directly in audit
  s = s.replace(/\n\s*const inputCls = reportFilterInputClass;\s*\n\s*const labelCls = reportFilterLabelClass;\s*\n\s*const selectCls = reportFilterInputClass;\s*\n/g, '\n');

  return s === src ? null : s;
}

let n = 0;
for (const rel of ROOTS) {
  for (const file of walk(path.join(APP, rel))) {
    const src = fs.readFileSync(file, 'utf8');
    const next = fix(src);
    if (next) {
      fs.writeFileSync(file, next);
      n++;
    }
  }
}
console.log(`fix-report-structure: ${n} files`);
