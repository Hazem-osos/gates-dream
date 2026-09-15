import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { companySettingService } from './company-setting.service';

export type DocumentSequenceScope = 'C' | 'Y';

export interface NextDocumentNumberInput {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  docType: string;
  scope?: DocumentSequenceScope;
  padding?: number;
  /**
   * Legacy `SerialStart{Type}` — first number handed out when this
   * (company, branch, docType[, year]) sequence has no rows yet. A brand
   * new row is seeded at `startNumber - 1` so the very next allocation
   * returns `startNumber`. Default 1 (legacy default `'00000001'`).
   */
  startNumber?: number;
  /**
   * Highest number already in use by documents that were numbered *before*
   * this docType got a sequence — legacy derived every number from `MAX()+1`,
   * so a table can already hold `00000001..N` while our counter would start
   * over at 1 and collide on the document's unique index.
   *
   * Consulted only when the sequence row has to be created, so it costs a
   * query once per (company, branch, docType[, year]) rather than per
   * allocation. Return 0 when nothing exists yet.
   */
  seedFromExisting?: () => Promise<number>;
  /**
   * Skips candidates already used by a pre-sequencing document. Needed on top
   * of `seedFromExisting` because a sequence row created before that seeding
   * existed (or before a data import) can sit *below* the numbers already in
   * the table, and the document's own unique index would then reject the
   * insert. Costs one indexed lookup per allocation and normally answers
   * `true` on the first candidate.
   */
  isAvailable?: (candidate: string) => Promise<boolean>;
}

/** Guards the skip-taken-numbers loop against an unbounded scan. */
const MAX_SEQUENCE_SKIPS = 1000;

/**
 * Legacy-exact resolution of the three settings every `Tgeneral.Create*Num`
 * function reads for its `...Type` suffix (see
 * `gates-backend/src/modules/platform/data/legacy-numbering-families.ts`).
 */
export interface LegacyNumberingPolicy {
  /** `SerialAutomatic{suffix}` — false ('M') means the user types the number by hand; caller should not auto-allocate. */
  automatic: boolean;
  /** `SerialContanious{suffix}` — true ('C', default) means one running sequence across fiscal years; false ('P') resets per year. */
  continuous: boolean;
  /** `SerialStart{suffix}` — default 1. */
  startNumber: number;
}

const MAX_SEQUENCE_RETRIES = 8;

function sequenceWhere(input: NextDocumentNumberInput, fiscalYearId: string | null) {
  return {
    companyId: input.companyId,
    branchId: input.branchId,
    fiscalYearId,
    docType: input.docType,
  };
}

/**
 * Transient, retry-safe failures from `nextNumberInTx`: our own 409 (a
 * caught unique-constraint race), Prisma's own write-conflict code
 * (`P2034`), and raw InnoDB deadlocks/lock-wait timeouts (MySQL error 1213 /
 * 1205) surfacing through the `$queryRaw` locking read as `P2010`. Under
 * heavy concurrent *first-creation* of a brand-new sequence row (many
 * transactions racing to `INSERT` the same unique key), MySQL can legitimately
 * deadlock two or more of them — the documented, expected remedy is simply to
 * retry the losing transaction.
 */
function isRetryableSequenceError(err: unknown): boolean {
  if (err instanceof AppError && err.statusCode === 409) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034') return true;
    if (err.code === 'P2010' && /deadlock found|lock wait timeout/i.test(err.message)) return true;
    // A deadlock detected on an earlier statement in this same interactive
    // transaction causes MySQL to roll the whole transaction back; a later
    // `update()` in that doomed transaction then reports its target row as
    // missing even though nothing in this codebase ever deletes
    // `document_sequences` rows. Treat it as the same transient condition.
    if (err.code === 'P2025') return true;
  }
  return false;
}

