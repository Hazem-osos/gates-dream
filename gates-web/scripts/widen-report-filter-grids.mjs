#!/usr/bin/env node
/** Widen legacy report filter layouts to 2–3 columns per row. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (name === 'page.tsx') acc.push(full);
  }
  return acc;
}

let n = 0;
for (const file of walk(APP)) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(
    /grid grid-cols-1 md:grid-cols-2 gap-8/g,
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
  );
  src = src.replace(
    /grid grid-cols-1 lg:grid-cols-2 gap-6/g,
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
  );
  src = src.replace(/w-3\/4 p-2\.5/g, 'w-full p-2.5');
  src = src.replace(/className=\{selectCls\}/g, (m) => m); // noop placeholder

  src = src.replace(
    /<div className="col-span-full space-y-6/g,
    '<div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 [&_.space-y-4]:contents [&_.space-y-6]:contents [&_.space-y-4>h3]:col-span-full [&_.space-y-6>h3]:col-span-full'
  );

  if (src !== before) {
    fs.writeFileSync(file, src);
    n++;
  }
}
console.log(`Updated layout in ${n} files`);
