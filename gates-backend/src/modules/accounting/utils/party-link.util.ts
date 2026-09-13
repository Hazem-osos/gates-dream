import prisma from '../../../shared/database/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';

type Db = Prisma.TransactionClient | typeof prisma;

export async function syncCustomerSupplierLink(
  db: Db,
  companyId: string,
  customerId: string,
  linkedSupplierId: string | null | undefined
) {
  if (linkedSupplierId === undefined) return;

  if (linkedSupplierId === null) {
    await db.supplier.updateMany({
      where: { companyId, linkedCustomerId: customerId },
      data: { linkedCustomerId: null },
    });
    return;
  }

  const supplier = await db.supplier.findFirst({
    where: { id: linkedSupplierId, companyId },
    select: { id: true, linkedCustomerId: true },
  });
  if (!supplier) {
    throw new AppError(422, 'Linked supplier not found');
  }
  if (supplier.linkedCustomerId && supplier.linkedCustomerId !== customerId) {
    throw new AppError(422, 'Supplier is already linked to another customer');
  }

  await db.supplier.updateMany({
    where: { companyId, linkedCustomerId: customerId, id: { not: linkedSupplierId } },
    data: { linkedCustomerId: null },
  });

  await db.supplier.update({
    where: { id: linkedSupplierId },
    data: { linkedCustomerId: customerId },
  });
}

export async function syncSupplierCustomerLink(
  db: Db,
  companyId: string,
  supplierId: string,
  linkedCustomerId: string | null | undefined
) {
  if (linkedCustomerId === undefined) return;

  if (linkedCustomerId === null) {
    await db.customer.updateMany({
      where: { companyId, linkedSupplierId: supplierId },
      data: { linkedSupplierId: null },
    });
    return;
  }

  const customer = await db.customer.findFirst({
    where: { id: linkedCustomerId, companyId },
    select: { id: true, linkedSupplierId: true },
  });
  if (!customer) {
    throw new AppError(422, 'Linked customer not found');
  }
  if (customer.linkedSupplierId && customer.linkedSupplierId !== supplierId) {
    throw new AppError(422, 'Customer is already linked to another supplier');
  }

  await db.customer.updateMany({
    where: { companyId, linkedSupplierId: supplierId, id: { not: linkedCustomerId } },
    data: { linkedSupplierId: null },
  });

  await db.customer.update({
    where: { id: linkedCustomerId },
    data: { linkedSupplierId: supplierId },
  });
}
