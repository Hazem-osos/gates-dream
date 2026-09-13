import {
  buildKeysetWhere,
  clampKeysetLimit,
  decodeKeysetCursor,
  encodeKeysetCursor,
  paginateWithKeyset,
} from '../../src/shared/database/paginate-with-keyset';

describe('paginateWithKeyset helpers', () => {
  it('clamps limit to 1–100 with default 50', () => {
    expect(clampKeysetLimit(undefined)).toBe(50);
    expect(clampKeysetLimit(0)).toBe(1);
    expect(clampKeysetLimit(500)).toBe(100);
    expect(clampKeysetLimit(25)).toBe(25);
  });

  it('round-trips a compound Base64 { id, date } cursor', () => {
    const encoded = encodeKeysetCursor({
      id: 'inv-1',
      date: '2026-03-01T00:00:00.000Z',
    });
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual({
      id: 'inv-1',
      date: '2026-03-01T00:00:00.000Z',
    });
    expect(decodeKeysetCursor(encoded)).toEqual({
      id: 'inv-1',
      date: '2026-03-01T00:00:00.000Z',
    });
  });

  it('round-trips a numeric id', () => {
    const encoded = encodeKeysetCursor({
      id: 42,
      date: '2026-03-01T00:00:00.000Z',
    });
    expect(decodeKeysetCursor(encoded)).toEqual({
      id: 42,
      date: '2026-03-01T00:00:00.000Z',
    });
  });

  it('rejects a cursor without { id, date }', () => {
    const bad = Buffer.from(JSON.stringify({ id: 'only' }), 'utf8').toString('base64url');
    expect(() => decodeKeysetCursor(bad)).toThrow('Invalid pagination cursor');
    expect(() => decodeKeysetCursor('not-a-cursor')).toThrow('Invalid pagination cursor');
  });

  it('builds desc-forward composite OR (lt)', () => {
    const where = buildKeysetWhere({
      cursor: { id: 'abc', date: '2026-03-01T00:00:00.000Z' },
      sortField: 'date',
      idField: 'id',
      primaryDir: 'desc',
      direction: 'forward',
    });
    expect(where).toEqual({
      OR: [
        { date: { lt: new Date('2026-03-01T00:00:00.000Z') } },
        { date: new Date('2026-03-01T00:00:00.000Z'), id: { lt: 'abc' } },
      ],
    });
  });

  it('flips to gt when paging backward on a desc list', () => {
    const where = buildKeysetWhere({
      cursor: { id: 'abc', date: '2026-03-01T00:00:00.000Z' },
      sortField: 'date',
      idField: 'id',
      primaryDir: 'desc',
      direction: 'backward',
    });
    expect(where).toEqual({
      OR: [
        { date: { gt: new Date('2026-03-01T00:00:00.000Z') } },
        { date: new Date('2026-03-01T00:00:00.000Z'), id: { gt: 'abc' } },
      ],
    });
  });

  it('fetches limit+1, returns cursors, and reports hasMore', async () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      id: `id-${i}`,
      date: new Date(`2026-01-0${4 - i}T00:00:00.000Z`),
    }));
    const findMany = jest.fn(async (args: { take?: number }) => rows.slice(0, args.take));

    const result = await paginateWithKeyset({
      model: { findMany },
      limit: 3,
      where: { companyId: 'c1', isPosted: true },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 4,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        where: { companyId: 'c1', isPosted: true },
      })
    );
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    expect(result.prevCursor).toBeNull();
    expect(decodeKeysetCursor(result.nextCursor!)).toEqual({
      id: 'id-2',
      date: '2026-01-02T00:00:00.000Z',
    });
  });

  it('ANDs caller filters with the compound cursor predicate', async () => {
    const cursor = encodeKeysetCursor({
      id: 'inv-9',
      date: '2026-03-01T00:00:00.000Z',
    });
    const findMany = jest.fn(async () => []);

    await paginateWithKeyset({
      model: { findMany },
      cursor,
      where: {
        companyId: 'c1',
        isPosted: false,
        date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
      },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              companyId: 'c1',
              isPosted: false,
              date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
            },
            {
              OR: [
                { date: { lt: new Date('2026-03-01T00:00:00.000Z') } },
                { date: new Date('2026-03-01T00:00:00.000Z'), id: { lt: 'inv-9' } },
              ],
            },
          ],
        },
      })
    );
  });
});

describe('paginateWithKeyset(prismaModel, options)', () => {
  it('accepts the model as the first argument', async () => {
    const {
      paginateWithKeyset: paginateModelFirst,
      isKeysetListRequest,
    } = await import('../../src/utils/pagination/keysetPagination');

    const findMany = jest.fn(async () => [{ id: 'a', date: new Date('2026-01-01T00:00:00.000Z') }]);
    const result = await paginateModelFirst({ findMany }, { limit: 10, where: { companyId: 'c1' } });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(isKeysetListRequest({})).toBe(false);
    expect(isKeysetListRequest({ cursor: 'abc' })).toBe(true);
    expect(isKeysetListRequest({ direction: 'forward' })).toBe(true);
  });
});
