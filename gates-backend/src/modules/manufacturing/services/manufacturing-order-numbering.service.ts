import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

const DOC_TYPE = 'PRODUCTION-ORDER';
const LEGACY_SUFFIX = 'MO01';
/** Plain numeric serial like legacy manufacturing orders (`000001`). */
const SERIAL_PADDING = 6;

async function loadExistingOrderNumbers(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<(string | null)[]> {
  const rows = await tx.productionOrder.findMany({
    where: { companyId },
    select: { orderNumber: true },
  });
  return rows.map((r) => r.orderNumber);
}

async function isOrderNumberTaken(
  tx: Prisma.TransactionClient,
  companyId: string,
  orderNumber: string
): Promise<boolean> {
  const row = await tx.productionOrder.findFirst({
    where: { companyId, orderNumber },
    select: { id: true },
  });
  return Boolean(row);
}

export async function peekManufacturingOrderNextNumber(input: {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
}) {
  return documentSequenceService.peekNextForFamily({
    companyId: input.companyId,
    branchId: input.branchId,
    fiscalYearId: input.fiscalYearId,
    docType: DOC_TYPE,
    legacySuffix: LEGACY_SUFFIX,
    padding: SERIAL_PADDING,
    seedFromExisting: documentSequenceService.maxExistingNumber(async () =>
      loadExistingOrderNumbers(prisma, input.companyId)
    ),
    isAvailable: async (candidate) =>
      !(await isOrderNumberTaken(prisma, input.companyId, candidate)),
  });
}

export async function resolveManufacturingOrderNumberInTx(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    branchId: string | null;
    fiscalYearId: string | null;
    clientSerial?: string | null;
  }
): Promise<string> {
  const trimmed = input.clientSerial?.trim() || '';

  const allocated =
    trimmed ||
    (await documentSequenceService.nextNumberForFamilyInTx(tx, {
      companyId: input.companyId,
      branchId: input.branchId,
      fiscalYearId: input.fiscalYearId,
      docType: DOC_TYPE,
      legacySuffix: LEGACY_SUFFIX,
      padding: SERIAL_PADDING,
      seedFromExisting: documentSequenceService.maxExistingNumber(async () =>
        loadExistingOrderNumbers(tx, input.companyId)
      ),
      isAvailable: async (candidate) =>
        !(await isOrderNumberTaken(tx, input.companyId, candidate)),
    }));

  if (!allocated) {
    throw new AppError(422, 'رقم أمر التصنيع مطلوب');
  }

  if (await isOrderNumberTaken(tx, input.companyId, allocated)) {
    throw new AppError(409, 'رقم أمر التصنيع مستخدم مسبقاً');
  }

  return allocated;
}
