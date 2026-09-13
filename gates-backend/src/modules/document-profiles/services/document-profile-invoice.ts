import type { DocumentBaseType, DocumentProfile, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import type { CreateM5InvoiceInput } from '../../invoices/schemas/invoice-m5.schema';

const KIND_TO_BASE: Record<string, DocumentBaseType> = {
  SALE: 'SALES_INVOICE',
  SALE_RETURN: 'SALES_RETURN',
  PURCHASE: 'PURCHASE_INVOICE',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
};

export function assertProfileMatchesInvoiceKind(
  profile: Pick<DocumentProfile, 'baseType' | 'nameAr'>,
  invoiceKind: string
) {
  const expected = KIND_TO_BASE[invoiceKind];
  if (expected && profile.baseType !== expected) {
    throw new AppError(422, `نمط «${profile.nameAr}» لا يطابق نوع هذا المستند`);
  }
}

export function applyProfileLocks(params: {
  profile: DocumentProfile;
  warehouseId?: string | null;
  costCenterId?: string | null;
  paymentSplits?: CreateM5InvoiceInput['paymentSplits'];
}) {
  const { profile } = params;
  let warehouseId = params.warehouseId ?? undefined;
  let costCenterId = params.costCenterId ?? undefined;
  let paymentSplits = params.paymentSplits;

  if (profile.lockWarehouse && profile.defaultWarehouseId) {
    warehouseId = profile.defaultWarehouseId;
  } else if (!warehouseId && profile.defaultWarehouseId) {
    warehouseId = profile.defaultWarehouseId;
  }

  if (profile.lockCostCenter && profile.defaultCostCenterId) {
    costCenterId = profile.defaultCostCenterId;
  } else if (!costCenterId && profile.defaultCostCenterId) {
    costCenterId = profile.defaultCostCenterId;
  }

  if (profile.lockTreasury && profile.defaultTreasuryId && Array.isArray(paymentSplits)) {
    paymentSplits = paymentSplits.map((split) =>
      split && typeof split === 'object' && 'type' in split && split.type === 'CASH'
        ? { ...split, safeId: profile.defaultTreasuryId as string }
        : split
    );
  }

  return { warehouseId, costCenterId, paymentSplits };
}

export async function nextProfileInvoiceNumber(
  tx: Prisma.TransactionClient,
  profileId: string
): Promise<string> {
  const updated = await tx.documentProfile.update({
    where: { id: profileId },
    data: { nextNumber: { increment: 1 } },
  });
  const used = Math.max(1, updated.nextNumber - 1);
  return `${updated.prefix ?? ''}${String(used).padStart(4, '0')}`;
}
