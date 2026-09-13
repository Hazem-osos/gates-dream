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
   * Shows which units/properties are matched with which customers
   */
  async getUnitCustomerMatchingReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, propertyId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      // This would require Property and Reservation models
      // For now, we'll use invoices as a proxy for property-customer relationships
      const invoiceWhere: any = {
        companyId,
        invoiceType: 'sales',
      };

      if (customerId) {
        invoiceWhere.customerId = customerId;
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Group by customer and property (using warehouseId as property proxy)
      const matchingData = invoices.map((invoice) => {
        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          customerId: invoice.customerId,
          customerName: invoice.customer?.arabicName,
          propertyId: invoice.warehouseId, // Using warehouseId as property proxy
          propertyName: invoice.warehouseId, // Would be property name if Property model existed
          amount: Number(invoice.netAmount || 0),
          status: invoice.isPosted ? 'confirmed' : 'pending',
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = matchingData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalMatches: invoices.length,
          uniqueCustomers: new Set(invoices.map((i) => i.customerId)).size,
          uniqueProperties: new Set(invoices.map((i) => i.warehouseId).filter(Boolean)).size,
        },
        pagination: {
          page,
          limit,
          total: matchingData.length,
          totalPages: Math.ceil(matchingData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating unit customer matching report');
      throw error;
    }
  }

  /**
   * Get Unit Preview Report
   * Shows available and reserved units/properties
   */
  async getUnitPreviewReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, propertyId, status } = filters;
      const { page = 1, limit = 100 } = options;

      // This would require Property model
      // For now, using warehouses as property proxy
      const warehousesWhere: any = { companyId, isActive: true };
      if (propertyId) {
        warehousesWhere.id = propertyId;
      }

      const warehouses = await prisma.warehouse.findMany({
        where: warehousesWhere,
        include: {
          invoices: {
            where: {
              invoiceType: 'sales',
              isPosted: true,
            },
            include: {
              customer: {
                select: {
                  id: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      const unitData = warehouses.map((warehouse) => {
        const reservations = warehouse.invoices.length;
        const isReserved = reservations > 0;
        const reservedBy = warehouse.invoices[0]?.customer?.arabicName;

        return {
          propertyId: warehouse.id,
          propertyCode: warehouse.code,
          propertyName: warehouse.arabicName,
          address: warehouse.address,
          status: isReserved ? 'reserved' : 'available',
          reservedBy,
          reservationCount: reservations,
          lastReservation: warehouse.invoices[0]?.date,
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = unitData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalUnits: warehouses.length,
          available: unitData.filter((u) => u.status === 'available').length,
          reserved: unitData.filter((u) => u.status === 'reserved').length,
        },
        pagination: {
          page,
          limit,
          total: unitData.length,
          totalPages: Math.ceil(unitData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating unit preview report');
      throw error;
    }
  }

  /**
   * Get Customer Area Matching Report
   * Matches customers with properties based on area requirements
   */
  async getCustomerAreaMatchingReport(
    filters: RealEstateReportFilters,
    options: RealEstateReportOptions = {}
  ): Promise<RealEstateReportResult> {
    try {
      const { companyId, customerId, minArea, maxArea } = filters;
      const { page = 1, limit = 100 } = options;

      // Get customers
      const customersWhere: any = { companyId, isActive: true };
      if (customerId) {
        customersWhere.id = customerId;
      }

      const customers = await prisma.customer.findMany({
        where: customersWhere,
        include: {
          invoices: {
            where: {
              invoiceType: 'sales',
              isPosted: true,
            },
            include: {
              warehouse: {
                select: {
                  id: true,
                  arabicName: true,
                  address: true,
                },
              },
            },
          },
        },
      });

      // Match customers with properties based on area
      const matchingData = customers.flatMap((customer) => {
        return customer.invoices.map((invoice) => {
          // Area would come from Property model, using placeholder
          const propertyArea = 0; // Would be from Property.area if model existed

          return {
            customerId: customer.id,
            customerName: customer.arabicName,
            propertyId: invoice.warehouseId,
            propertyName: invoice.warehouse?.arabicName,
            propertyArea,
            matchesArea: !minArea || !maxArea || (propertyArea >= minArea && propertyArea <= maxArea),
            invoiceAmount: Number(invoice.netAmount || 0),
            date: invoice.date,
          };
        });
      });

      // Filter by area if specified
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

