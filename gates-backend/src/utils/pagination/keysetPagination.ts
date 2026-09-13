/**
 * Generic Prisma keyset (cursor) pagination.
 *
 *   paginateWithKeyset(prisma.invoice, { where, cursor, limit, direction })
 *
 * Cursor is base64url `{ id, date }`. Default order is date DESC, id DESC.
 * Forward:  { OR: [{ date: { lt } }, { date, id: { lt } }] }
 * Backward: { OR: [{ date: { gt } }, { date, id: { gt } }] }
 */
export {
  encodeKeysetCursor,
  decodeKeysetCursor,
  buildKeysetWhere,
  clampKeysetLimit,
  KEYSET_DEFAULT_LIMIT,
  KEYSET_MAX_LIMIT,
} from '../../shared/database/paginate-with-cursor';
export type {
  PaginateWithKeysetResult,
  CursorDirection,
  KeysetCursorPayload,
  KeysetOrderBy,
  PrismaFindManyDelegate,
} from '../../shared/database/paginate-with-cursor';

import {
  paginateWithKeyset as paginateWithKeysetArgs,
  type PaginateWithKeysetArgs,
  type PaginateWithKeysetResult,
  type PrismaFindManyDelegate,
} from '../../shared/database/paginate-with-cursor';

export type KeysetPaginationOptions<T> = Omit<PaginateWithKeysetArgs<T>, 'model'>;

/** True when the client asked for cursor pagination (not legacy page/OFFSET). */
export function isKeysetListRequest(opts: {
  cursor?: string;
  direction?: 'forward' | 'backward';
}): boolean {
  return Boolean(opts.cursor) || opts.direction === 'forward' || opts.direction === 'backward';
}

export async function paginateWithKeyset<T extends Record<string, unknown>>(
  prismaModel: PrismaFindManyDelegate<T>,
  options: KeysetPaginationOptions<T> = {}
): Promise<PaginateWithKeysetResult<T>> {
  return paginateWithKeysetArgs({ model: prismaModel, ...options });
}
