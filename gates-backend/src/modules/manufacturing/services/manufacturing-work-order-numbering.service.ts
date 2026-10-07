import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

const DOC_TYPE = 'MFG-WORK-ORDER';
const LEGACY_SUFFIX = 'WO01';
const SERIAL_PADDING = 6;

async function loadExistingOrderNumbers(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<(string | null)[]> {
  const rows = await tx.manufacturingWorkOrder.findMany({
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
  const row = await tx.manufacturingWorkOrder.findFirst({
    where: { companyId, orderNumber },
    select: { id: true },
  });
  return Boolean(row);
}

export async function peekManufacturingWorkOrderNextNumber(input: {
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

export async function resolveManufacturingWorkOrderNumberInTx(
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
    throw new AppError(500, 'تعذر توليد رقم أمر التشغيل');
  }
  return allocated;
}
