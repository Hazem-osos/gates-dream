import {
  buildContractingSettlementFingerprint,
  claimContractingSettlementIdempotencyInTx,
  completeContractingSettlementIdempotencyInTx,
  IDEMPOTENCY_KEY_CONFLICT,
} from '../../modules/contracting/settlement/contracting-settlement-idempotency.service';
import { AppError } from '../../shared/middleware/error-handler';
import { Prisma } from '@prisma/client';

describe('contracting settlement idempotency (P0-2.1)', () => {
  it('buildContractingSettlementFingerprint is stable regardless of key order', () => {
    const a = buildContractingSettlementFingerprint({
      clientInvoiceId: 'inv-1',
      amount: 5000,
      safeId: 'safe-1',
    });
    const b = buildContractingSettlementFingerprint({
      safeId: 'safe-1',
      amount: 5000,
      clientInvoiceId: 'inv-1',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);

    const c = buildContractingSettlementFingerprint({
      clientInvoiceId: 'inv-1',
      amount: 7000,
      safeId: 'safe-1',
    });
    expect(c).not.toBe(a);
  });

  it('claim → complete → replay returns stored result', async () => {
    const store = new Map<string, Record<string, unknown>>();
    let idSeq = 0;

    const tx = {
      contractingSettlementIdempotency: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const duplicate = [...store.values()].find(
            (r) =>
              r.companyId === data.companyId &&
              r.operation === data.operation &&
              r.idempotencyKey === data.idempotencyKey
          );
          if (duplicate) {
            throw new Prisma.PrismaClientKnownRequestError('Unique', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
          const id = `idem-${++idSeq}`;
          const row = { id, ...data };
          store.set(id, row);
          return row;
        },
        findUnique: async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const prev = store.get(where.id);
          if (!prev) throw new Error('missing');
          const next = { ...prev, ...data };
          store.set(where.id, next);
          return next;
        },
      },
      $queryRaw: async () => {
        const row = [...store.values()].find(
          (r) =>
            r.companyId === 'co-1' &&
            r.operation === 'CLIENT_INVOICE_COLLECT' &&
            r.idempotencyKey === 'key-abc'
        );
        return row ? [{ id: row.id as string }] : [];
      },
    } as unknown as Prisma.TransactionClient;

    const fingerprint = buildContractingSettlementFingerprint({
      clientInvoiceId: 'inv-1',
      amount: 5000,
    });

    const claim1 = await claimContractingSettlementIdempotencyInTx(tx, {
      companyId: 'co-1',
      operation: 'CLIENT_INVOICE_COLLECT',
      idempotencyKey: 'key-abc',
      requestFingerprint: fingerprint,
    });
    expect(claim1.mode).toBe('EXECUTE');

    if (claim1.mode !== 'EXECUTE') throw new Error('expected execute');

    await completeContractingSettlementIdempotencyInTx(tx, claim1.recordId, {
      cashTransactionId: 'cash-1',
      allocationId: 'alloc-1',
      collectedAmount: 5000,
      settlementStatus: 'PARTIALLY_SETTLED',
    });

    const replay = await claimContractingSettlementIdempotencyInTx(tx, {
      companyId: 'co-1',
      operation: 'CLIENT_INVOICE_COLLECT',
      idempotencyKey: 'key-abc',
      requestFingerprint: fingerprint,
    });
    expect(replay.mode).toBe('REPLAY');
    if (replay.mode === 'REPLAY') {
      expect(replay.result.cashTransactionId).toBe('cash-1');
      expect(replay.result.allocationId).toBe('alloc-1');
    }
  });

  it('rejects fingerprint mismatch with IDEMPOTENCY_KEY_CONFLICT', async () => {
    const row = {
      id: 'row-1',
      companyId: 'co-1',
      operation: 'CLIENT_INVOICE_COLLECT',
      idempotencyKey: 'key-abc',
      requestFingerprint: buildContractingSettlementFingerprint({ amount: 5000 }),
      status: 'COMPLETED',
      resultJson: { cashTransactionId: 'cash-1' },
      cashTransactionId: 'cash-1',
      allocationId: null,
    };

    const tx = {
      contractingSettlementIdempotency: {
        create: async () => {
          const err = new Prisma.PrismaClientKnownRequestError('Unique', {
            code: 'P2002',
            clientVersion: 'test',
          });
          throw err;
        },
        findUnique: async () => row,
      },
      $queryRaw: async () => [{ id: row.id }],
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimContractingSettlementIdempotencyInTx(tx, {
        companyId: 'co-1',
        operation: 'CLIENT_INVOICE_COLLECT',
        idempotencyKey: 'key-abc',
        requestFingerprint: buildContractingSettlementFingerprint({ amount: 7000 }),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining(IDEMPOTENCY_KEY_CONFLICT),
    } satisfies Partial<AppError>);
  });
});
