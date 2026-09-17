import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(root, '../prisma/schema.prisma'), 'utf8');
const outPath = resolve(root, '../docs/DATABASE-FULL-CATALOG.generated.md');

function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const cleaned = stripBlockComments(schema);
const SCALARS = new Set(['String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes']);
const ENUMS = new Set([...cleaned.matchAll(/\nenum (\w+) \{/g)].map((m) => m[1]));
const modelRe = /(?:^|\n)((?:\/\/\/.*\n)*)model (\w+) \{([\s\S]*?)\n\}/g;
const models = [];
let match;

while ((match = modelRe.exec(cleaned))) {
  const docs = (match[1] || '')
    .split('\n')
    .map((l) => l.replace(/^\/\/\/\s?/, '').trim())
    .filter(Boolean);
  const name = match[2];
  const body = match[3];
  const tableMatch = body.match(/@@map\("([^"]+)"\)/);
  const table = tableMatch?.[1] || name;
  const fields = [];
  const uniques = [];
  const indexes = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) {
      if (line.startsWith('@@unique') || line.startsWith('@@id')) uniques.push(line);
      if (line.startsWith('@@index')) indexes.push(line);
      continue;
    }
    const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*?)(?:\/\/\s*(.*))?$/);
    if (!fieldMatch) continue;
    const attrs = (fieldMatch[5] || '').trim();
    const baseType = fieldMatch[2];
    const isRelation =
      /@relation/.test(attrs) || (!SCALARS.has(baseType) && !ENUMS.has(baseType));
    const relName = attrs.match(/@relation\(\s*"([^"]+)"/)?.[1];
    fields.push({
      name: fieldMatch[1],
      type: fieldMatch[2] + (fieldMatch[3] || ''),
      optional: Boolean(fieldMatch[4]),
      isList: Boolean(fieldMatch[3]),
      isRelation,
      relationName: relName,
      attributes: attrs.replace(/\s+/g, ' ').trim(),
      comment: (fieldMatch[6] || '').trim(),
    });
  }

  models.push({ name, table, docs, fields, uniques, indexes });
}

function fieldNote(f) {
  const bits = [];
  if (f.optional) bits.push('اختياري');
  if (f.attributes.includes('@id')) bits.push('PK');
  if (f.attributes.includes('@unique')) bits.push('فريد');
  if (f.attributes.includes('@default(uuid())')) bits.push('UUID');
  if (f.attributes.includes('@default(now())')) bits.push('الآن');
  if (f.attributes.includes('@updatedAt')) bits.push('يتحدث تلقائي');
  const d = f.attributes.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
  if (d) bits.push(`Decimal(${d[1]},${d[2]})`);
  if (f.comment) bits.push(f.comment);
  return bits.join(' · ');
}

const lines = [];
lines.push('# كتالوج الجداول الكامل');
lines.push('');
lines.push(`مولَّد من \`prisma/schema.prisma\` — ${models.length} موديل.`);
lines.push('');

for (const model of models) {
  const scalars = model.fields.filter((f) => !f.isRelation);
  const relations = model.fields.filter((f) => f.isRelation);
  lines.push(`## \`${model.table}\` (\`${model.name}\`)`);
  lines.push('');
  if (model.docs.length) {
    lines.push(model.docs.join(' '));
    lines.push('');
  }
  lines.push('| العمود | النوع | ملاحظات |');
  lines.push('|---|---|---|');
  for (const f of scalars) {
    lines.push(`| \`${f.name}\` | ${f.type}${f.optional ? '?' : ''} | ${fieldNote(f) || '—'} |`);
  }
  lines.push('');
  if (relations.length) {
    lines.push('**العلاقات**');
    lines.push('');
    for (const f of relations) {
      const card = f.isList ? '1→N' : f.optional ? 'N→0..1' : 'N→1';
      const via = f.relationName ? ` اسم العلاقة: \`${f.relationName}\`` : '';
      const fk = f.attributes.match(/fields:\s*\[([^\]]+)\]/)?.[1];
      const ref = f.attributes.match(/references:\s*\[([^\]]+)\]/)?.[1];
      const del = f.attributes.match(/onDelete:\s*(\w+)/)?.[1];
      const extra = [
        fk && ref ? `FK \`${fk}\` → \`${f.type.replace('[]', '')}.${ref}\`` : '',
        del ? `onDelete ${del}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      lines.push(`- ${card} \`${f.name}\` → \`${f.type}\`${via}${extra ? ` — ${extra}` : ''}`);
    }
    lines.push('');
  }
  if (model.uniques.length) {
    lines.push(`قيود فريدة: ${model.uniques.map((u) => `\`${u}\``).join(' · ')}`);
    lines.push('');
  }
  if (model.indexes.length) {
    lines.push(`فهارس: ${model.indexes.map((u) => `\`${u}\``).join(' · ')}`);
    lines.push('');
  }
}

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${models.length} models → ${outPath}`);
