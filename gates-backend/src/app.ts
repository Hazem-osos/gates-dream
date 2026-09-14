import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { buildCorsOptions } from './shared/config/cors-options';
import cookieParser from 'cookie-parser';
import { errorHandler } from './shared/middleware/error-handler';
import { requestLogger } from './shared/middleware/request-logger';
import { cache } from './shared/cache/cache.middleware';
import { apiRateLimiter } from './shared/middleware/rate-limit.middleware';
import { sanitize, preventSQLInjection, preventXSS } from './shared/middleware/sanitize.middleware';
import { apiAuthGate } from './shared/middleware/api-auth-mode.middleware';
import { setTenantContext } from './shared/middleware/tenant.middleware';
import { tenantAndFiscalContextMiddleware } from './shared/middleware/tenant-fiscal-context.middleware';
import { enforceBranchScope } from './shared/middleware/branch-scope.middleware';
import { logger } from './shared/logger';
import { metricsCollector } from './shared/monitoring/metrics';

// Import module routes
import inventoryRoutes from './modules/inventory/routes/item.routes';
import unitRoutes from './modules/inventory/routes/unit.routes';
import warehouseRoutes from './modules/inventory/routes/warehouse.routes';
import invoiceRoutes from './modules/inventory/routes/invoice.routes';
import itemQuantityRoutes from './modules/inventory/routes/item-quantity.routes';
import locationRoutes from './modules/inventory/routes/location.routes';
import openingStockRoutes from './modules/inventory/routes/opening-stock.routes';
import stocktakingRoutes from './modules/inventory/routes/stocktaking.routes';
import transferRoutes from './modules/inventory/routes/transfer.routes';
import assemblyRoutes from './modules/inventory/routes/assembly.routes';
import disassemblyRoutes from './modules/inventory/routes/disassembly.routes';
import receiptRoutes from './modules/inventory/routes/receipt.routes';
import issueRoutes from './modules/inventory/routes/issue.routes';
import adjustmentRoutes from './modules/inventory/routes/adjustment.routes';
import otherAdjustmentRoutes from './modules/inventory/routes/other-adjustment.routes';
import landedCostRoutes from './modules/inventory/routes/landed-cost.routes';
import purchaseOrderRoutes from './modules/inventory/routes/purchase-order.routes';
import purchaseReturnRoutes from './modules/inventory/routes/purchase-return.routes';
import priceQuoteRoutes from './modules/inventory/routes/price-quote.routes';
import itemOfferRoutes from './modules/inventory/routes/item-offer.routes';
import priceListRoutes from './modules/inventory/routes/price-list.routes';
import itemPriceRoutes from './modules/inventory/routes/item-price.routes';
import itemUnitRoutes from './modules/inventory/routes/item-unit.routes';
import itemCategoryRoutes from './modules/inventory/routes/item-category.routes';
import otherAdditionDiscountTypeRoutes from './modules/inventory/routes/other-addition-discount-type.routes';
import representativeCommissionQuantityRoutes from './modules/inventory/routes/representative-commission-quantity.routes';
import representativeCommissionValueRoutes from './modules/inventory/routes/representative-commission-value.routes';
import representativeCommissionPolicyRoutes from './modules/inventory/routes/representative-commission-policy.routes';
import itemOrderLimitRoutes from './modules/inventory/routes/item-order-limit.routes';
import customerContractRoutes from './modules/inventory/routes/customer-contract.routes';
import clothingMatrixRoutes from './modules/inventory/routes/clothing-matrix.routes';
import inventoryReportsRoutes from './modules/inventory/routes/reports.routes';
import inventoryWave0Routes from './modules/inventory/routes/inventory-wave0.routes';
import demoRoutes from './modules/demo/routes/demo.routes';
import accountRoutes, {
  chartOfAccountsAliasRouter,
} from './modules/accounting/routes/account.routes';
import accountingSettingsRoutes from './modules/accounting/settings/accounting-settings.routes';
import costCenterRoutes from './modules/accounting/routes/cost-center.routes';
import customerRoutes from './modules/accounting/routes/customer.routes';
import customerInsightsRoutes from './modules/accounting/routes/customer-insights.routes';
import partiesRoutes from './modules/accounting/routes/parties.routes';
import supplierRoutes from './modules/accounting/routes/supplier.routes';
import delegateRoutes from './modules/accounting/routes/delegate.routes';
import distributorRoutes from './modules/accounting/routes/distributor.routes';
import driverRoutes from './modules/accounting/routes/driver.routes';
import partyMastersRoutes from './modules/accounting/routes/party-masters.routes';
import counterpartyOffsetRoutes from './modules/accounting/routes/counterparty-offset.routes';
import currencyRoutes from './modules/accounting/routes/currency.routes';
import periodRoutes from './modules/accounting/routes/period.routes';
import journalEntryRoutes from './modules/accounting/routes/journal-entry.routes';
import openingBalanceRoutes from './modules/accounting/routes/opening-balance.routes';
import recurringEntriesController from './modules/accounting/recurring-entries.controller';
import accountMovementRoutes from './modules/accounting/routes/account-movement.routes';
import costCenterMovementRoutes from './modules/accounting/routes/cost-center-movement.routes';
import bankRoutes from './modules/accounting/routes/bank.routes';
import safeRoutes from './modules/accounting/routes/safe.routes';
import bankAccountRoutes from './modules/accounting/routes/bank-account.routes';
import treasuryReceiptRoutes from './modules/accounting/routes/treasury-receipt.routes';
import treasuryPaymentRoutes from './modules/accounting/routes/treasury-payment.routes';
import securitiesReceiptRoutes from './modules/accounting/routes/securities-receipt.routes';
import securitiesPaymentRoutes from './modules/accounting/routes/securities-payment.routes';
import securitiesRenewalRoutes from './modules/accounting/routes/securities-renewal.routes';
import employeeRoutes from './modules/hr/routes/employee.routes';
import nationalityRoutes from './modules/hr/routes/nationality.routes';
import payrollRoutes from './modules/hr/routes/payroll.routes';
import religionRoutes from './modules/hr/routes/religion.routes';
import maritalStatusRoutes from './modules/hr/routes/marital-status.routes';
import jobTitleRoutes from './modules/hr/routes/job-title.routes';
import jobCadreRoutes from './modules/hr/routes/job-cadre.routes';
import departmentRoutes from './modules/hr/routes/department.routes';
import cityRoutes from './modules/hr/routes/city.routes';
import wagePolicyRoutes from './modules/hr/routes/wage-policy.routes';
import allowanceRoutes from './modules/hr/routes/allowance.routes';
import deductionRoutes from './modules/hr/routes/deduction.routes';
import employeeContractRoutes from './modules/hr/routes/employee-contract.routes';
import employeeProcedureRoutes from './modules/hr/routes/employee-procedure.routes';
import employeeAdvanceRoutes from './modules/hr/routes/employee-advance.routes';
import monthlySalaryRoutes from './modules/hr/routes/monthly-salary.routes';
import hrReportsRoutes from './modules/hr/routes/reports.routes';
import leaveEntitlementsRoutes from './modules/hr/routes/leave-entitlements.routes';
import eosClearanceRoutes from './modules/hr/routes/eos-clearance.routes';
import housingAllowanceRoutes from './modules/hr/routes/housing-allowance.routes';
import hrSettingsRoutes from './modules/hr/routes/hr-settings.routes';
import payrollRunRoutes from './modules/hr/routes/payroll-run.routes';
import hrAdvancesRoutes from './modules/hr/routes/advances.routes';
import financialReportsRoutes from './modules/accounting/routes/financial-reports.routes';
import reconciliationRoutes from './modules/accounting/routes/reconciliation.routes';
import approvalRoutes from './modules/accounting/routes/approval.routes';
import documentAuditRoutes from './modules/common/routes/document-audit.routes';
import documentRoutes from './modules/common/routes/document.routes';
import analyticsRoutes from './modules/analytics/routes/analytics.routes';
import executiveRoutes from './modules/analytics/routes/executive.routes';
import growthRoutes from './modules/growth/routes/growth.routes';
import aiRoutes from './modules/ai';
import { authenticatedShareRouter, publicShareRouter } from './modules/share/share.routes';
import wave4OperationsRoutes from './modules/operations/routes/operations.routes';
import archiveRoutes from './modules/archive/routes/archive.routes';
import attachmentRoutes from './modules/archive/routes/attachment.routes';
import documentLayoutRoutes from './modules/document-layout/routes/document-layout.routes';
import subscriptionRoutes from './modules/platform/routes/subscription.routes';
import newModuleRoutes from './modules/platform/routes/new-module.routes';
import documentProfileRoutes from './modules/document-profiles/routes/document-profile.routes';
import transactionSettingsRoutes from './modules/transaction-settings/transaction-settings.routes';
import companySettingRoutes from './modules/platform/routes/company-setting.routes';
import { licenseRouteGate } from './modules/platform/middleware/tenant-module-guard.middleware';
import reportsRoutes from './modules/accounting/routes/reports.routes';
import sensorRoutes from './modules/manufacturing/routes/sensors.routes';
import manufacturingReportsRoutes from './modules/manufacturing/routes/reports.routes';
import mfgWave3Routes from './modules/manufacturing/routes/mfg-wave3.routes';
import contractingRoutes from './modules/contracting/routes/index.routes';
import realEstateWave3Routes from './modules/real-estate/routes/wave3.routes';
import subcontractRoutes from './modules/subcontracts/routes/subcontracts.routes';
import propertyRoutes from './modules/real-estate/routes/properties.routes';
import customerFollowupRoutes from './modules/real-estate/routes/customer-followup.routes';
import reservationRoutes from './modules/real-estate/routes/reservation.routes';
import closureRoutes from './modules/real-estate/routes/closure.routes';
import realEstateReportsRoutes from './modules/real-estate/routes/reports.routes';
import posRoutes from './modules/pos/routes/pos.routes';
import jobStatusRoutes from './shared/jobs/job-status.routes';
import { graphqlMiddleware } from './shared/graphql/handler';
import companyRoutes from './modules/company/routes/company.routes';
import companyTenantRoutes, {
  settingsBranchesAliasRouter,
} from './modules/company/routes/company-tenant.routes';
import tenantBackupController from './modules/tenant/tenant-backup.controller';
import onboardingRoutes from './modules/onboarding/routes/onboarding.routes';
import userRoutes from './modules/users/routes/user.routes';
import notificationRoutes from './modules/notifications/routes/notification.routes';
import userGroupRoutes from './modules/users/routes/user-group.routes';
import permissionDefinitionsRoutes from './modules/users/routes/permission-definitions.routes';
import roleDefinitionsRoutes from './modules/users/routes/role-definitions.routes';
import authRoutes from './modules/auth/routes/auth.routes';
import projectRoutes from './modules/extracts/routes/project.routes';
import contractorRoutes from './modules/extracts/routes/contractor.routes';
import extractRoutes from './modules/extracts/routes/extract.routes';
import extractPaymentRoutes from './modules/extracts/routes/extract-payment.routes';
import projectBuildingRoutes from './modules/extracts/routes/project-building.routes';
import projectWorkItemRoutes from './modules/extracts/routes/project-work-item.routes';
import contractorAssignmentRoutes from './modules/extracts/routes/contractor-assignment.routes';
import projectMeasurementDefinitionRoutes from './modules/extracts/routes/project-measurement-definition.routes';
import manpowerLogRoutes from './modules/extracts/routes/manpower-log.routes';
import extractsReportsRoutes from './modules/extracts/routes/reports.routes';
import extractsDashboardRoutes from './modules/extracts/routes/dashboard.routes';
import realEstateInvestmentDashboardRoutes from './modules/real-estate/routes/investment-dashboard.routes';
import electronicInvoiceDashboardRoutes from './modules/electronic-invoices/routes/dashboard.routes';
import m5InvoiceRoutes from './modules/invoices/routes/invoice.routes';
import analyticalInvoiceReportRoutes from './modules/invoices/routes/analytical-invoice-report.routes';
import treasuryCashTransactionRoutes from './modules/treasury/routes/cash-transaction.routes';
import treasuryOrderRoutes from './modules/treasury/routes/treasury-order.routes';
import treasuryChequeRoutes from './modules/treasury/routes/cheque.routes';
import taxPeriodRouter, {
  taxesCatalogAliasRouter,
} from './modules/taxes/routes/tax-period.routes';
import taxDeclarationRouter from './modules/taxes/routes/tax-declaration.routes';
import withholdingTaxRouter from './modules/taxes/routes/withholding-tax.routes';
import taxReportsRouter from './modules/taxes/routes/reports.routes';
import taxInvoiceRouter from './modules/taxes/routes/invoice.routes';
import bankBoxRightsRoutes from './modules/treasury/routes/bank-box-rights.routes';
import posTerminalRoutes from './modules/pos/routes/pos-terminal.routes';
import posShiftRoutes from './modules/pos/routes/pos-shift.routes';
import posOrderRoutes from './modules/pos/routes/pos-order.routes';
import electronicInvoiceItemRoutes from './modules/electronic-invoices/routes/item-card.routes';
import electronicInvoiceCustomerRoutes from './modules/electronic-invoices/routes/customer-card.routes';
import electronicInvoiceRoutes from './modules/electronic-invoices/routes/invoice.routes';
import electronicInvoiceImportRoutes from './modules/electronic-invoices/routes/import.routes';
import electronicInvoiceSettingsRoutes from './modules/electronic-invoices/routes/settings.routes';
import electronicInvoiceReportsRoutes from './modules/electronic-invoices/routes/reports.routes';
import etaSubmissionRoutes from './modules/electronic-invoices/routes/eta-submission.routes';
import etaDocumentsRoutes from './modules/electronic-invoices/routes/eta-documents.routes';
import auditLogRoutes from './modules/common/routes/audit-log.routes';
import activityLogRoutes from './modules/common/routes/activity-log.routes';
import apiKeyRoutes from './modules/common/routes/api-key.routes';
import systemSettingRoutes from './modules/common/routes/system-setting.routes';
import databaseToolsRoutes from './modules/database-tools/routes/database-backup.routes';
import operationsManagementRoutes from './modules/operations-management/routes/operations-management.routes';
import translationRoutes from './modules/translation/routes/translation.routes';
import importExportRoutes from './modules/import-export/routes/index.routes';
import tradeRoutes from './modules/trade/routes/index.routes';
import { env } from './shared/config/env';

