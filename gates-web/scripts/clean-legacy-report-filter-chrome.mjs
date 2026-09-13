#!/usr/bin/env node
/**
 * Removes duplicate report filter chrome: legacy headers, nested sidebars,
 * settings buttons, help chips, and local inputCls.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

const GLOBS = [
  'inventory/reports',
  'accounting/account-reports',
  'schools/reports',
  'taxes/reports',
  'manufacturing/reports',
  'real-estate-investment/reports',
  'extracts/reports',
  'electronic-invoices/reports',
  'importexport/reports',
  'hr/reports',
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

function ensureSettingsWiring(src) {
  if (!src.includes('CatalogReportFilterShell')) return src;
  if (/onSettingsOpenChange=/.test(src)) return src;

  let next = src;
  if (!/useState/.test(next)) {
    next = next.replace(/('use client';\s*)/, "$1import { useState } from 'react';\n");
  }
  if (!/const \[showSettings/.test(next) && !/const \[settingsOpen/.test(next)) {
    next = next.replace(
      /(export default function \w+\(\) \{\s*)/,
      '$1\n  const [showSettings, setShowSettings] = useState(false);\n'
    );
  }
  // Insert after a complete onClearError={() => ...} prop — never split arrow functions.
  if (/onClearError=\{\(\)\s*=>/.test(next)) {
    next = next.replace(
      /(onClearError=\{\(\)\s*=>\s*[^}]+\})/,
      '$1\n      settingsOpen={showSettings}\n      onSettingsOpenChange={setShowSettings}'
    );
  } else if (/onPreview=\{[^}]+\}/.test(next)) {
    next = next.replace(
      /(onPreview=\{[^}]+\})/,
      '$1\n      settingsOpen={showSettings}\n      onSettingsOpenChange={setShowSettings}'
    );
  }
  return next;
}

function cleanSource(src) {
  let next = src;
  const usesCatalogShell = next.includes('CatalogReportFilterShell');

  // Nested ReportSettingsSidebar when shell manages settings
  if (usesCatalogShell && /settingsOpen|onSettingsOpenChange/.test(next)) {
    next = next.replace(/<ReportSettingsSidebar[\s\S]*?\/>\s*/g, (block) =>
      block.includes('customSections') ? block : ''
    );
    next = next.replace(/<ReportSettingsSidebar[\s\S]*?<\/ReportSettingsSidebar>\s*/g, '');
  }

  // ml-80 layout hack
  next = next.replace(/\s*className=\`\$\{showSettings \? 'ml-80' : ''\}\`/g, '');
  next = next.replace(
    /transition-all duration-500 ease-in-out \$\{showSettings \? 'ml-80' : ''\}/g,
    ''
  );
  next = next.replace(
    /className=\{`transition-all duration-500 ease-in-out \$\{showSettings \? 'ml-80' : ''\}`\}/g,
    'className=""'
  );

  // Local input class constants → shared tokens
  if (/const inputCls\s*=/.test(next) && !/const inputCls = reportFilterInputClass/.test(next)) {
    if (!next.includes('reportFilterInputClass')) {
      if (next.includes("from '@/components/report/reportFilterFields'")) {
        next = next.replace(
          /import \{([^}]+)\} from '@\/components\/report\/reportFilterFields';/,
          (m, names) => {
            const set = new Set(
              names
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            );
            set.add('reportFilterInputClass');
            set.add('reportFilterLabelClass');
            return `import { ${[...set].join(', ')} } from '@/components/report/reportFilterFields';`;
          }
        );
      } else {
        next = next.replace(
          /('use client';[\s\S]*?\n)/,
          "$1import { reportFilterInputClass, reportFilterLabelClass } from '@/components/report/reportFilterFields';\n"
        );
      }
    }
    next = next.replace(
      /const inputCls\s*=\s*['"`][^'"`]+['"`];?\s*\n/g,
      'const inputCls = reportFilterInputClass;\n'
    );
    next = next.replace(
      /const selectCls\s*=\s*['"`][^'"`]+['"`];?\s*\n/g,
      'const selectCls = reportFilterInputClass;\n'
    );
    next = next.replace(
      /const labelCls\s*=\s*['"`][^'"`]+['"`];?\s*\n/g,
      'const labelCls = reportFilterLabelClass;\n'
    );
  }

  if (usesCatalogShell) {
    // Inner blue h1 title blocks
    next = next.replace(
      /<div className="mb-6">\s*<div className="text-right">\s*<h1 className="text-(?:lg|2xl|xl) font-bold text-\[#0E78AA\][^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*/g,
      ''
    );
    next = next.replace(
      /<div className="text-right">\s*<h1 className="text-lg font-bold text-\[#0E78AA\][^"]*"[^>]*>[\s\S]*?<div className="h-1 bg-sky-700[\s\S]*?<\/div>\s*<\/div>\s*/g,
      ''
    );
    // Schools header row with ? help + settings
    next = next.replace(
      /<div className="mb-6">\s*<div className="flex items-center justify-between">[\s\S]*?<\/div>\s*<\/div>\s*/g,
      ''
    );
    // Settings button
    next = next.replace(/<button[\s\S]*?إعدادات التقرير[\s\S]*?<\/button>\s*/g, '');
    // Floating help button
    next = next.replace(
      /<button[^>]*bg-\[#0E5A7A\][^>]*>\s*\?\s*<\/button>\s*/g,
      ''
    );
    next = next.replace(
      /<button className="flex overflow-hidden[\s\S]*?<span className="text-white text-sm">؟<\/span>\s*<\/button>\s*/g,
      ''
    );
  }

  next = ensureSettingsWiring(next);

  // Drop unused Image import if no Image usage left
  if (next.includes("from 'next/image'") && !/<Image[\s\n]/.test(next)) {
    next = next.replace(/import Image from 'next\/image';\s*/g, '');
  }

  return next === src ? null : next;
}

let changed = 0;
for (const rel of GLOBS) {
  const root = path.join(APP, rel);
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    const cleaned = cleanSource(src);
    if (cleaned) {
      fs.writeFileSync(file, cleaned);
      changed++;
      console.log('cleaned', path.relative(APP, file));
    }
  }
}

console.log(`clean-legacy: updated ${changed} page.tsx files`);
