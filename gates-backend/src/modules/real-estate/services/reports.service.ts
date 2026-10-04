// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface RealEstateReportFilters {
  companyId: string;
  customerId?: string;
  propertyId?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string;
  minArea?: number;
  maxArea?: number;
  [key: string]: any;
}

export interface RealEstateReportOptions {
  page?: number;
  limit?: number;
  includeDetails?: boolean;
  includeSummary?: boolean;
}

export interface RealEstateReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class RealEstateReportsService {
  /**
   * Get Customer Tracking Report
   * Tracks customer interactions and followups
   */
  async getCustomerTrackingReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, customerId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      // Get customers with their followup history
      const customersWhere: any = { companyId, isActive: true };
      if (customerId) {
        customersWhere.id = customerId;
      }

      const customers = await prisma.customer.findMany({
        where: customersWhere,
        include: {
          invoices: {
            where: {
              ...(fromDate || toDate
                ? {
                    date: {
                      ...(fromDate ? { gte: fromDate } : {}),
                      ...(toDate ? { lte: toDate } : {}),
                    },
                  }
                : {}),
            },
            orderBy: { date: 'desc' },
            take: 10, // Last 10 invoices
          },
        },
      });

      const trackingData = customers.map((customer) => {
        const totalInvoices = customer.invoices.length;
        const totalAmount = customer.invoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);
        const lastInteraction = customer.invoices[0]?.date || customer.createdAt;

        return {
          customerId: customer.id,
          customerCode: customer.code,
          customerName: customer.arabicName,
          totalInvoices,
          totalAmount,
          lastInteraction,
          status: totalInvoices > 0 ? 'active' : 'inactive',
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = trackingData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalCustomers: customers.length,
          activeCustomers: trackingData.filter((c) => c.status === 'active').length,
          inactiveCustomers: trackingData.filter((c) => c.status === 'inactive').length,
        },
        pagination: {
          page,
          limit,
          total: trackingData.length,
          totalPages: Math.ceil(trackingData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer tracking report');
      throw error;
    }
  }

  /**
   * Get Customer List Report
   * Comprehensive customer information report
   */
  async getCustomerListReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, customerId, status } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = { companyId };
      if (customerId) {
        where.id = customerId;
      }
      if (status) {
        where.isActive = status === 'active';
      }

