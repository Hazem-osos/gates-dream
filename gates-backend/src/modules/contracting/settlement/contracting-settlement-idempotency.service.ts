import { createHash } from 'node:crypto';
import type {
  ContractingSettlementIdempotencyOperation,
  Prisma,
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';

export const IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT';

export type SettlementIdempotencyResult = {
  cashTransactionId: string;
  allocationId?: string | null;
  reversalJournalEntryId?: string | null;
  eligibleAmount?: number;
  collectedAmount?: number;
  paidAmount?: number;
  remainingSettlementAmount?: number;
  remainingAmount?: number;
  settlementStatus?: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

export function buildContractingSettlementFingerprint(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

async function lockIdempotencyRowInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  operation: ContractingSettlementIdempotencyOperation,
  idempotencyKey: string
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contracting_settlement_idempotencies
    WHERE companyId = ${companyId}
      AND operation = ${operation}
      AND idempotencyKey = ${idempotencyKey}
    FOR UPDATE
  `;
  if (!rows.length) return null;
  return tx.contractingSettlementIdempotency.findUnique({ where: { id: rows[0].id } });
}

function assertFingerprintMatch(
  stored: string,
  expected: string,
  idempotencyKey: string
) {
  if (stored !== expected) {
    throw new AppError(
      409,
      `${IDEMPOTENCY_KEY_CONFLICT}: idempotency key "${idempotencyKey}" was already used for a different settlement request`
    );
  }
}

function parseReplay(row: {
  resultJson: unknown;
  cashTransactionId: string | null;
  allocationId: string | null;
}): SettlementIdempotencyResult {
  if (row.resultJson && typeof row.resultJson === 'object') {
    return row.resultJson as SettlementIdempotencyResult;
  }
  if (!row.cashTransactionId) {
    throw new AppError(500, 'Idempotency record completed without result payload');
  }
  return {
    cashTransactionId: row.cashTransactionId,
    allocationId: row.allocationId,
  };
}

/**
 * Claims an idempotency slot inside the settlement transaction.
 * Concurrent requests with the same key block on FOR UPDATE until the winner commits.
 */
export async function claimContractingSettlementIdempotencyInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    operation: ContractingSettlementIdempotencyOperation;
    idempotencyKey: string;
    requestFingerprint: string;
  }
): Promise<{ mode: 'EXECUTE'; recordId: string } | { mode: 'REPLAY'; result: SettlementIdempotencyResult }> {
  const { companyId, operation, idempotencyKey, requestFingerprint } = params;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await tx.contractingSettlementIdempotency.create({
        data: {
          companyId,
          operation,
          idempotencyKey,
          requestFingerprint,
          status: 'PENDING',
        },
      });
      return { mode: 'EXECUTE', recordId: row.id };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    const existing = await lockIdempotencyRowInTx(tx, companyId, operation, idempotencyKey);
    if (!existing) {
      continue;
    }

    assertFingerprintMatch(existing.requestFingerprint, requestFingerprint, idempotencyKey);

    if (existing.status === 'COMPLETED') {
      return { mode: 'REPLAY', result: parseReplay(existing) };
    }

    throw new AppError(409, 'Settlement request with this idempotency key is already in progress');
  }

  throw new AppError(409, 'Could not claim settlement idempotency key');
}

export async function completeContractingSettlementIdempotencyInTx(
  tx: Prisma.TransactionClient,
  recordId: string,
  result: SettlementIdempotencyResult
) {
  await tx.contractingSettlementIdempotency.update({
    where: { id: recordId },
    data: {
      status: 'COMPLETED',
      cashTransactionId: result.cashTransactionId,
      allocationId: result.allocationId ?? null,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
  });
}

export function mapSettlementTotalsToIdempotencyResult(params: {
  cashTransactionId: string;
  allocationId?: string | null;
  totals: Record<string, unknown>;
}): SettlementIdempotencyResult {
  return {
    cashTransactionId: params.cashTransactionId,
    allocationId: params.allocationId ?? null,
    ...params.totals,
  };
}
