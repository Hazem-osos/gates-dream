import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { computeAdjustmentInvoiceAmount } from './invoice-adjustment.math';
import type { CreateM5InvoiceInput } from '../schemas/invoice-m5.schema';

type AdjustmentInput = NonNullable<CreateM5InvoiceInput['adjustments']>[number];

export async function replaceInvoiceAdjustmentsInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    invoiceId: string;
    adjustments: AdjustmentInput[] | undefined;
    baseSubtotal: number;
    invoiceExchangeRate: number;
  }
) {
  if (params.adjustments === undefined) return;

  const rows = params.adjustments.filter((row) => String(row.accountId ?? '').trim());
  const accountIds = [
    ...new Set(
      rows.flatMap((row) => [row.accountId, row.offsetAccountId].filter((id): id is string => Boolean(id)))
    ),
  ];
  const costCenterIds = [...new Set(rows.map((row) => row.costCenterId).filter((id): id is string => Boolean(id)))];

  if (accountIds.length) {
    const found = await tx.account.findMany({
      where: { companyId: params.companyId, id: { in: accountIds } },
      select: { id: true },
    });
    if (found.length !== accountIds.length) {
      throw new AppError(422, 'حساب الإضافة أو الخصم غير موجود في دليل الحسابات');
    }
  }
  if (costCenterIds.length) {
    const found = await tx.costCenter.findMany({
      where: { companyId: params.companyId, id: { in: costCenterIds } },
      select: { id: true },
    });
    if (found.length !== costCenterIds.length) {
      throw new AppError(422, 'مركز التكلفة غير موجود');
    }
  }

  await tx.invoiceAdjustment.deleteMany({ where: { invoiceId: params.invoiceId } });
  if (!rows.length) return;

  await tx.invoiceAdjustment.createMany({
    data: rows.map((row) => {
      const computed = computeAdjustmentInvoiceAmount(
        row,
        params.baseSubtotal,
        params.invoiceExchangeRate
      );
      return {
        companyId: params.companyId,
        invoiceId: params.invoiceId,
        type: row.type,
        calcType: row.calcType,
        rate: row.calcType === 'PERCENTAGE' ? new Decimal(Number(row.rate) || 0) : null,
        amount: new Decimal(row.calcType === 'PERCENTAGE' ? computed : Math.max(0, Number(row.amount) || 0)),
        description: row.description?.trim() || null,
        currency: row.currency?.trim() || 'EGP',
        exchangeRate: row.exchangeRate != null ? new Decimal(row.exchangeRate) : null,
        accountId: row.accountId,
        offsetAccountId: row.offsetAccountId || null,
        costCenterId: row.costCenterId || null,
      };
    }),
  });
}
