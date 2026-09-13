import { AppError } from '../middleware/error-handler';

export const KEYSET_DEFAULT_LIMIT = 50;
export const KEYSET_MAX_LIMIT = 100;

export type CursorDirection = 'forward' | 'backward';
export type OrderDirection = 'asc' | 'desc';
export type KeysetOrderBy = Array<Record<string, OrderDirection | undefined>>;

export type KeysetCursorPayload = {
  id: string | number;
  date: string;
};

export type PrismaFindManyDelegate<T> = {
  // Prisma delegates are generic over `findMany` args (contravariant).
  // `any` is required so Invoice/Journal/Movement delegates assign here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args?: any) => Promise<T[]>;
};

export type PaginateWithKeysetArgs<T> = {
  model: PrismaFindManyDelegate<T>;
  cursor?: string;
  limit?: number;
  direction?: CursorDirection;
  where?: Record<string, unknown>;
  /** Default: `[{ date: 'desc' }, { id: 'desc' }]`. */
  orderBy?: KeysetOrderBy;
  /** Primary sort column. Default `date`. Use `documentDate` for inventory movements. */
  sortField?: string;
  idField?: string;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

export type PaginateWithKeysetResult<T> = {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
};

/** @deprecated Use PaginateWithKeysetArgs */
export type PaginateWithCursorArgs<T> = PaginateWithKeysetArgs<T>;
/** @deprecated Use PaginateWithKeysetResult */
export type PaginateWithCursorResult<T> = PaginateWithKeysetResult<T>;

export function clampKeysetLimit(limit?: number): number {
  const n = limit == null || Number.isNaN(limit) ? KEYSET_DEFAULT_LIMIT : limit;
  return Math.min(Math.max(Math.trunc(n), 1), KEYSET_MAX_LIMIT);
}

export function encodeKeysetCursor(payload: KeysetCursorPayload): string {
  if (
    (typeof payload.id !== 'string' && typeof payload.id !== 'number') ||
    typeof payload.date !== 'string' ||
    payload.date.length === 0
  ) {
    throw new AppError(500, 'Keyset cursor requires { id, date }');
  }
  return Buffer.from(JSON.stringify({ id: payload.id, date: payload.date }), 'utf8').toString(
    'base64url'
  );
}

export function decodeKeysetCursor(cursor: string): KeysetCursorPayload {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<KeysetCursorPayload>;
    if (
      parsed &&
      (typeof parsed.id === 'string' || typeof parsed.id === 'number') &&
      typeof parsed.date === 'string' &&
      parsed.date.length > 0
    ) {
      return { id: parsed.id, date: parsed.date };
    }
  } catch {
    /* try legacy id:timestamp */
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [id, timestamp] = decoded.split(':');
    const ts = Number(timestamp);
    if (id && Number.isFinite(ts)) {
      return { id, date: new Date(ts).toISOString() };
    }
  } catch {
    /* fall through */
  }

  throw new AppError(400, 'Invalid pagination cursor');
}

function flipOrderBy(orderBy: KeysetOrderBy): KeysetOrderBy {
  return orderBy.map((clause) => {
    const flipped: Record<string, OrderDirection | undefined> = {};
    for (const [key, dir] of Object.entries(clause)) {
      if (dir === 'desc' || dir === 'asc') {
        flipped[key] = dir === 'desc' ? 'asc' : 'desc';
      }
    }
    return flipped;
  });
}

function comparisonOp(
  primaryDir: OrderDirection,
  direction: CursorDirection
): 'lt' | 'gt' {
  const forward = direction === 'forward';
  return (primaryDir === 'desc') === forward ? 'lt' : 'gt';
}

/**
 * Composite keyset predicate:
 * `{ OR: [{ date: { lt } }, { date: cursorDate, id: { lt } }] }`
 * (operators flip for asc / backward).
 */
