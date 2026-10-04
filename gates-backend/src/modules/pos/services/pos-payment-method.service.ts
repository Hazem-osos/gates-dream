import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { PosSettlementType } from './pos-payment.service';

const BUILT_IN: Array<{ code: string; displayName: string; settlementType: PosSettlementType; sortOrder: number }> = [
  { code: 'CASH', displayName: 'نقدي', settlementType: 'CASH', sortOrder: 1 },
  { code: 'CARD', displayName: 'بطاقة', settlementType: 'BANK', sortOrder: 2 },
  { code: 'BANK', displayName: 'تحويل بنكي', settlementType: 'BANK', sortOrder: 3 },
  { code: 'WALLET', displayName: 'محفظة', settlementType: 'BANK', sortOrder: 4 },
  { code: 'CREDIT', displayName: 'آجل', settlementType: 'CREDIT', sortOrder: 5 },
];

export class PosPaymentMethodService {
  async list(
    companyId: string,
    scope?: { terminalId?: string; branchId?: string; activeOnly?: boolean }
  ) {
    const rows = await prisma.posPaymentMethod.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    });
    if (!rows.length) {
      return BUILT_IN.map((row) => ({ ...row, id: null, isActive: true, safeId: null, bankAccountId: null, branchId: null, terminalId: null, builtIn: true }));
    }
    return rows
      .filter((row) => (scope?.activeOnly ? row.isActive : true))
      .filter((row) => !scope?.terminalId || !row.terminalId || row.terminalId === scope.terminalId)
      .filter((row) => !scope?.branchId || !row.branchId || row.branchId === scope.branchId)
      .map((row) => ({ ...row, builtIn: false }));
  }

  async create(
    companyId: string,
    input: {
      code: string;
      displayName: string;
      settlementType: PosSettlementType;
      safeId?: string | null;
      bankAccountId?: string | null;
      branchId?: string | null;
      terminalId?: string | null;
      sortOrder?: number;
      captureMode?: 'MANUAL' | 'TERMINAL';
    }
  ) {
    if (!['CASH', 'BANK', 'CREDIT'].includes(input.settlementType)) {
      throw new AppError(422, 'POS payment settlement type is invalid');
    }
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,20}$/.test(code)) throw new AppError(422, 'POS payment method code is invalid');
    const captureMode = input.captureMode ?? 'MANUAL';
    await assertPaymentDestination(companyId, input.settlementType, input.safeId, input.bankAccountId, captureMode);
    await assertPaymentScope(companyId, input.branchId, input.terminalId);
    return prisma.posPaymentMethod.create({
      data: {
        companyId,
        code,
        displayName: input.displayName.trim(),
        settlementType: input.settlementType,
        safeId: input.settlementType === 'CASH' ? input.safeId ?? null : null,
        bankAccountId: input.settlementType === 'BANK' ? input.bankAccountId ?? null : null,
        branchId: input.branchId ?? null,
        terminalId: input.terminalId ?? null,
        sortOrder: input.sortOrder ?? 10,
        captureMode,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    input: {
      displayName?: string;
      isActive?: boolean;
      safeId?: string | null;
      bankAccountId?: string | null;
      branchId?: string | null;
      terminalId?: string | null;
      sortOrder?: number;
      captureMode?: 'MANUAL' | 'TERMINAL';
    }
  ) {
    const existing = await prisma.posPaymentMethod.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'POS payment method not found');
    const safeId = input.safeId === undefined ? existing.safeId : input.safeId;
    const bankAccountId = input.bankAccountId === undefined ? existing.bankAccountId : input.bankAccountId;
    const captureMode = input.captureMode ?? (existing.captureMode as 'MANUAL' | 'TERMINAL');
    await assertPaymentDestination(
      companyId,
      existing.settlementType as PosSettlementType,
      safeId,
      bankAccountId,
      captureMode
    );
    await assertPaymentScope(
      companyId,
      input.branchId === undefined ? existing.branchId : input.branchId,
      input.terminalId === undefined ? existing.terminalId : input.terminalId
    );
    return prisma.posPaymentMethod.update({
      where: { id },
      data: {
        displayName: input.displayName?.trim() || undefined,
        isActive: input.isActive,
        safeId: existing.settlementType === 'CASH' ? safeId : null,
        bankAccountId: existing.settlementType === 'BANK' ? bankAccountId : null,
        branchId: input.branchId,
        terminalId: input.terminalId,
        sortOrder: input.sortOrder,
        captureMode,
      },
    });
  }
}

async function assertPaymentDestination(
  companyId: string,
  settlementType: PosSettlementType,
  safeId: string | null | undefined,
  bankAccountId: string | null | undefined,
  captureMode: string
) {
  if (captureMode !== 'MANUAL' && captureMode !== 'TERMINAL') {
    throw new AppError(422, 'POS capture mode is invalid');
  }
  if (captureMode === 'TERMINAL' && settlementType !== 'BANK') {
    throw new AppError(422, 'Terminal capture is only valid for a bank settlement');
  }
  if (settlementType === 'CREDIT' && (safeId || bankAccountId)) {
    throw new AppError(422, 'Credit settlement does not take a safe or a bank');
  }
  if (settlementType === 'CASH') {
    if (!safeId) throw new AppError(422, 'Cash settlement needs a company safe');
    const safe = await prisma.safe.findFirst({ where: { id: safeId, companyId }, select: { glAccountId: true } });
    if (!safe?.glAccountId) throw new AppError(422, 'Cash settlement safe has no ledger account');
  }
  if (settlementType === 'BANK') {
    if (!bankAccountId) throw new AppError(422, 'Bank settlement needs a company bank account');
    const bank = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      select: { glAccountId: true },
    });
    if (!bank?.glAccountId) throw new AppError(422, 'Bank settlement account has no ledger account');
  }
}

async function assertPaymentScope(
  companyId: string,
  branchId: string | null | undefined,
  terminalId: string | null | undefined
) {
  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true } });
    if (!branch) throw new AppError(422, 'Payment method branch is not in this company');
  }
  if (terminalId) {
    const terminal = await prisma.posTerminal.findFirst({ where: { id: terminalId, companyId }, select: { id: true } });
    if (!terminal) throw new AppError(422, 'Payment method terminal is not in this company');
  }
}

export const posPaymentMethodService = new PosPaymentMethodService();
