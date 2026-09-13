import { agedOpenItemsService } from '../../accounting/services/aged-open-items.service';
import { bankAccountService } from '../../accounting/services/bank-account.service';
import { financialReportService } from '../../accounting/services/financial-report.service';
import { partyQuickSummaryService } from '../../accounting/services/party-quick-summary.service';
import { safeService } from '../../accounting/services/safe.service';
import { executiveAnalyticsService } from '../../analytics/services/executive-analytics.service';
import { contractingDashboardService } from '../../contracting/dashboard/contracting-dashboard.service';
import { invoiceService } from '../../inventory/services/invoice.service';
import { inventoryReportsService } from '../../inventory/services/reports.service';
import { aiPendingActionStore } from '../actions/pending-action.store';
import { prismaWriteCatalog } from '../actions/write-catalog';
import { AiToolRegistry } from './ai-tool-registry';
import { RenderDataVisualizationTool } from './analytics-visualizer.tool';
import { ProposeTransactionDraftTool } from './draft-action.tools';
import { PrepareCreateCustomerTool } from './prepare-create-customer.tool';
import { PrepareCreateQuotationTool } from './prepare-create-quotation.tool';
import { PrepareCreateSalesInvoiceTool } from './prepare-create-sales-invoice.tool';
import { GetCashAndBankBalancesTool } from './get-cash-and-bank-balances.tool';
import { GetCustomerStatementTool } from './get-customer-statement.tool';
import { GetInventoryStatusTool } from './get-inventory-status.tool';
import { GetOverdueReceivablesTool } from './get-overdue-receivables.tool';
import { GetProfitAndLossSummaryTool } from './get-profit-and-loss-summary.tool';
import { GetProjectProfitabilityTool } from './get-project-profitability.tool';
import { GetSalesSummaryTool } from './get-sales-summary.tool';
import { GetSupplierPayablesTool } from './get-supplier-payables.tool';
import { GetTopCustomersTool } from './get-top-customers.tool';
import { GetTopSellingItemsTool } from './get-top-selling-items.tool';
import { SearchCompanyDocumentsTool } from './search-company-documents.tool';
import { GetMorningBriefingTool } from './get-morning-briefing.tool';
import { FinancialOverviewTool } from './financial-overview.tool';
import { CustomerAgingTool } from './customer-aging.tool';
import { VendorPayableTool } from './vendor-payable.tool';
import { CostCenterProjectsTool } from './cost-center-projects.tool';
import { HrPayrollTool } from './hr-payroll.tool';
import { UniversalRecordLookupTool } from './universal-record-lookup.tool';
import { CfoWhatIfTool } from './simulator/cfo-what-if.tool';
import { GetGrowthSummaryTool } from './get-growth-summary.tool';
import { documentSearchService } from '../rag/document-search.service';
import { insightStore } from '../proactive/insight.store';

export { BaseAiTool } from './base-ai-tool';
export { AiToolRegistry } from './ai-tool-registry';
export { stripTenantArgs } from './strip-tenant-args';
export {
  AI_TOOL_PERMISSION_DENIED_AR,
  filterAiTools,
  isAiToolAllowed,
} from './ai-tool-access';
export type { AiToolResult, SecurityContext } from './types';

export function createCoreFinancialToolRegistry(): AiToolRegistry {
  return new AiToolRegistry()
    .register(new GetSalesSummaryTool(inventoryReportsService))
    .register(new GetTopCustomersTool(executiveAnalyticsService, agedOpenItemsService))
    .register(new GetOverdueReceivablesTool(agedOpenItemsService))
    .register(new GetInventoryStatusTool(inventoryReportsService))
    .register(new GetCashAndBankBalancesTool(safeService, bankAccountService))
    .register(new GetProfitAndLossSummaryTool(financialReportService))
    .register(new GetProjectProfitabilityTool(contractingDashboardService))
    .register(new GetCustomerStatementTool(partyQuickSummaryService, invoiceService))
    .register(new GetSupplierPayablesTool(agedOpenItemsService))
    .register(new GetTopSellingItemsTool(inventoryReportsService))
    .register(new PrepareCreateQuotationTool(prismaWriteCatalog, aiPendingActionStore))
    .register(new PrepareCreateSalesInvoiceTool(prismaWriteCatalog, aiPendingActionStore))
    .register(new PrepareCreateCustomerTool(prismaWriteCatalog, aiPendingActionStore))
    .register(new ProposeTransactionDraftTool(prismaWriteCatalog, aiPendingActionStore))
    .register(new RenderDataVisualizationTool())
    .register(new SearchCompanyDocumentsTool(documentSearchService))
    .register(new GetMorningBriefingTool(insightStore))
    .register(new FinancialOverviewTool(safeService, bankAccountService))
    .register(new CustomerAgingTool(agedOpenItemsService))
    .register(new VendorPayableTool(agedOpenItemsService))
    .register(new CostCenterProjectsTool(financialReportService))
    .register(new HrPayrollTool())
    .register(new UniversalRecordLookupTool())
    .register(new CfoWhatIfTool())
    .register(new GetGrowthSummaryTool());
}

let cachedRegistry: AiToolRegistry | undefined;

export function getCoreFinancialToolRegistry(): AiToolRegistry {
  cachedRegistry ??= createCoreFinancialToolRegistry();
  return cachedRegistry;
}
