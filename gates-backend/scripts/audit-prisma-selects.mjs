/**
 * Fails when a Prisma select names a scalar field the generated model does not have.
 * Catches `@ts-nocheck` files that still crash at runtime (Item.code).
 *
 * Run: npm run audit:prisma-selects
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { Prisma } = require(path.join(root, 'node_modules/@prisma/client'));

const models = new Map();
for (const model of Prisma.dmmf.datamodel.models) {
  const scalars = new Set(
    model.fields.filter((field) => field.kind !== 'object').map((field) => field.name)
  );
  models.set(model.name, scalars);
}

const computedFields = new Map([['Item', new Set(['code'])]]);

const relationTargets = new Map();
for (const model of Prisma.dmmf.datamodel.models) {
  for (const field of model.fields) {
    if (field.kind !== 'object') continue;
    const list = relationTargets.get(field.name) ?? new Set();
    list.add(field.type);
    relationTargets.set(field.name, list);
  }
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function scalarSelectNames(block) {
  const names = [];
  let depth = 0;
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*true\b|[{}]/g;
  let match = re.exec(block);
  while (match) {
    if (match[0] === '{') depth += 1;
    else if (match[0] === '}') depth -= 1;
    else if (depth === 0 && match[1]) names.push(match[1]);
    match = re.exec(block);
  }
  return names;
}

const files = [];
walk(path.join(root, 'src'), files);
walk(path.join(root, 'scripts'), files);

const errors = [];
const selectRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*select\s*:\s*\{/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  selectRe.lastIndex = 0;
  let match = selectRe.exec(source);
  while (match) {
    const relation = match[1];
    const targets = relationTargets.get(relation);
    if (targets && targets.size > 0) {
      const open = match.index + match[0].lastIndexOf('{');
      const close = matchingBrace(source, open);
      if (close > open) {
        const inner = source.slice(open + 1, close);
        for (const name of scalarSelectNames(inner)) {
          const owners = [...targets].filter(
            (modelName) => models.get(modelName)?.has(name) || computedFields.get(modelName)?.has(name)
          );
          if (owners.length === 0) {
            const line = source.slice(0, match.index).split('\n').length;
            errors.push(
              `${path.relative(root, file)}:${line} ${relation} selects ${name}, which is not a field of ${[...targets].join(' or ')}`
            );
          }
        }
      }
    }
    match = selectRe.exec(source);
  }
}

const unique = [...new Set(errors)];
if (unique.length) {
  console.error(`Prisma select guard failed (${unique.length}):`);
  for (const line of unique) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`Prisma select guard ok (${files.length} files).`);
