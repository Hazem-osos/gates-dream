import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

/**
 * MySQL FULLTEXT lookups for typeahead / list search.
 *
 * Requested semantic fields → actual camelCase columns (no @map):
 *   invoices: invoice_number/reference_number/notes → invoiceNumber, record, description
 *   partners: name/commercial_name/tax_number/phone → arabicName, englishName,
 *             taxAuthority|registrationNumber, mobile
 *   items:    name/sku/barcode → arabicName, serial, barcode
 */
export const FULLTEXT_LOOKUPS = {
  invoices: {
    table: 'invoices',
    columns: ['invoiceNumber', 'record', 'description'],
  },
  customers: {
    table: 'customers',
    columns: ['arabicName', 'englishName', 'taxAuthority', 'mobile'],
  },
  suppliers: {
    table: 'suppliers',
    columns: ['arabicName', 'englishName', 'registrationNumber', 'mobile'],
  },
  items: {
    table: 'items',
    columns: ['arabicName', 'serial', 'barcode'],
  },
} as const;

export type FullTextLookup = keyof typeof FULLTEXT_LOOKUPS;

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;

function rawIdent(name: string): Prisma.Sql {
  if (!IDENT.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return Prisma.raw(`\`${name}\``);
}

/** Strip BOOLEAN MODE operators and append `*` so partial tokens use the FT index. */
export function toBooleanModeQuery(raw: string): string | null {
  const tokens = raw
    .normalize('NFKC')
    .trim()
    .split(/\s+/)
    .map((token) =>
      token
        .replace(/^[+\-]+/, '')
        .replace(/[><()~*"\\@]+/g, '')
        .replace(/'/g, '')
    )
    .filter((token) => token.length > 0)
    .slice(0, 8)
    .map((token) => `${token}*`);
  if (tokens.length === 0) return null;
  return tokens.join(' ');
}

/**
 * Returns matching primary keys, or `null` when search is empty (skip FT filter).
 * Always includes `companyId = ?` — `$queryRaw` is not tenant-scoped by the Prisma extension.
 */
export async function findFullTextIds(
  lookup: FullTextLookup,
  companyId: string,
  search: string,
  opts?: { limit?: number; db?: PrismaClient }
): Promise<string[] | null> {
  const against = toBooleanModeQuery(search);
  if (!against || !companyId) return null;

  const spec = FULLTEXT_LOOKUPS[lookup];
  const db = opts?.db ?? prisma;
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000);
  const table = rawIdent(spec.table);
  const idCol = rawIdent('id');
  const companyCol = rawIdent('companyId');
  const matchCols = Prisma.join(spec.columns.map((c) => rawIdent(c)));

  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT ${idCol} AS id
    FROM ${table}
    WHERE ${companyCol} = ${companyId}
      AND MATCH(${matchCols}) AGAINST(${against} IN BOOLEAN MODE)
    LIMIT ${Prisma.raw(String(limit))}
  `);

  return rows.map((row) => row.id);
}

/** Apply FT results onto a Prisma `where`. `'empty'` means the caller should return no rows. */
export function applyFullTextIds(
  where: Record<string, unknown>,
  ids: string[] | null
): Record<string, unknown> | 'empty' {
  if (ids === null) return where;
  if (ids.length === 0) return 'empty';
  where.id = { in: ids };
  return where;
}
