import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { getWarehouseBalance } from '../../inventory/services/adjust-stock-in-tx';

export interface CreatePosTerminalInput {
  branchId: string;
  warehouseId: string;
  safeId: string;
  bankAccountId?: string;
  defaultCustomerId?: string;
  name: string;
  deviceCode?: string;
}

export class PosTerminalService {
  async create(companyId: string, input: CreatePosTerminalInput) {
    return prisma.posTerminal.create({
      data: {
        companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        safeId: input.safeId,
        bankAccountId: input.bankAccountId,
        defaultCustomerId: input.defaultCustomerId,
        name: input.name,
        deviceCode: input.deviceCode,
      },
    });
  }

  async list(companyId: string) {
    return prisma.posTerminal.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getById(companyId: string, id: string) {
    const t = await prisma.posTerminal.findFirst({ where: { id, companyId } });
    if (!t) throw new AppError(404, 'POS terminal not found');
    return t;
  }

  async lookupItemByBarcode(companyId: string, barcode: string, warehouseId?: string) {
    const item = await prisma.item.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [{ serial: barcode }, { id: barcode }, { barcode }],
      },
      include: {
        units: { include: { unit: true }, where: { isBaseUnit: true }, take: 1 },
      },
    });
    if (!item) throw new AppError(404, 'Item not found for barcode');
    const base = item.units[0];
    if (!base) throw new AppError(422, 'Item has no base unit');

    const stock = warehouseId
      ? await getWarehouseBalance(prisma, companyId, item.id, warehouseId)
      : null;

    return {
      item,
      unitId: base.unitId,
      stock,
    };
  }
}

export const posTerminalService = new PosTerminalService();