const app: Express = express();

// Railway + Next.js rewrite sit in front of this process. Without trust
// proxy, req.ip is the Next.js container for every user and they all share
// one rate-limit bucket.
const trustProxyRaw = (process.env.TRUST_PROXY ?? '1').trim().toLowerCase();
if (trustProxyRaw !== 'false' && trustProxyRaw !== '0') {
  app.set('trust proxy', /^\d+$/.test(trustProxyRaw) ? Number(trustProxyRaw) : 1);
}

// Security middleware with enhanced configuration
// In development, disable CSP so the browser can call the API on another port (e.g. Next :3000 → API :3001).
// Otherwise connectSrc: 'self' blocks fetch() and surfaces as "Failed to fetch".
app.use(
  env.NODE_ENV === 'development'
    ? helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        frameguard: { action: 'deny' },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      })
    : helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: { action: 'deny' },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      })
);

// Cookie parser (required for CSRF protection)
app.use(cookieParser());

// CORS configuration - Allow frontend to communicate with backend
app.use(cors(buildCorsOptions()));

// Compression middleware (should be before other middleware)
import { compressionMiddleware } from './shared/middleware/compression.middleware';
app.use(compressionMiddleware);

// Request timeout middleware (30s default, 60s for reports)
import { defaultRequestTimeout, reportRequestTimeout, aiRequestTimeout } from './shared/middleware/request-timeout.middleware';
app.use(defaultRequestTimeout);

