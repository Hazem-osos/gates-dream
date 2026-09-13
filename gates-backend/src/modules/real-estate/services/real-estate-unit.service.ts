import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export class RealEstateUnitService {
  async createProject(
    companyId: string,
    input: {
      projectCode: string;
      projectName: string;
      costCenterId?: string;
    }
  ) {
    return prisma.realEstateProject.create({
      data: {
        companyId,
        projectCode: input.projectCode,
        projectName: input.projectName,
        costCenterId: input.costCenterId,
      },
    });
  }

  async getProject(companyId: string, projectId: string) {
    const row = await prisma.realEstateProject.findFirst({
      where: { id: projectId, companyId },
      include: { buildings: { include: { units: true } } },
    });
    if (!row) throw new AppError(404, 'Real estate project not found');
    return row;
  }

  async createBuilding(
    companyId: string,
    input: {
      projectId: string;
      buildingCode: string;
      name: string;
      totalFloors?: number;
    }
  ) {
    await this.getProject(companyId, input.projectId);
    return prisma.realEstateBuilding.create({
      data: {
        projectId: input.projectId,
        buildingCode: input.buildingCode,
        name: input.name,
        totalFloors: input.totalFloors ?? 1,
      },
    });
  }

  async getBuilding(companyId: string, buildingId: string) {
    const row = await prisma.realEstateBuilding.findFirst({
      where: { id: buildingId, project: { companyId } },
      include: { units: true, project: true },
    });
    if (!row) throw new AppError(404, 'Building not found');
    return row;
  }

  async createUnit(
    companyId: string,
    input: {
      buildingId: string;
      unitCode: string;
      unitType?: string;
      floor?: number;
      grossArea?: number;
      netArea?: number;
      meterPrice?: number;
      totalPrice?: number;
      maintenanceDeposit?: number;
    }
  ) {
    const building = await prisma.realEstateBuilding.findFirst({
      where: { id: input.buildingId, project: { companyId } },
    });
    if (!building) throw new AppError(404, 'Building not found');

    const gross = input.grossArea ?? 0;
    const meter = input.meterPrice ?? 0;
    const total =
      input.totalPrice ??
      (gross > 0 && meter > 0 ? gross * meter : input.totalPrice ?? 0);

    return prisma.realEstateUnit.create({
      data: {
        buildingId: input.buildingId,
        unitCode: input.unitCode,
        unitType: input.unitType ?? 'RESIDENTIAL',
        floor: input.floor ?? 0,
        grossArea: new Decimal(gross),
        netArea: new Decimal(input.netArea ?? gross),
        meterPrice: new Decimal(meter),
        totalPrice: new Decimal(total),
        maintenanceDeposit: new Decimal(input.maintenanceDeposit ?? 0),
        status: 'AVAILABLE',
      },
    });
  }

  async getUnit(companyId: string, unitId: string) {
    const unit = await prisma.realEstateUnit.findFirst({
      where: { id: unitId, building: { project: { companyId } } },
      include: { building: { include: { project: true } } },
    });
    if (!unit) throw new AppError(404, 'Unit not found');
    return unit;
  }

  async listProjects(companyId: string) {
    return prisma.realEstateProject.findMany({
      where: { companyId },
      include: { buildings: { select: { id: true, buildingCode: true, name: true } } },
      orderBy: { projectCode: 'asc' },
    });
  }

  /** Selection list for the sale screens: unit plus the building/project it belongs to. */
  async listUnits(
    companyId: string,
    filters: { projectId?: string; buildingId?: string; status?: string; limit?: number } = {}
  ) {
    return prisma.realEstateUnit.findMany({
      where: {
        building: {
          project: { companyId },
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
        },
        ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        building: {
          select: {
            id: true,
            buildingCode: true,
            name: true,
            project: { select: { id: true, projectCode: true, projectName: true } },
          },
        },
      },
      orderBy: [{ building: { buildingCode: 'asc' } }, { unitCode: 'asc' }],
      take: Math.min(filters.limit ?? 200, 500),
    });
  }

  async updateUnitStatus(
    companyId: string,
    unitId: string,
    status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DELIVERED'
  ) {
    await this.getUnit(companyId, unitId);
    return prisma.realEstateUnit.update({
      where: { id: unitId },
      data: { status },
    });
  }
}

export const realEstateUnitService = new RealEstateUnitService();