export function buildKeysetWhere(input: {
  cursor: KeysetCursorPayload;
  sortField: string;
  idField: string;
  primaryDir: OrderDirection;
  direction: CursorDirection;
}): Record<string, unknown> {
  const op = comparisonOp(input.primaryDir, input.direction);
  const idClause = { [input.idField]: { [op]: input.cursor.id } };

  if (input.sortField === input.idField) {
    return idClause;
  }

  const cursorDate = new Date(input.cursor.date);
  if (Number.isNaN(cursorDate.getTime())) {
    throw new AppError(400, 'Invalid pagination cursor date');
  }

  return {
    OR: [
      { [input.sortField]: { [op]: cursorDate } },
      { [input.sortField]: cursorDate, ...idClause },
    ],
  };
}

function readSortValue(row: Record<string, unknown>, field: string): unknown {
  return row[field];
}

function toCursorDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function rowToCursor(
  row: Record<string, unknown>,
  sortField: string,
  idField: string
): KeysetCursorPayload {
  const id = row[idField];
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new AppError(500, 'Keyset pagination row is missing an id');
  }
  const date = toCursorDate(readSortValue(row, sortField));
  if (!date) {
    throw new AppError(500, `Keyset pagination row is missing ${sortField}`);
  }
  return { id, date };
}

function mergeWhere(
  where: Record<string, unknown> | undefined,
  cursorWhere: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!cursorWhere) return where;
  if (!where || Object.keys(where).length === 0) return cursorWhere;
  return { AND: [where, cursorWhere] };
}

/**
 * Keyset (cursor) pagination against a Prisma delegate.
 * Fetches `limit + 1` to detect `hasMore` without COUNT(*) or OFFSET.
 *
 * Forward (desc date): `{ OR: [{ date: { lt } }, { date, id: { lt } }] }`
 * Backward (desc date): `{ OR: [{ date: { gt } }, { date, id: { gt } }] }`
 */
export async function paginateWithKeyset<T extends Record<string, unknown>>(
  args: PaginateWithKeysetArgs<T>
): Promise<PaginateWithKeysetResult<T>> {
  const limit = clampKeysetLimit(args.limit);
  const direction = args.direction ?? 'forward';
  const sortField = args.sortField ?? 'date';
  const idField = args.idField ?? 'id';
  const orderBy: KeysetOrderBy =
    args.orderBy ??
    ([{ [sortField]: 'desc' }, { [idField]: 'desc' }] as KeysetOrderBy);
  const primaryDir = (Object.values(orderBy[0] ?? {})[0] as OrderDirection) ?? 'desc';

  let cursorWhere: Record<string, unknown> | undefined;
  if (args.cursor) {
    const decoded = decodeKeysetCursor(args.cursor);
    cursorWhere = buildKeysetWhere({
      cursor: decoded,
      sortField,
      idField,
      primaryDir,
      direction,
    });
  }

  const queryOrderBy = direction === 'backward' ? flipOrderBy(orderBy) : orderBy;
  const findArgs: Record<string, unknown> = {
    where: mergeWhere(args.where, cursorWhere),
    orderBy: queryOrderBy,
    take: limit + 1,
  };
  if (args.select) findArgs.select = args.select;
  if (args.include) findArgs.include = args.include;

  const fetched = await args.model.findMany(findArgs);
  const extra = fetched.length > limit;
  const page = (extra ? fetched.slice(0, limit) : fetched) as T[];
  if (direction === 'backward') page.reverse();

  const first = page[0] as Record<string, unknown> | undefined;
  const last = page[page.length - 1] as Record<string, unknown> | undefined;

  const hasMoreForward = direction === 'forward' ? extra : page.length > 0;
  const hasMoreBackward =
    direction === 'backward' ? extra : Boolean(args.cursor) && page.length > 0;

  return {
    items: page,
    nextCursor:
      hasMoreForward && last ? encodeKeysetCursor(rowToCursor(last, sortField, idField)) : null,
    prevCursor:
      hasMoreBackward && first
        ? encodeKeysetCursor(rowToCursor(first, sortField, idField))
        : null,
    hasMore: extra,
  };
}

/** @deprecated Use paginateWithKeyset */
export const paginateWithCursor = paginateWithKeyset;

/** Shared Zod-friendly query fragment for list endpoints. */
export const keysetQueryFields = {
  cursor: true,
  direction: true,
} as const;
