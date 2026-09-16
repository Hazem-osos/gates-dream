import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { inventoryReportsService } from '../services/reports.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';
import { partyGroupFromQuery } from '../../accounting/services/party-group-filter';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);

// M15 fix: see accounting/routes/reports.routes.ts — range starts floor to
// UTC midnight, range ends/asOfDate/default-"today" ceil to the last
// instant of that UTC day so same-day filters include the whole day.
function parseRangeStart(value: unknown, field: string): Date {
  return startOfDayUtc(value, field);
}
function parseRangeEnd(value: unknown, field: string): Date {
  return endOfDayUtc(value, field);
}
function todayEndOfDayUtc(): Date {
  return endOfDayUtc(new Date().toISOString().split('T')[0], 'today');
}

/**
 * GET /api/v1/inventory/reports/sales
 * Get Sales Report
 */
async function getSalesReportHandler(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({
        status: 'error',
        message: 'معرّف الشركة مطلوب',
      });
    }

    if (!req.query.fromDate || !req.query.toDate) {
      return void res.status(400).json({
        status: 'error',
        message: 'يرجى اختيار تاريخ البداية والنهاية',
      });
    }

    const filters = {
      ...partyGroupFromQuery(req.query),
      companyId,
      fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
      toDate: parseRangeEnd(req.query.toDate, 'toDate'),
      warehouseId: req.query.warehouseId as string | undefined,
      customerId: req.query.customerId as string | undefined,
      delegateId: req.query.delegateId as string | undefined,
      branchId: req.query.branchId as string | undefined,
      itemId: req.query.itemId as string | undefined,
      costCenterId: req.query.costCenterId as string | undefined,
      currencyId: req.query.currencyId as string | undefined,
      sellerId: req.query.sellerId as string | undefined,
      unpaidOnly: req.query.unpaidOnly === 'true',
      fromInvoice: req.query.fromInvoice as string | undefined,
      toInvoice: req.query.toInvoice as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      profileId: req.query.profileId as string | undefined,
    };

    const options = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    };

    const result = await inventoryReportsService.getSalesReport(filters, options);

    return void res.json({
      status: 'success',
      data: result.data,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({ error }, 'Error getting sales report');
    return void res.status(500).json({
      status: 'error',
      message: 'تعذّر تحميل تقرير المبيعات',
    });
  }
}

router.get('/sales', authorize({ resource: 'report', action: 'view' }), getSalesReportHandler);
router.get(
  '/sales-reports',
  authorize({ resource: 'report', action: 'view' }),
  getSalesReportHandler
);

/**
 * GET /api/v1/inventory/reports/purchases
 * Get Purchase Report
 */