export class DocumentSequenceService {
  /**
   * Allocate the next number inside an existing Prisma transaction, locking
   * the sequence row (`SELECT … FOR UPDATE`) so concurrent posters cannot
   * issue the same serial.
   */
  async nextNumberInTx(
    tx: Prisma.TransactionClient,
    input: NextDocumentNumberInput
  ): Promise<string> {
    const scope = input.scope ?? (input.fiscalYearId ? 'Y' : 'C');
    const fiscalYearId = scope === 'C' ? null : input.fiscalYearId;
    const padding = input.padding ?? 8;
    const startNumber = input.startNumber ?? 1;
    const where = sequenceWhere(input, fiscalYearId);

    let seq = await tx.documentSequence.findFirst({ where, select: { id: true } });

    if (!seq) {
      const existingMax = input.seedFromExisting ? await input.seedFromExisting() : 0;
      try {
        seq = await tx.documentSequence.create({
          data: {
            companyId: input.companyId,
            branchId: input.branchId,
            fiscalYearId,
            docType: input.docType,
            scope,
            lastNumber: Math.max(startNumber - 1, existingMax, 0),
            padding,
          },
          select: { id: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Same stale-snapshot hazard as the locked read further down: by
          // the time this P2002 fires, the winning transaction's `create()`
          // has already committed (MySQL only raises the duplicate-key
          // error once the conflicting row exists), but a plain
          // `findFirst` here would still be bound to *this* transaction's
          // original consistent-read snapshot and could come back empty —
          // which is exactly what caused ~75% of concurrent callers to fail
          // with "Failed to initialize document sequence" once the
          // duplicate-number bug below was fixed and this became the next
          // bottleneck. A locking, NULL-safe (`<=>`) raw read always
          // reflects the latest committed row, snapshot or not.
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM document_sequences
            WHERE companyId <=> ${input.companyId}
              AND branchId <=> ${input.branchId}
              AND fiscalYearId <=> ${fiscalYearId}
              AND docType <=> ${input.docType}
            FOR UPDATE
          `;
          seq = rows[0] ?? null;
        } else {
          throw err;
        }
      }
    }

    if (!seq) {
      throw new AppError(500, 'Failed to initialize document sequence');
    }

    // P0 fix: this used to acquire the row lock with a raw `SELECT id ...
    // FOR UPDATE` and then read `lastNumber`/`padding` via a *separate*
    // `tx.documentSequence.findUnique(...)` (a plain, non-locking SELECT).
    // Under MySQL's default REPEATABLE READ isolation, that second read
    // reused this transaction's consistent-read snapshot — established back
    // at the very first plain SELECT in this function (the `findFirst`
    // above) — so it could return `lastNumber` as it was *before* this
    // transaction even started, completely ignoring the lock it had just
    // acquired. Under concurrency this handed out the same number to every
    // waiter that queued behind the lock (`1, 2, 2, 2, 2, ...` instead of
    // `1, 2, 3, 4, 5, ...`), confirmed by scripts/erp-paranoia-audit.ts.
    //
    // The fix: read `lastNumber`/`padding` directly out of the `FOR UPDATE`
    // locking read's own result set. A locking read always returns the
    // latest *committed* row state regardless of the transaction's
    // snapshot — that's the entire point of `FOR UPDATE` — so there is no
    // second, snapshot-bound read left in the critical path at all.
    const lockedRows = await tx.$queryRaw<Array<{ lastNumber: number; padding: number }>>`
      SELECT lastNumber, padding FROM document_sequences WHERE id = ${seq.id} FOR UPDATE
    `;
    const locked = lockedRows[0];
    if (!locked) {
      throw new AppError(500, 'Document sequence disappeared under lock');
    }

    const lockedPadding = Number(locked.padding);
    let next = Number(locked.lastNumber) + 1;
    let candidate = String(next).padStart(lockedPadding, '0');

    if (input.isAvailable) {
      let skips = 0;
      while (!(await input.isAvailable(candidate))) {
        if (++skips > MAX_SEQUENCE_SKIPS) {
          throw new AppError(
            409,
            `Could not find a free ${input.docType} number after ${MAX_SEQUENCE_SKIPS} attempts`
          );
        }
        next += 1;
        candidate = String(next).padStart(lockedPadding, '0');
      }
    }

    await tx.documentSequence.update({
      where: { id: seq.id },
      data: { lastNumber: next },
    });

    return candidate;
  }

  /**
   * Returns the next legacy-style document number (e.g. GLNum `00000001`).
   * Retries on sequence conflicts when called outside a larger transaction.
   */
  async nextNumber(input: NextDocumentNumberInput): Promise<string> {
    for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => this.nextNumberInTx(tx, input));
      } catch (err) {
        if (isRetryableSequenceError(err) && attempt < MAX_SEQUENCE_RETRIES - 1) {
          logger.warn(
            { attempt, docType: input.docType, companyId: input.companyId, err: (err as Error).message },
            'Document sequence retry'
          );
          // Small randomized backoff so a burst of simultaneous retries (e.g.
          // many callers racing to create the same brand-new sequence row)
          // doesn't immediately re-collide and deadlock again on the retry.
          await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 40));
          continue;
        }
        throw err;
      }
    }

    throw new AppError(409, 'Could not allocate document number');
  }