      const skip = (page - 1) * limit;

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            invoices: {
              take: 5,
              orderBy: { date: 'desc' },
            },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      const customerData = customers.map((customer) => {
        const totalInvoices = customer.invoices.length;
        const totalAmount = customer.invoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);

        return {
          customerId: customer.id,
          customerCode: customer.code,
          customerName: customer.arabicName,
          englishName: customer.englishName,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          totalInvoices,
          totalAmount,
          status: customer.isActive ? 'active' : 'inactive',
          createdAt: customer.createdAt,
        };
      });

      return {
        data: customerData,
        summary: {
          totalCustomers: total,
          activeCustomers: customers.filter((c) => c.isActive).length,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer list report');
      throw error;
    }
  }

  /**
   * Get Unit Customer Matching Report
   * Shows which units are matched with which customers via unit contracts.
   */
  async getUnitCustomerMatchingReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, propertyId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: Record<string, unknown> = { companyId };
      if (customerId) where.customerId = customerId;
      if (propertyId) where.unitId = propertyId;

      const [contracts, total] = await Promise.all([
        prisma.unitContract.findMany({
          where,
          include: {
            customer: { select: { id: true, code: true, arabicName: true } },
            unit: {
              select: {
                id: true,
                unitCode: true,
                grossArea: true,
                netArea: true,
                status: true,
                building: {
                  select: {
                    name: true,
                    buildingCode: true,
                    project: { select: { projectCode: true, projectName: true } },
                  },
                },
              },
            },
          },
          orderBy: { contractDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.unitContract.count({ where }),
      ]);

      const matchingData = contracts.map((contract) => {
        const grossArea = Number(contract.unit?.grossArea ?? 0);
        const netArea = Number(contract.unit?.netArea ?? 0);
        return {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          date: contract.contractDate,
          customerId: contract.customerId,
          customerName: contract.customer?.arabicName,
          customerCode: contract.customer?.code,
          unitId: contract.unitId,
          unitCode: contract.unit?.unitCode,
          propertyId: contract.unitId,
          propertyName: contract.unit
            ? `${contract.unit.building?.project?.projectName ?? ''} — ${contract.unit.building?.name ?? ''} — ${contract.unit.unitCode}`
            : null,
          grossArea,
          netArea,
          area: grossArea || netArea,
          amount: Number(contract.totalContractAmount || 0),
          status: contract.status,
        };
      });

      return {
        data: matchingData,
        summary: {
          totalMatches: total,
          uniqueCustomers: new Set(matchingData.map((i) => i.customerId)).size,
          uniqueUnits: new Set(matchingData.map((i) => i.unitId)).size,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating unit customer matching report');
      throw error;
    }
  }

  /**
   * Get Unit Preview Report
   * Shows real estate units with area and status from RealEstateUnit.
   */
  async getUnitPreviewReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, propertyId, status } = filters;
      const { page = 1, limit = 100 } = options;

      const where: Record<string, unknown> = {
        building: { project: { companyId } },
      };
      if (propertyId) where.id = propertyId;
      if (status) where.status = status;

      const [units, total] = await Promise.all([
        prisma.realEstateUnit.findMany({
          where,
          include: {
            building: {
              select: {
                id: true,
                name: true,
                buildingCode: true,
                project: { select: { id: true, projectCode: true, projectName: true } },
              },
            },
          },
          orderBy: [{ building: { buildingCode: 'asc' } }, { unitCode: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.realEstateUnit.count({ where }),
      ]);

      const unitData = units.map((unit) => {
        const grossArea = Number(unit.grossArea ?? 0);
        const netArea = Number(unit.netArea ?? 0);
        return {
          unitId: unit.id,
          propertyId: unit.id,
          propertyCode: unit.unitCode,
          unitCode: unit.unitCode,
          propertyName: `${unit.building.project.projectName} — ${unit.building.name} — ${unit.unitCode}`,
          projectName: unit.building.project.projectName,
          buildingName: unit.building.name,
          floor: unit.floor,
          unitType: unit.unitType,
          status: unit.status,
          grossArea,
          netArea,
          area: grossArea || netArea,
          builtUpArea: grossArea,
          meterPrice: Number(unit.meterPrice ?? 0),
          totalPrice: Number(unit.totalPrice ?? 0),
        };
      });

      return {
        data: unitData,
        summary: {
          totalUnits: total,
          available: unitData.filter((u) => u.status === 'AVAILABLE').length,
          reserved: unitData.filter((u) => u.status === 'RESERVED').length,
          sold: unitData.filter((u) => u.status === 'SOLD' || u.status === 'DELIVERED').length,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating unit preview report');
      throw error;
    }
  }

  /**
   * Get Customer Area Matching Report
   * Matches customers with contracted units using real unit area fields.
   */
  async getCustomerAreaMatchingReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, customerId, minArea, maxArea } = filters;
      const { page = 1, limit = 100 } = options;

      const where: Record<string, unknown> = { companyId };
      if (customerId) where.customerId = customerId;

      const contracts = await prisma.unitContract.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, arabicName: true } },
          unit: {
            select: {
              id: true,
              unitCode: true,
              grossArea: true,
              netArea: true,
              building: {
                select: {
                  name: true,
                  project: { select: { projectName: true } },
                },
              },
            },
          },
        },
        orderBy: { contractDate: 'desc' },
      });

      const matchingData = contracts.map((contract) => {
        const grossArea = Number(contract.unit?.grossArea ?? 0);
        const netArea = Number(contract.unit?.netArea ?? 0);
        const propertyArea = grossArea || netArea;
        return {
          customerId: contract.customerId,
          customerName: contract.customer?.arabicName,
          customerCode: contract.customer?.code,
          unitId: contract.unitId,
          unitCode: contract.unit?.unitCode,
          propertyId: contract.unitId,
          propertyName: contract.unit
            ? `${contract.unit.building?.project?.projectName ?? ''} — ${contract.unit.building?.name ?? ''} — ${contract.unit.unitCode}`
            : null,
          propertyArea,
          grossArea,
          netArea,
          area: propertyArea,
          matchesArea:
            (!minArea || propertyArea >= minArea) && (!maxArea || propertyArea <= maxArea),
          contractAmount: Number(contract.totalContractAmount || 0),
          date: contract.contractDate,
        };
      });

      const filteredData = matchingData.filter((m) => {
        if (minArea && m.propertyArea < minArea) return false;
        if (maxArea && m.propertyArea > maxArea) return false;
        return true;
      });

      const skip = (page - 1) * limit;
      const paginatedData = filteredData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalMatches: filteredData.length,
          matchingArea: filteredData.filter((m) => m.matchesArea).length,
        },
        pagination: {
          page,
          limit,
          total: filteredData.length,
          totalPages: Math.ceil(filteredData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer area matching report');
      throw error;
    }
  }
}

export const realEstateReportsService = new RealEstateReportsService();

