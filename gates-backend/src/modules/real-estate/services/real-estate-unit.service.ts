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
    const projectCode = input.projectCode?.trim();
    const projectName = input.projectName?.trim();
    if (!projectCode) throw new AppError(400, 'كود المشروع مطلوب');
    if (!projectName) throw new AppError(400, 'اسم المشروع مطلوب');

    return prisma.realEstateProject.create({
      data: {
        companyId,
        projectCode,
        projectName,
        costCenterId: input.costCenterId || null,
      },
    });
  }

  async getProject(companyId: string, projectId: string) {
    const row = await prisma.realEstateProject.findFirst({
      where: { id: projectId, companyId },
      include: { buildings: { include: { units: true } } },
    });
    if (!row) throw new AppError(404, 'المشروع العقاري غير موجود');
    return row;
  }

  async updateProject(
    companyId: string,
    projectId: string,
    input: {
      projectCode?: string;
      projectName?: string;
      costCenterId?: string | null;
    }
  ) {
    await this.getProject(companyId, projectId);
    return prisma.realEstateProject.update({
      where: { id: projectId },
      data: {
        ...(input.projectCode !== undefined ? { projectCode: input.projectCode.trim() } : {}),
        ...(input.projectName !== undefined ? { projectName: input.projectName.trim() } : {}),
        ...(input.costCenterId !== undefined ? { costCenterId: input.costCenterId || null } : {}),
      },
    });
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
    const buildingCode = input.buildingCode?.trim();
    const name = input.name?.trim();
    if (!buildingCode) throw new AppError(400, 'كود المبنى مطلوب');
    if (!name) throw new AppError(400, 'اسم المبنى مطلوب');

    return prisma.realEstateBuilding.create({
      data: {
        projectId: input.projectId,
        buildingCode,
        name,
        totalFloors: input.totalFloors ?? 1,
      },
    });
  }

  async getBuilding(companyId: string, buildingId: string) {
    const row = await prisma.realEstateBuilding.findFirst({
      where: { id: buildingId, project: { companyId } },
      include: { units: true, project: true },
    });
    if (!row) throw new AppError(404, 'المبنى غير موجود');
    return row;
  }

  async listBuildings(companyId: string, filters: { projectId?: string } = {}) {
    return prisma.realEstateBuilding.findMany({
      where: {
        project: { companyId },
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        _count: { select: { units: true } },
      },
      orderBy: [{ project: { projectCode: 'asc' } }, { buildingCode: 'asc' }],
    });
  }

  async updateBuilding(
    companyId: string,
    buildingId: string,
    input: {
      buildingCode?: string;
      name?: string;
      totalFloors?: number;
      projectId?: string;
    }
  ) {
    await this.getBuilding(companyId, buildingId);
    if (input.projectId) {
      await this.getProject(companyId, input.projectId);
    }
    return prisma.realEstateBuilding.update({
      where: { id: buildingId },
      data: {
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.buildingCode !== undefined ? { buildingCode: input.buildingCode.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.totalFloors !== undefined ? { totalFloors: input.totalFloors } : {}),
      },
      include: { project: true },
    });
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
    if (!building) throw new AppError(404, 'المبنى غير موجود');

    const unitCode = input.unitCode?.trim();
    if (!unitCode) throw new AppError(400, 'كود الوحدة مطلوب');

    const gross = input.grossArea ?? 0;
    const meter = input.meterPrice ?? 0;
    const total =
      input.totalPrice ??
      (gross > 0 && meter > 0 ? gross * meter : input.totalPrice ?? 0);

    return prisma.realEstateUnit.create({
      data: {
        buildingId: input.buildingId,
        unitCode,
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
    if (!unit) throw new AppError(404, 'الوحدة غير موجودة');
    return unit;
  }

  async updateUnit(
    companyId: string,
    unitId: string,
    input: {
      buildingId?: string;
      unitCode?: string;
      unitType?: string;
      floor?: number;
      grossArea?: number;
      netArea?: number;
      meterPrice?: number;
      totalPrice?: number;
      maintenanceDeposit?: number;
    }
  ) {
    await this.getUnit(companyId, unitId);
    if (input.buildingId) {
      const building = await prisma.realEstateBuilding.findFirst({
        where: { id: input.buildingId, project: { companyId } },
      });
      if (!building) throw new AppError(404, 'المبنى غير موجود');
    }

    const data: Record<string, unknown> = {};
    if (input.buildingId !== undefined) data.buildingId = input.buildingId;
    if (input.unitCode !== undefined) data.unitCode = input.unitCode.trim();
    if (input.unitType !== undefined) data.unitType = input.unitType;
    if (input.floor !== undefined) data.floor = input.floor;
    if (input.grossArea !== undefined) data.grossArea = new Decimal(input.grossArea);
    if (input.netArea !== undefined) data.netArea = new Decimal(input.netArea);
    if (input.meterPrice !== undefined) data.meterPrice = new Decimal(input.meterPrice);
    if (input.totalPrice !== undefined) data.totalPrice = new Decimal(input.totalPrice);
    if (input.maintenanceDeposit !== undefined) {
      data.maintenanceDeposit = new Decimal(input.maintenanceDeposit);
    }

    return prisma.realEstateUnit.update({
      where: { id: unitId },
      data,
      include: { building: { include: { project: true } } },
    });
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