  /**
   * Legacy-exact resolution of `SerialStart{suffix}` / `SerialAutomatic{suffix}`
   * / `SerialContanious{suffix}` for one of the ~18 `Tgeneral.Create*Num`
   * families (`legacy-numbering-families.ts`). `legacySuffix` is the
   * concrete per-document-type code legacy appends to each key (e.g.
   * `'GL01'`, `'SI01'`, a `NewModule` code).
   */
  async resolveLegacyNumberingPolicy(
    companyId: string,
    legacySuffix: string
  ): Promise<LegacyNumberingPolicy> {
    const [automaticRaw, continuousRaw, startRaw] = await Promise.all([
      companySettingService.getEntry(companyId, `SerialAutomatic${legacySuffix}`),
      companySettingService.getEntry(companyId, `SerialContanious${legacySuffix}`),
      companySettingService.getEntry(companyId, `SerialStart${legacySuffix}`),
    ]);
    const parsedStart = startRaw ? parseInt(startRaw, 10) : NaN;
    return {
      automatic: automaticRaw !== 'M',
      continuous: continuousRaw !== 'P',
      startNumber: Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1,
    };
  }

  /**
   * Settings-driven allocation for a registered numbering family: resolves
   * the legacy policy for `legacySuffix` and, when automatic, allocates the
   * next number with the resolved scope/start value. Returns `undefined`
   * when the family is set to manual entry (`SerialAutomatic{suffix}='M'`)
   * — the caller must fall back to a user-supplied number in that case,
   * exactly like every legacy screen's `if SerialAutomatic='A' then ... else ...`.
   */
  async nextNumberForFamilyInTx(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      branchId: string | null;
      fiscalYearId: string | null;
      docType: string;
      legacySuffix: string;
      padding?: number;
      seedFromExisting?: () => Promise<number>;
      isAvailable?: (candidate: string) => Promise<boolean>;
      policyOverride?: Partial<LegacyNumberingPolicy>;
    }
  ): Promise<string | undefined> {
    const resolved = await this.resolveLegacyNumberingPolicy(input.companyId, input.legacySuffix);
    const policy = { ...resolved, ...input.policyOverride };
    if (!policy.automatic) return undefined;
    return this.nextNumberInTx(tx, {
      companyId: input.companyId,
      branchId: input.branchId,
      fiscalYearId: input.fiscalYearId,
      docType: input.docType,
      scope: policy.continuous ? 'C' : 'Y',
      padding: input.padding,
      startNumber: policy.startNumber,
      seedFromExisting: input.seedFromExisting,
      isAvailable: input.isAvailable,
    });
  }

  /** Non-transactional counterpart of `nextNumberForFamilyInTx`, retry-safe like `nextNumber`. */
  async nextNumberForFamily(input: {
    companyId: string;
    branchId: string | null;
    fiscalYearId: string | null;
    docType: string;
    legacySuffix: string;
    padding?: number;
    seedFromExisting?: () => Promise<number>;
    isAvailable?: (candidate: string) => Promise<boolean>;
  }): Promise<string | undefined> {
    const policy = await this.resolveLegacyNumberingPolicy(input.companyId, input.legacySuffix);
    if (!policy.automatic) return undefined;
    return this.nextNumber({
      companyId: input.companyId,
      branchId: input.branchId,
      fiscalYearId: input.fiscalYearId,
      docType: input.docType,
      scope: policy.continuous ? 'C' : 'Y',
      padding: input.padding,
      startNumber: policy.startNumber,
      seedFromExisting: input.seedFromExisting,
      isAvailable: input.isAvailable,
    });
  }

  /**
   * Builds a `seedFromExisting` resolver over an existing numeric-string
   * column, for docTypes adopted after their table already held documents.
   * Ignores rows whose value isn't a plain number (hand-typed references like
   * `INV-2024-A`), since those never belonged to a running series.
   */
  maxExistingNumber(
    load: () => Promise<(string | null)[]>
  ): () => Promise<number> {
    return async () => {
      const values = await load();
      let max = 0;
      for (const value of values) {
        const trimmed = value?.trim();
        if (!trimmed || !/^\d+$/.test(trimmed)) continue;
        const parsed = Number(trimmed);
        if (Number.isSafeInteger(parsed) && parsed > max) max = parsed;
      }
      return max;
    };
  }

  /**
   * Resolves the three GL keys. Kept on the exact `SerialAutomaticGL` /
   * `SerialGL` / `SerialStartGL` names and default polarity that were already
   * live across every posting service — changing either would silently
   * re-scope every tenant's existing GL sequence — rather than the generic
   * `Serial*{suffix}` shape `resolveLegacyNumberingPolicy` expects.
   */
  private async resolveGlPolicy(companyId: string): Promise<LegacyNumberingPolicy> {
    const [serialScope, serialGl, serialStartGl] = await Promise.all([
      companySettingService.getEntry(companyId, 'SerialAutomaticGL'),
      companySettingService.getEntry(companyId, 'SerialGL'),
      companySettingService.getEntry(companyId, 'SerialStartGL'),
    ]);
    const parsedStart = serialStartGl ? parseInt(serialStartGl, 10) : NaN;
    return {
      automatic: serialScope !== 'M',
      // Note the polarity difference from the generic families: GL is
      // per-year unless `SerialGL` is explicitly `'C'`.
      continuous: serialGl === 'C',
      startNumber: Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1,
    };
  }

  /**
   * Manual mode (`SerialAutomaticGL='M'`) is the caller's cue to use a
   * user-entered number, exactly like legacy's
   * `if SerialAutomatic='A' then GLNum := CreateGlNum else <user typed>`
   * (message 81 when the user left it blank). Every GL call site used to
   * ignore the `undefined` this returned and persist a NULL `legacyGlNum`
   * instead, leaving those tenants' vouchers unnumbered and silently
   * unreconcilable — so an unsatisfiable manual mode now fails loudly.
   */
  private manualGlNumberOrThrow(manualNumber?: string | null): string {
    const trimmed = manualNumber?.trim();
    if (trimmed) return trimmed;
    throw new AppError(
      422,
      'رقم القيد مطلوب — ترقيم القيود يدوي لهذه الشركة (SerialAutomaticGL = M)'
    );
  }

  /** Preview the next GL serial without consuming the sequence. */
  async peekNextGlNumber(ctx: {
    companyId: string;
    branchId: string;
    fiscalYearId?: string | null;
  }): Promise<{ automatic: boolean; number: string }> {
    const policy = await this.resolveGlPolicy(ctx.companyId);
    const fiscalYearId = policy.continuous ? null : (ctx.fiscalYearId ?? null);
    const seq = await prisma.documentSequence.findFirst({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId,
        docType: 'GL',
      },
      select: { lastNumber: true, padding: true },
    });
    const padding = seq?.padding ?? 8;
    const next = seq ? Number(seq.lastNumber) + 1 : policy.startNumber;
    return {
      automatic: policy.automatic,
      number: String(next).padStart(padding, '0'),
    };
  }

  /** GL-family convenience wrapper used by every posting path. */
  async nextGlNumberInTx(
    tx: Prisma.TransactionClient,
    ctx: { companyId: string; branchId: string; fiscalYearId?: string | null },
    manualNumber?: string | null,
    options?: { forceAutomatic?: boolean }
  ): Promise<string> {
    const policy = await this.resolveGlPolicy(ctx.companyId);
    if (!policy.automatic && !options?.forceAutomatic) {
      return this.manualGlNumberOrThrow(manualNumber);
    }

    return this.nextNumberInTx(tx, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: policy.continuous ? null : (ctx.fiscalYearId ?? null),
      docType: 'GL',
      scope: policy.continuous ? 'C' : 'Y',
      startNumber: policy.startNumber,
    });
  }

  /** Non-transactional counterpart of `nextGlNumberInTx`, retry-safe like `nextNumber`. */
  async nextGlNumber(
    ctx: {
      companyId: string;
      branchId: string;
      fiscalYearId?: string | null;
    },
    manualNumber?: string | null,
    options?: { forceAutomatic?: boolean }
  ): Promise<string> {
    const policy = await this.resolveGlPolicy(ctx.companyId);
    if (!policy.automatic && !options?.forceAutomatic) {
      return this.manualGlNumberOrThrow(manualNumber);
    }

    return this.nextNumber({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: policy.continuous ? null : (ctx.fiscalYearId ?? null),
      docType: 'GL',
      scope: policy.continuous ? 'C' : 'Y',
      startNumber: policy.startNumber,
    });
  }
}

export const documentSequenceService = new DocumentSequenceService();