// IP blocking middleware (blocks IPs after repeated violations)
import { ipBlockingMiddleware } from './shared/middleware/ip-blocking.middleware';
app.use('/api/v1', ipBlockingMiddleware);

// Security headers validation (production only)
import { securityHeadersValidation } from './shared/middleware/security-headers.middleware';
app.use(securityHeadersValidation);

// Query limits middleware (enforce pagination and result size limits)
import { defaultQueryLimits } from './shared/middleware/query-limits.middleware';
app.use('/api/v1', defaultQueryLimits);

// Body parsing middleware with size limits (security: prevent DoS via large payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security audit middleware (apply early, before sanitization)
// Note: Security audit is handled by securityAuditMiddleware below

// Input sanitization middleware (apply early)
app.use(sanitize);
app.use(preventSQLInjection);
app.use(preventXSS);

// Request logging middleware
app.use(requestLogger);

// ETag + Cache-Control (master data: must-revalidate; transactional: no-cache)
import { etagMiddleware } from './shared/middleware/etag.middleware';
import { cacheControlMiddleware } from './shared/middleware/cache-control.middleware';
app.use(cacheControlMiddleware);
app.use(etagMiddleware);

// GraphQL depth limiting (before GraphQL routes)
import { graphqlDepthLimitMiddleware } from './shared/middleware/graphql-depth-limit.middleware';
app.use(graphqlDepthLimitMiddleware);

