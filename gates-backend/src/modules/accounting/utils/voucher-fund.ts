import prisma from '../../../shared/database/prisma';

export type VoucherFund = 'bank' | 'cash';

/** Cash voucher journals store the cash-transaction id in sourceId. Bank notices use a bank account. */
export async function voucherFundBySourceId(
  companyId: string,
  sourceIds: Array<string | null | undefined>
): Promise<Map<string, VoucherFund>> {
  const ids = [...new Set(sourceIds.filter((id): id is string => Boolean(id)))];
  const funds = new Map<string, VoucherFund>();
  if (!ids.length) return funds;
  const cashRows = await prisma.cashTransaction.findMany({
    where: {
      companyId,
      OR: [
        { id: { in: ids } },
        { treasuryReceiptId: { in: ids } },
        { treasuryPaymentId: { in: ids } },
      ],
    },
    select: {
      id: true,
      bankAccountId: true,
      treasuryReceiptId: true,
      treasuryPaymentId: true,
    },
  });
  const mark = (id: string | null | undefined, fund: VoucherFund) => {
    if (id) funds.set(id, fund);
  };
  for (const row of cashRows) {
    const fund: VoucherFund = row.bankAccountId ? 'bank' : 'cash';
    mark(row.id, fund);
    mark(row.treasuryReceiptId, fund);
    mark(row.treasuryPaymentId, fund);
  }

  const missing = ids.filter((id) => !funds.has(id));
  if (!missing.length) return funds;
  const [receipts, payments] = await Promise.all([
    prisma.treasuryReceipt.findMany({
      where: { companyId, id: { in: missing } },
      select: { id: true, bankAccountId: true, voucherFamily: true },
    }),
    prisma.treasuryPayment.findMany({
      where: { companyId, id: { in: missing } },
      select: { id: true, bankAccountId: true, voucherFamily: true },
    }),
  ]);
  for (const row of [...receipts, ...payments]) {
    const bank =
      Boolean(row.bankAccountId) ||
      row.voucherFamily === 'BANK' ||
      row.voucherFamily === 'KP01' ||
      row.voucherFamily === 'KR01' ||
      row.voucherFamily === 'ORDPB' ||
      row.voucherFamily === 'ORDRB';
    funds.set(row.id, bank ? 'bank' : 'cash');
  }
  return funds;
}
