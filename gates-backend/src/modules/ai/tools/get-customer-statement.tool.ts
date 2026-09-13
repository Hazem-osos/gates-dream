import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema, optionalUuid } from './shared-schemas';
import { defaultMonthRange } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  customerId: optionalUuid.describe('Customer id inside the authenticated company'),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  limit: z.number().int().min(1).max(50).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type CustomerStatementPartyPort = {
  getSummary: (
    companyId: string,
    partyId: string,
    partyType?: 'CUSTOMER' | 'SUPPLIER'
  ) => Promise<{
    partyId: string;
    displayName: string;
    code: string | null;
    balance: number;
    creditLimit: number | null;
    openInvoicesCount: number;
    riskBadge: string;
  }>;
};
export type CustomerStatementInvoicePort = {
  listInvoices: (
    companyId: string,
    options: Record<string, unknown>
  ) => Promise<{
    invoices?: Array<{
      id: string;
      invoiceNumber?: string | null;
      date?: Date | string;
      netAmount?: unknown;
      remainingAmount?: unknown;
      isPosted?: boolean;
    }>;
  }>;
};

export class GetCustomerStatementTool extends BaseAiTool<Params> {
  readonly name = 'getCustomerStatement';
  readonly description =
    'Customer ledger balance (quick summary) and recent posted sales invoices. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'customer:view';

  constructor(
    private readonly parties: CustomerStatementPartyPort,
    private readonly invoices: CustomerStatementInvoicePort
  ) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const customerId = context.boundCustomerId || params.customerId;
    if (!customerId) throw new Error('customerId is required');
    if (context.boundCustomerId && params.customerId && params.customerId !== context.boundCustomerId) {
      throw new Error('هذا الرقم مرتبط بعميل محدد ولا يمكن الاستعلام عن عميل آخر');
    }
    const { fromDate, toDate } = defaultMonthRange(params.startDate, params.endDate);
    const [card, listed] = await Promise.all([
      this.parties.getSummary(context.companyId, customerId, 'CUSTOMER'),
      this.invoices.listInvoices(context.companyId, {
        customerId,
        invoiceType: 'sales',
        startDate: fromDate,
        endDate: toDate,
        isCancelled: false,
        page: 1,
        limit: params.limit ?? 15,
      }),
    ]);

    const recent = (listed.invoices ?? []).map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      netAmount: Number(invoice.netAmount ?? 0),
      remainingAmount: Number(invoice.remainingAmount ?? 0),
      isPosted: Boolean(invoice.isPosted),
    }));

    return {
      customerId: card.partyId,
      displayName: card.displayName,
      code: card.code,
      balance: card.balance,
      creditLimit: card.creditLimit,
      openInvoicesCount: card.openInvoicesCount,
      riskBadge: card.riskBadge,
      recentTransactions: recent,
    };
  }
}