// Metrics collection middleware
import { metricsMiddleware } from './shared/monitoring/metrics';
app.use(metricsMiddleware);

// Rate limiting middleware (apply before routes)
app.use('/api/v1', apiRateLimiter);

const distributedRateMax =
  Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? '', 10) || 5000;

// Distributed rate limiting (Redis-backed, for horizontal scaling)
import { distributedRateLimit } from './shared/middleware/distributed-rate-limit.middleware';
app.use('/api/v1', distributedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: distributedRateMax,
  standardHeaders: true,
  legacyHeaders: true,
}));

// Per-user/tenant rate limiting for sensitive endpoints
import { perUserRateLimiter } from './shared/middleware/rate-limit-per-user.middleware';
app.use('/api/v1/accounting/journal-entries', perUserRateLimiter);
app.use('/api/v1/accounting/recurring-entries', perUserRateLimiter);
app.use('/api/v1/inventory/invoices', perUserRateLimiter);
app.use('/api/v1/hr/payroll', perUserRateLimiter);

// CSRF Protection (attach token to GET requests, validate on state-changing requests)
import { attachCSRFToken, csrfProtection } from './shared/middleware/csrf.middleware';
app.use('/api/v1', attachCSRFToken); // Attach CSRF token to responses
app.use('/api/v1', csrfProtection); // Validate CSRF token on POST/PUT/DELETE/PATCH

// Security audit middleware (after authentication)
import { securityAuditMiddleware } from './shared/middleware/security-audit.middleware';
app.use('/api/v1', securityAuditMiddleware);