router.get(
  '/purchases',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        profileId: req.query.profileId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getPurchaseReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting purchase report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get purchase report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/sales-returns
 * Get Sales Returns Report
 */
router.get(
  '/sales-returns',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSalesReturnsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sales returns report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales returns report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/purchase-returns
 * Get Purchase Returns Report
 */
router.get(
  '/purchase-returns',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getPurchaseReturnsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting purchase returns report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get purchase returns report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/inventory
 * Get Inventory (Stock Status) Report
 */
router.get(
  '/inventory',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        warehouseId: req.query.warehouseId as string | undefined,
        itemId: req.query.itemId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await inventoryReportsService.getInventoryReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting inventory report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get inventory report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/item-movement
 * Get Item Movement Report
 */
router.get(
  '/item-movement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate || !req.query.itemId) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date, to date, and item ID are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getItemMovementReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item movement report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get item movement report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/customer-balances
 * Get Customer Balances Report
 */
router.get(
  '/customer-balances',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        asOfDate: req.query.asOfDate ? parseRangeEnd(req.query.asOfDate, 'asOfDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCustomerBalancesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer balances report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get customer balances report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/suppliers-balances
 * Get Suppliers Balances Report
 */
router.get(
  '/suppliers-balances',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        supplierId: req.query.supplierId as string | undefined,
        asOfDate: req.query.asOfDate ? parseRangeEnd(req.query.asOfDate, 'asOfDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSuppliersBalancesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting suppliers balances report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get suppliers balances report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/receivables-aging
 * Get Receivables Aging Report
 */
router.get(
  '/receivables-aging',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        asOfDate: req.query.asOfDate ? parseRangeEnd(req.query.asOfDate, 'asOfDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getReceivablesAgingReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting receivables aging report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get receivables aging report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/stock-profit
 * Get Stock Profit Report
 */
router.get(
  '/stock-profit',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getStockProfitReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting stock profit report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get stock profit report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/inventory-reports
 * Get Inventory Reports (Detailed)
 */
router.get(
  '/inventory-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        warehouseId: req.query.warehouseId as string | undefined,
        itemId: req.query.itemId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getInventoryReportsDetailed(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting inventory reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get inventory reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/stock-transfer
 * Get Stock Transfer Report
 */
router.get(
  '/stock-transfer',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getStockTransferReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting stock transfer report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get stock transfer report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/items-exceeding-order-limit
 * Get Items Exceeding Order Limit Report
 */
router.get(
  '/items-exceeding-order-limit',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getItemsExceedingOrderLimitReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting items exceeding order limit report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get items exceeding order limit report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/expiry-date
 * Get Expiry Date Report
 */
router.get(
  '/expiry-date',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'To date is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getExpiryDateReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting expiry date report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get expiry date report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/sales-and-returns-reports
 * Get Sales and Returns Reports (Combined)
 */
router.get(
  '/sales-and-returns-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        warehouseId: req.query.warehouseId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSalesAndReturnsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sales and returns reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales and returns reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/monthly-sales-for-items
 * Get Monthly Sales for Items Report
 */
router.get(
  '/monthly-sales-for-items',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getMonthlySalesForItemsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting monthly sales for items report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get monthly sales for items report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/customer-accounts-reports
 * Get Customer Accounts Reports (Detailed)
 */
router.get(
  '/customer-accounts-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCustomerAccountsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer accounts reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get customer accounts reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/customer-accounts-currency-reports
 * Get Customer Accounts Currency Reports
 */
router.get(
  '/customer-accounts-currency-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCustomerAccountsCurrencyReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer accounts currency reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get customer accounts currency reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/customer-account-items
 * Get Customer Account Items Report
 */
router.get(
  '/customer-account-items',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.customerId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Customer ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string,
        itemId: req.query.itemId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCustomerAccountItemsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer account items report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get customer account items report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/customer-receivables
 * Get Customer Receivables Report
 */
router.get(
  '/customer-receivables',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCustomerReceivablesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer receivables report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get customer receivables report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/supplier-accounts-reports
 * Get Supplier Accounts Reports
 */
router.get(
  '/supplier-accounts-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        supplierId: req.query.supplierId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSupplierAccountsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting supplier accounts reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get supplier accounts reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/supplier-accounts-currencies
 * Get Supplier Accounts Currencies Report
 */
router.get(
  '/supplier-accounts-currencies',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        supplierId: req.query.supplierId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSupplierAccountsCurrenciesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting supplier accounts currencies report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get supplier accounts currencies report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/supplier-account-items
 * Get Supplier Account Items Report
 */
router.get(
  '/supplier-account-items',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.supplierId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Supplier ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        supplierId: req.query.supplierId as string,
        itemId: req.query.itemId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSupplierAccountItemsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting supplier account items report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get supplier account items report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/overdue-payments
 * Get Overdue Payments Report
 */
router.get(
  '/overdue-payments',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getOverduePaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting overdue payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get overdue payments report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/collections-and-overdues
 * Get Collections and Overdues Report
 */
router.get(
  '/collections-and-overdues',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        customerId: req.query.customerId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCollectionsAndOverduesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting collections and overdues report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get collections and overdues report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/invoices-profit-reports
 * Get Invoices Profit Reports
 */
router.get(
  '/invoices-profit-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getInvoicesProfitReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting invoices profit reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get invoices profit reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/items-profit-reports
 * Get Items Profit Reports
 */
router.get(
  '/items-profit-reports',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getItemsProfitReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting items profit reports');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get items profit reports',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/sales-commissions-for-representatives
 * Get Sales Commissions for Representatives Report
 */
router.get(
  '/sales-commissions-for-representatives',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        delegateId: req.query.delegateId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSalesCommissionsForRepresentativesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sales commissions for representatives report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales commissions for representatives report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/representatives-commissions-values-account
 * Get Representatives Commissions Values Account Report
 */
router.get(
  '/representatives-commissions-values-account',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        delegateId: req.query.delegateId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getRepresentativesCommissionsValuesAccountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting representatives commissions values account report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get representatives commissions values account report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/representatives-commissions-quantities-account
 * Get Representatives Commissions Quantities Account Report
 */
router.get(
  '/representatives-commissions-quantities-account',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        delegateId: req.query.delegateId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getRepresentativesCommissionsQuantitiesAccountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting representatives commissions quantities account report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get representatives commissions quantities account report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/items-analytical-movement-on-representatives
 * Get Items Analytical Movement on Representatives Report
 */
router.get(
  '/items-analytical-movement-on-representatives',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        delegateId: req.query.delegateId as string | undefined,
        itemId: req.query.itemId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getItemsAnalyticalMovementOnRepresentativesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting items analytical movement on representatives report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get items analytical movement on representatives report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/detailed-invoice-movement
 * Get Detailed Invoice Movement Report
 */
router.get(
  '/detailed-invoice-movement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        invoiceId: req.query.invoiceId as string | undefined,
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getDetailedInvoiceMovementReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting detailed invoice movement report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get detailed invoice movement report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/cost-center-item-movement
 * Get Cost Center Item Movement Report
 */
router.get(
  '/cost-center-item-movement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getCostCenterItemMovementReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost center item movement report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost center item movement report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/price-list
 * Get Price List Report
 */
router.get(
  '/price-list',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        priceListId: req.query.priceListId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getPriceListReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting price list report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get price list report',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/reports/sales-and-purchase-tax
 * Get Sales and Purchase Tax Report
 */
router.get(
  '/sales-and-purchase-tax',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await inventoryReportsService.getSalesAndPurchaseTaxReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sales and purchase tax report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales and purchase tax report',
      });
    }
  }
);

export default router;

