#!/usr/bin/env node
/**
 * extract-web-screens.mjs
 *
 * Parse every gates-web app page.tsx for route, Arabic labels, form fields,
 * API calls, and (best-effort) Prisma models written by the matching backend
 * services. Emit docs/parity/web-screens/*.json.
 *
 * Usage:
 *   node scripts/legacy/extract-web-screens.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, readJson, writeJson, safeFileSlug, moduleFromRoute } from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['web', 'backend', 'parity']);
const WEB_DIR = path.resolve(args.web || path.join(REPO_ROOT, 'gates-web'));
const BACKEND_DIR = path.resolve(args.backend || path.join(REPO_ROOT, 'gates-backend'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const OUT_DIR = path.join(PARITY_DIR, 'web-screens');

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(ent.name)) continue;
      walkFiles(p, predicate, out);
    } else if (predicate(p)) {
      out.push(p);
    }
  }
  return out;
}

function extractCompactFields(text) {
  const fields = [];
  const re = /<CompactFormField\b([^>]*)\/>|<CompactFormField\b([^>]*)>/g;
  for (const m of text.matchAll(re)) {
    const attrs = m[1] || m[2] || '';
    const label = attrs.match(/label=["']([^"']+)["']/)?.[1];
    const name =
      attrs.match(/\{\.\.\.register\(\s*['"](\w+)['"]/)?.[1] ||
      attrs.match(/value=\{formData\.(\w+)\}/)?.[1] ||
      attrs.match(/name=["'](\w+)["']/)?.[1] ||
      null;
    if (label || name) fields.push({ name, labelAr: label || '', source: 'CompactFormField' });
  }
  return fields;
}

function extractRegisterFields(text) {
  const fields = [];
  for (const m of text.matchAll(/register\(\s*['"](\w+)['"]/g)) {
    fields.push({ name: m[1], labelAr: '', source: 'register' });
  }
  return fields;
}

function extractErpLabels(text) {
  const fields = [];
  for (const m of text.matchAll(/(?:erpLabelClass|compactLabelClass)\}>([^<]{1,60})</g)) {
    const label = m[1].replace(/\s+/g, ' ').trim();
    if (label) fields.push({ name: null, labelAr: label, source: 'erpLabel' });
  }
  return fields;
}

function extractRawLabelRegisters(text) {
  const fields = [];
  const re = /<label[^>]*>([^<]+)<\/label>[\s\S]{0,400}?register\(\s*['"](\w+)['"]/g;
  for (const m of text.matchAll(re)) {
    fields.push({ name: m[2], labelAr: m[1].replace(/\s+/g, ' ').trim(), source: 'label+register' });
  }
  return fields;
}

function extractUseStateFields(text) {
  const fields = [];
  const re = /useState\(\s*\{([\s\S]*?)\}\s*\)/g;
  for (const m of text.matchAll(re)) {
    const body = m[1];
    if (body.length > 4000) continue;
    for (const km of body.matchAll(/^\s*(\w+)\s*:/gm)) {
      fields.push({ name: km[1], labelAr: '', source: 'useState' });
    }
  }
  return fields;
}

function extractZodSchemaNames(text) {
  const names = [];
  for (const m of text.matchAll(/zodResolver\(\s*(\w+)/g)) names.push(m[1]);
  return names;
}

function extractZodFields(schemaFiles, schemaNames) {
  const fields = [];
  for (const file of schemaFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const name of schemaNames) {
      const re = new RegExp(`export const ${name}\\s*=\\s*z\\.object\\(\\{([\\s\\S]*?)\\}\\)`, 'm');
      const m = text.match(re);
      if (!m) continue;
      for (const km of m[1].matchAll(/^\s*(\w+)\s*:/gm)) {
        const err = m[1].match(new RegExp(`${km[1]}:[\\s\\S]{0,120}['"]([^'"]+)['"]`));
        fields.push({
          name: km[1],
          labelAr: err?.[1] || '',
          source: `zod:${name}`,
        });
      }
    }
  }
  return fields;
}

function resolveImport(fromFile, spec) {
  const candidates = [];
  if (spec.startsWith('@/')) {
    const rest = spec.slice(2);
    candidates.push(path.join(WEB_DIR, rest));
    candidates.push(path.join(WEB_DIR, 'app', rest));
  } else if (spec.startsWith('.')) {
    candidates.push(path.resolve(path.dirname(fromFile), spec));
  } else {
    return null;
  }
  const exts = ['', '.tsx', '.ts', '.jsx', '.js'];
  for (const base of candidates) {
    for (const ext of exts) {
      const p = base.endsWith('.tsx') || base.endsWith('.ts') || base.endsWith('.jsx') || base.endsWith('.js') ? base : base + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    const idx = path.join(base, 'index.tsx');
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function collectRelatedFiles(pagePath, text) {
  const files = [pagePath];
  const seen = new Set([pagePath]);
  for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    const interesting =
      spec.startsWith('.') ||
      /components\/(inventory|accounting|erp|form|hr|real-estate|contracting)/.test(spec) ||
      /(Form|Grid|Header|Line|Engine|Fields|Card)/.test(spec);
    if (!interesting) continue;
    const resolved = resolveImport(pagePath, spec);
    if (!resolved || seen.has(resolved)) continue;
    if (resolved.includes('node_modules')) continue;
    seen.add(resolved);
    files.push(resolved);
  }
  return files;
}

function extractPageTitle(text, fallback) {
  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/,
    /title=["']([^"']+)["']/,
    /<PageHeader[^>]*title=["']([^"']+)["']/,
    /label:\s*['"]([^'"]+)['"]/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const raw = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw && /[\u0600-\u06FF]/.test(raw)) return raw.slice(0, 80);
  }
  return fallback;
}

function extractApiPaths(text) {
  const paths = new Set();
  const patterns = [
    /useApi(?:Query|Mutation|InfiniteQuery)\(\s*['"`]([^'"`]+)['"`]/g,
    /apiClient\.\w+\(\s*['"`]([^'"`]+)['"`]/g,
    /['"`](\/(?:accounting|inventory|hr|extracts|manufacturing|real-estate|pos|electronic-invoices|importexport|settings|treasury|invoices|company|users)[^'"`]*)['"`]/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const p = m[1].split('?')[0];
      if (p.startsWith('/')) paths.add(p);
    }
  }
  return [...paths];
}

function extractGridHeaders(text) {
  const headers = new Set();
  for (const m of text.matchAll(/label:\s*['"]([^'"]+)['"]/g)) {
    if (/[\u0600-\u06FF]/.test(m[1]) && m[1].length <= 40) headers.add(m[1]);
  }
  for (const m of text.matchAll(/<(?:th|TableHead)[^>]*>\s*([^<]{1,40})\s*</g)) {
    const v = m[1].trim();
    if (/[\u0600-\u06FF]/.test(v)) headers.add(v);
  }
  return [...headers];
}

function mergeFields(...lists) {
  const byName = new Map();
  const unlabeled = [];
  for (const list of lists) {
    for (const f of list) {
      if (!f.name) {
        if (f.labelAr) unlabeled.push(f);
        continue;
      }
      const existing = byName.get(f.name);
      if (!existing) byName.set(f.name, { ...f });
      else if (!existing.labelAr && f.labelAr) existing.labelAr = f.labelAr;
    }
  }
  return [...byName.values(), ...unlabeled];
}

function parseAppMounts(appTsPath) {
  if (!fs.existsSync(appTsPath)) return [];
  const text = fs.readFileSync(appTsPath, 'utf8');
  const mounts = [];
  for (const m of text.matchAll(/app\.use\(\s*['"](\/api\/v1\/[^'"]+)['"]\s*,\s*(\w+)/g)) {
    mounts.push({ prefix: m[1], ident: m[2] });
  }
  return mounts;
}

function findPrismaModels(backendSrc, apiPaths, mounts) {
  const models = new Set();
  const services = new Set();
  for (const apiPath of apiPaths) {
    const full = apiPath.startsWith('/api/') ? apiPath : `/api/v1${apiPath}`;
    const mount = mounts
      .filter((m) => full === m.prefix || full.startsWith(`${m.prefix}/`))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!mount) continue;
    const guess = mount.ident.replace(/Routes$/, '').replace(/Router$/, '');
    const hits = walkFiles(backendSrc, (p) => {
      const base = path.basename(p).toLowerCase();
      return (
        (base.includes(guess.toLowerCase()) || p.toLowerCase().includes(`/${guess.toLowerCase()}`)) &&
        /\.(ts|js)$/.test(p) &&
        /service|routes/.test(base)
      );
    });
    for (const file of hits.slice(0, 8)) {
      services.add(path.relative(backendSrc, file));
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/prisma\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/g)) {
        models.add(m[1]);
      }
    }
  }
  return { models: [...models], services: [...services] };
}

function main() {
  console.log('Extracting web screens...');
  const appDir = path.join(WEB_DIR, 'app');
  const pages = walkFiles(appDir, (p) => /\/page\.(tsx|ts|jsx|js)$/.test(p.replace(/\\/g, '/')));
  const schemaFiles = walkFiles(path.join(WEB_DIR, 'lib/validation'), (p) => p.endsWith('.schema.ts'));
  const mounts = parseAppMounts(path.join(BACKEND_DIR, 'src/app.ts'));
  const backendSrc = path.join(BACKEND_DIR, 'src');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.json'))) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const index = [];
  for (const pagePath of pages) {
    const rel = path.relative(appDir, pagePath).replace(/\\/g, '/');
    const route = '/' + rel.replace(/\/page\.(tsx|ts|jsx|js)$/, '').replace(/^page\.(tsx|ts|jsx|js)$/, '');
    const text = fs.readFileSync(pagePath, 'utf8');
    const related = collectRelatedFiles(pagePath, text);
    const relatedText = related.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const schemaNames = extractZodSchemaNames(relatedText);
    const fields = mergeFields(
      extractCompactFields(relatedText),
      extractRawLabelRegisters(relatedText),
      extractErpLabels(relatedText),
      extractRegisterFields(relatedText),
      extractUseStateFields(relatedText),
      extractZodFields(schemaFiles, schemaNames)
    );
    const apiPaths = extractApiPaths(relatedText);
    const prisma = findPrismaModels(backendSrc, apiPaths, mounts);
    const titleAr = extractPageTitle(text, route.split('/').filter(Boolean).slice(-1)[0] || route);
    const screen = {
      route: route === '/' ? '/' : route.replace(/\/$/, ''),
      titleAr,
      file: `app/${rel}`,
      module: moduleFromRoute(route),
      fields,
      gridHeaders: extractGridHeaders(text),
      apiPaths,
      prismaModelsWritten: prisma.models,
      backendServices: prisma.services,
      schemaNames,
    };
    const outName = `${safeFileSlug(screen.route === '/' ? 'root' : screen.route.replace(/^\//, '').replace(/\//g, '__'))}.json`;
    writeJson(path.join(OUT_DIR, outName), screen);
    index.push({
      route: screen.route,
      titleAr,
      fieldCount: fields.length,
      apiCount: apiPaths.length,
      file: `web-screens/${outName}`,
    });
  }

  writeJson(path.join(PARITY_DIR, 'web-screens-index.json'), {
    generatedAt: new Date().toISOString(),
    count: index.length,
    screens: index,
  });
  console.log(`  emitted ${index.length} web screens`);
}

main();