// Health check endpoints (no auth required)
import { healthChecker } from './shared/health/health-checker';

// Comprehensive health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await healthChecker.performHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    return void res.status(statusCode).json(health);
  } catch (error) {
    return void res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Liveness probe (for Kubernetes)
app.get('/health/live', async (_req: Request, res: Response) => {
  const isAlive = await healthChecker.livenessCheck();
  return void res.status(isAlive ? 200 : 503).json({
    status: isAlive ? 'alive' : 'dead',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (for Kubernetes)
app.get('/health/ready', async (_req: Request, res: Response) => {
  const isReady = await healthChecker.readinessCheck();
  return void res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (login/register carry their own limiter; /me and /verify must not)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public/share', publicShareRouter);

// API versioning middleware
import { apiVersionMiddleware } from './shared/middleware/api-version.middleware';
app.use('/api', apiVersionMiddleware);

// API routes - Module-based routing
// Auth gate: JWT enforced by default; only skipped when API_AUTH_MODE is
// explicitly set to `anonymous` (local dev only — H21 fix, Item 39: this is
// no longer the implicit default for any non-production environment).
app.use('/api/v1', apiAuthGate() as express.RequestHandler);
// SECURITY: Set tenant context for Row-Level Security (RLS)
app.use('/api/v1', setTenantContext as express.RequestHandler);
// Legacy `UserBranches`: a restricted user may not request another branch via
// the `branchId` query filter (~100 list/report endpoints accept one) or body.
app.use('/api/v1', enforceBranchScope as express.RequestHandler);
// SaaS entitlements: one gate driven by ROUTE_MODULE_MAP instead of per-mount guards.
app.use('/api/v1', licenseRouteGate());
// Vertical engines resolve company / branch / fiscal year from the tenant headers; without this
// their posting endpoints never see X-Fiscal-Year-Id and reject every request from the UI.
for (const verticalPrefix of [
  '/api/v1/manufacturing',
  '/api/v1/contracting',
  '/api/v1/real-estate',
  '/api/v1/hr/payroll-runs',
]) {
  app.use(verticalPrefix, tenantAndFiscalContextMiddleware as express.RequestHandler);
}

// Company routes (requires admin privileges)
app.use('/api/v1/companies', cache({ ttl: 300 }), companyRoutes);
// Tenant-scoped company shortcuts (e.g. branches for JWT company — matches frontend /company/branches)
app.use('/api/v1/company', cache({ ttl: 300 }), companyTenantRoutes);
app.use('/api/v1/tenant', tenantBackupController);
app.use('/api/v1/settings/branches', cache({ ttl: 300 }), settingsBranchesAliasRouter);
app.use('/api/v1/onboarding', onboardingRoutes);

// User routes
app.use('/api/v1/users', cache({ ttl: 300 }), userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/user-groups', cache({ ttl: 300 }), userGroupRoutes);
app.use('/api/v1/permissions', cache({ ttl: 300 }), permissionDefinitionsRoutes);
app.use('/api/v1/rbac/permissions', cache({ ttl: 300 }), permissionDefinitionsRoutes);
app.use('/api/v1/roles', cache({ ttl: 300 }), roleDefinitionsRoutes);

// Inventory routes (with caching for GET requests)
app.use('/api/v1/inventory/items', cache({ ttl: 300 }), inventoryRoutes);
app.use('/api/v1/inventory/units', cache({ ttl: 300 }), unitRoutes);
app.use('/api/v1/inventory/warehouses', cache({ ttl: 300 }), warehouseRoutes);
app.use('/api/v1/inventory/invoices', invoiceRoutes);
app.use('/api/v1/invoices', m5InvoiceRoutes);
app.use('/api/v1/reports', reportRequestTimeout, analyticalInvoiceReportRoutes);
app.use('/api/v1/treasury/cash-transactions', treasuryCashTransactionRoutes);
app.use('/api/v1/orders', treasuryOrderRoutes);
app.use('/api/v1/treasury/cheques', treasuryChequeRoutes);
app.use('/api/v1/taxes', taxesCatalogAliasRouter);
app.use('/api/v1/taxes/periods', taxPeriodRouter);
app.use('/api/v1/taxes/declarations', taxDeclarationRouter);
app.use('/api/v1/taxes/withholding', withholdingTaxRouter);
app.use('/api/v1/taxes/reports', taxReportsRouter);
app.use('/api/v1/taxes/invoices', taxInvoiceRouter);
app.use('/api/v1/treasury/bank-box-rights', bankBoxRightsRoutes);
app.use('/api/v1/pos/terminals', posTerminalRoutes);
app.use('/api/v1/pos/shifts', posShiftRoutes);
app.use('/api/v1/pos/orders', posOrderRoutes);
app.use('/api/v1/inventory/item-quantities', cache({ ttl: 300 }), itemQuantityRoutes);
app.use('/api/v1/inventory/locations', cache({ ttl: 300 }), locationRoutes);
app.use('/api/v1/inventory/opening-stock', openingStockRoutes);
app.use('/api/v1/inventory/stocktaking', stocktakingRoutes);
app.use('/api/v1/inventory/transfers', transferRoutes);
app.use('/api/v1/inventory/assemblies', assemblyRoutes);
app.use('/api/v1/inventory/disassemblies', disassemblyRoutes);
app.use('/api/v1/inventory/receipts', receiptRoutes);
app.use('/api/v1/inventory/issues', issueRoutes);
app.use('/api/v1/inventory/adjustments', adjustmentRoutes);
app.use('/api/v1/inventory/other-adjustments', otherAdjustmentRoutes);
app.use('/api/v1/inventory/landed-costs', landedCostRoutes);
app.use('/api/v1/inventory/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/inventory/purchase-returns', purchaseReturnRoutes);
app.use('/api/v1/inventory/price-quotes', priceQuoteRoutes);
app.use('/api/v1/inventory/item-offers', cache({ ttl: 300 }), itemOfferRoutes);
app.use('/api/v1/inventory/price-lists', cache({ ttl: 300 }), priceListRoutes);
app.use('/api/v1/inventory/item-prices', cache({ ttl: 300 }), itemPriceRoutes);
app.use('/api/v1/inventory/item-units', cache({ ttl: 300 }), itemUnitRoutes);
app.use('/api/v1/inventory/item-categories', cache({ ttl: 300 }), itemCategoryRoutes);
app.use('/api/v1/inventory/other-addition-discount-types', otherAdditionDiscountTypeRoutes);
app.use('/api/v1/inventory/representatives-commissions-quantities', representativeCommissionQuantityRoutes);
app.use('/api/v1/inventory/representatives-commissions-values', representativeCommissionValueRoutes);
app.use('/api/v1/inventory/representatives-commissions-policy', representativeCommissionPolicyRoutes);
app.use('/api/v1/inventory/item-order-limits', itemOrderLimitRoutes);
app.use('/api/v1/inventory/customer-contracts', customerContractRoutes);
app.use('/api/v1/inventory/clothing-matrix', clothingMatrixRoutes);
app.use('/api/v1/inventory/reports', inventoryReportsRoutes);
app.use('/api/v1/inventory', inventoryWave0Routes);
app.use('/api/v1/accounting', cache({ ttl: 300 }), partyMastersRoutes);
app.use('/api/v1/accounting', counterpartyOffsetRoutes);

// Accounting routes
app.use('/api/v1/accounting/settings', accountingSettingsRoutes);
app.use('/api/v1/accounting/accounts', accountRoutes);
app.use('/api/v1/accounting/chart-of-accounts', cache({ ttl: 300 }), chartOfAccountsAliasRouter);
app.use('/api/v1/accounting/cost-centers', costCenterRoutes);
app.use('/api/v1/accounting/customers', cache({ ttl: 300 }), customerRoutes);
app.use('/api/v1/customers', customerInsightsRoutes);
app.use('/api/v1/parties', cache({ ttl: 120 }), partiesRoutes);
app.use('/api/v1/accounting/suppliers', cache({ ttl: 300 }), supplierRoutes);
app.use('/api/v1/accounting/delegates', cache({ ttl: 300 }), delegateRoutes);
app.use('/api/v1/accounting/distributors', cache({ ttl: 300 }), distributorRoutes);
app.use('/api/v1/accounting/drivers', cache({ ttl: 300 }), driverRoutes);
app.use('/api/v1/accounting/currencies', cache({ ttl: 300 }), currencyRoutes);
app.use('/api/v1/accounting/periods', periodRoutes);
app.use('/api/v1/accounting/journal-entries', journalEntryRoutes);
app.use('/api/v1/accounting/opening-balance', openingBalanceRoutes);
app.use('/api/v1/accounting/recurring-entries', recurringEntriesController);
app.use('/api/v1/accounting/account-movements', accountMovementRoutes);
app.use('/api/v1/accounting/cost-center-movements', costCenterMovementRoutes);
app.use('/api/v1/accounting/banks', cache({ ttl: 300 }), bankRoutes);
app.use('/api/v1/accounting/safes', cache({ ttl: 300 }), safeRoutes);
app.use('/api/v1/accounting/bank-accounts', cache({ ttl: 300 }), bankAccountRoutes);
app.use('/api/v1/accounting/treasury-receipts', treasuryReceiptRoutes);
app.use('/api/v1/accounting/treasury-payments', treasuryPaymentRoutes);
app.use('/api/v1/accounting/securities-receipts', securitiesReceiptRoutes);
app.use('/api/v1/accounting/securities-payments', securitiesPaymentRoutes);
app.use('/api/v1/accounting/securities-renewals', securitiesRenewalRoutes);
app.use('/api/v1/demo', demoRoutes);

// HR routes
app.use('/api/v1/hr/employees', cache({ ttl: 300 }), employeeRoutes);
app.use('/api/v1/hr/nationalities', cache({ ttl: 300 }), nationalityRoutes);
app.use('/api/v1/hr/payroll', payrollRoutes);
app.use('/api/v1/hr/religions', cache({ ttl: 300 }), religionRoutes);
app.use('/api/v1/hr/marital-statuses', cache({ ttl: 300 }), maritalStatusRoutes);
app.use('/api/v1/hr/job-titles', cache({ ttl: 300 }), jobTitleRoutes);
app.use('/api/v1/hr/job-cadres', cache({ ttl: 300 }), jobCadreRoutes);
app.use('/api/v1/hr/departments', cache({ ttl: 300 }), departmentRoutes);
app.use('/api/v1/hr/cities', cache({ ttl: 300 }), cityRoutes);
app.use('/api/v1/hr/wage-policies', cache({ ttl: 300 }), wagePolicyRoutes);
app.use('/api/v1/hr/allowances', cache({ ttl: 300 }), allowanceRoutes);
app.use('/api/v1/hr/deductions', cache({ ttl: 300 }), deductionRoutes);
app.use('/api/v1/hr/employee-contracts', employeeContractRoutes);
app.use('/api/v1/hr/employee-procedures', employeeProcedureRoutes);
app.use('/api/v1/hr/employee-advances', employeeAdvanceRoutes);
app.use('/api/v1/hr/monthly-salaries', monthlySalaryRoutes);
app.use('/api/v1/hr/reports', reportRequestTimeout, hrReportsRoutes);
app.use('/api/v1/hr/leave-entitlements', leaveEntitlementsRoutes);
app.use('/api/v1/hr/eos-clearance', eosClearanceRoutes);
app.use('/api/v1/hr/housing-allowance', housingAllowanceRoutes);
app.use('/api/v1/hr/settings', hrSettingsRoutes);
app.use('/api/v1/hr/payroll-runs', payrollRunRoutes);
app.use('/api/v1/hr/advances', hrAdvancesRoutes);

// Accounting routes
app.use('/api/v1/accounting/reports', financialReportsRoutes);
app.use('/api/v1/accounting/reconcile', reconciliationRoutes);
app.use('/api/v1/approval', approvalRoutes);
app.use('/api/v1/audit', documentAuditRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/analytics', reportRequestTimeout, analyticsRoutes);
app.use('/api/v1/executive', reportRequestTimeout, executiveRoutes);
app.use('/api/v1/growth', reportRequestTimeout, growthRoutes);
app.use('/api/v1/ai', aiRequestTimeout, aiRoutes);
app.use('/api/v1/share', authenticatedShareRouter);
app.use('/api/v1/operations', wave4OperationsRoutes);
app.use('/api/v1/archive', archiveRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/document-layout-configs', documentLayoutRoutes);
app.use('/api/v1/document-layouts', documentLayoutRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/new-modules', newModuleRoutes);
app.use('/api/v1/document-profiles', documentProfileRoutes);
app.use('/api/v1/transaction-settings', transactionSettingsRoutes);
app.use('/api/v1/items', cache({ ttl: 60 }), inventoryRoutes);
app.use('/api/v1/company-settings', companySettingRoutes);
app.use('/api/v1/accounting/reports', reportRequestTimeout, reportsRoutes);

// Manufacturing routes
app.use('/api/v1/manufacturing/sensors', sensorRoutes);
app.use('/api/v1/manufacturing', mfgWave3Routes);
app.use('/api/v1/contracting', contractingRoutes);
app.use('/api/v1/subcontracts', subcontractRoutes);
app.use('/api/v1/manufacturing/reports', reportRequestTimeout, manufacturingReportsRoutes);

// Real Estate routes
app.use('/api/v1/real-estate/investment-dashboard', cache({ ttl: 60 }), realEstateInvestmentDashboardRoutes);
app.use('/api/v1/real-estate', realEstateWave3Routes);
app.use('/api/v1/real-estate/properties', propertyRoutes);
app.use('/api/v1/real-estate/customer-followup', customerFollowupRoutes);
app.use('/api/v1/real-estate/reservations', reservationRoutes);
app.use('/api/v1/real-estate/closures', closureRoutes);
app.use(
  '/api/v1/real-estate/reports',
  reportRequestTimeout,
  realEstateReportsRoutes
);

// POS routes
app.use('/api/v1/pos', posRoutes);

// Extracts/Projects routes
app.use('/api/v1/extracts/dashboard', cache({ ttl: 60 }), extractsDashboardRoutes);
app.use('/api/v1/extracts/projects', cache({ ttl: 300 }), projectRoutes);
app.use('/api/v1/extracts/contractors', cache({ ttl: 300 }), contractorRoutes);
app.use('/api/v1/extracts', extractRoutes);
app.use('/api/v1/extracts/payments', extractPaymentRoutes);
app.use('/api/v1/extracts/buildings', cache({ ttl: 300 }), projectBuildingRoutes);
app.use('/api/v1/extracts/work-items', cache({ ttl: 300 }), projectWorkItemRoutes);
app.use('/api/v1/extracts/contractor-assignments', cache({ ttl: 300 }), contractorAssignmentRoutes);
app.use('/api/v1/extracts/measurement-definitions', cache({ ttl: 300 }), projectMeasurementDefinitionRoutes);
app.use('/api/v1/extracts/manpower-logs', cache({ ttl: 300 }), manpowerLogRoutes);
app.use('/api/v1/extracts/reports', reportRequestTimeout, extractsReportsRoutes);

// Electronic Invoices routes
app.use('/api/v1/electronic-invoices/dashboard', cache({ ttl: 60 }), electronicInvoiceDashboardRoutes);
app.use('/api/v1/electronic-invoices', etaSubmissionRoutes);
app.use('/api/v1/eta/documents', etaDocumentsRoutes);
app.use('/api/v1/electronic-invoices/items', cache({ ttl: 300 }), electronicInvoiceItemRoutes);
app.use('/api/v1/electronic-invoices/customers', cache({ ttl: 300 }), electronicInvoiceCustomerRoutes);
app.use('/api/v1/electronic-invoices/invoices', electronicInvoiceRoutes);
app.use('/api/v1/electronic-invoices/import', electronicInvoiceImportRoutes);
app.use('/api/v1/electronic-invoices/settings', electronicInvoiceSettingsRoutes);
app.use('/api/v1/electronic-invoices/reports', reportRequestTimeout, electronicInvoiceReportsRoutes);

// Job status routes (for checking async job status)
app.use('/api/v1/jobs', jobStatusRoutes);

// Common/System routes
app.use('/api/v1/audit-logs', cache({ ttl: 60 }), auditLogRoutes);
app.use('/api/v1/activity-logs', cache({ ttl: 60 }), activityLogRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/system-settings', cache({ ttl: 300 }), systemSettingRoutes);

// Database Tools routes
app.use('/api/v1/database-tools', databaseToolsRoutes);

// Operations Management routes
app.use('/api/v1/operations-management', operationsManagementRoutes);

// Translation routes
app.use('/api/v1/translation', cache({ ttl: 300 }), translationRoutes);

// Import/Export routes
app.use('/api/v1/import-export', cache({ ttl: 300 }), importExportRoutes);
app.use('/api/v1/trade', tradeRoutes);

// GraphQL endpoint (for complex queries)
// Note: graphqlMiddleware already includes authenticate and setTenantContext
app.all('/api/graphql', ...(graphqlMiddleware as express.RequestHandler[]));

// Response size limit middleware (prevent memory exhaustion)
app.use((req: Request, res: Response, next: NextFunction) => {
  const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB
  let responseSize = 0;

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = function (chunk: any): boolean {
    if (chunk) {
      responseSize += Buffer.byteLength(chunk);
      if (responseSize > MAX_RESPONSE_SIZE) {
        logger.error(
          {
            path: req.path,
            method: req.method,
            responseSize,
            maxSize: MAX_RESPONSE_SIZE,
          },
          'Response size limit exceeded'
        );
        if (!res.headersSent) {
          res.status(413).json({
            status: 'error',
            message: 'Response too large',
          });
        }
        return false;
      }
    }
    return originalWrite(chunk);
  };

  res.end = function (chunk?: any, ...args: any[]) {
    if (chunk) {
      responseSize += Buffer.byteLength(chunk);
      if (responseSize > MAX_RESPONSE_SIZE && !res.headersSent) {
        res.status(413).json({
          status: 'error',
          message: 'Response too large',
        });
        return res;
      }
    }
    return (originalEnd as (...a: any[]) => Response).apply(res, [chunk, ...args]);
  };

  next();
});

// Memory monitoring (record memory usage periodically)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    metricsCollector.recordMemoryUsage();
  }, 60000); // Every minute
}

// Metrics endpoint (for Prometheus scraping)
app.get('/metrics', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  return void res.send(metricsCollector.getPrometheusFormat());
});

// Additional routes will be added here:
// app.use('/api/v1/accounting/...', accountingRoutes);
// app.use('/api/v1/hr/...', hrRoutes);
// etc.

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;