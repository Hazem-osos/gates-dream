import { z } from 'zod';
import {
  AI_ACTION_PERMISSIONS,
  AI_ACTION_TYPES,
  type PreparedActionResult,
} from '../actions/action-types';
import type { AiPendingActionStore } from '../actions/pending-action.store';
import { resolveCustomerAndLines, totalsFromLines } from '../actions/resolve-document-lines';
import type { WriteCatalogPort } from '../actions/write-catalog.port';
import { BaseAiTool } from './base-ai-tool';
import { optionalUuid, requiredUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const lineSchema = z.object({
  itemId: requiredUuid,
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

const paramsSchema = z.object({
  customerId: optionalUuid,
  items: z.array(lineSchema).min(1).max(50),
  notes: z.string().max(1000).optional(),
  paymentTerms: z.string().max(200).optional(),
});

type Params = z.infer<typeof paramsSchema>;

const CONFIRM_INSTRUCTION =
  'Draft only. Ask the user to confirm the card in the UI (تأكيد وإنشاء). Do not say the quotation was created.';

export class PrepareCreateQuotationTool extends BaseAiTool<Params, PreparedActionResult> {
  readonly name = 'prepareCreateQuotation';
  readonly description =
    'Prepare a sales quotation draft for user confirmation. Never creates the document.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = AI_ACTION_PERMISSIONS.CREATE_QUOTATION;

  constructor(
    private readonly catalog: WriteCatalogPort,
    private readonly pending: AiPendingActionStore
  ) {
    super();
  }

  protected async run(params: Params, context: SecurityContext): Promise<PreparedActionResult> {
    if (!context.conversationId) {
      throw new Error('Conversation context is required to prepare a write action');
    }

    const customerId = context.boundCustomerId || params.customerId;
    if (!customerId) throw new Error('customerId is required');
    if (context.boundCustomerId && params.customerId && params.customerId !== context.boundCustomerId) {
      throw new Error('هذا الرقم مرتبط بعميل محدد ولا يمكن إنشاء عرض لعميل آخر');
    }
    const { customer, lines } = await resolveCustomerAndLines(
      this.catalog,
      context.companyId,
      customerId,
      params.items
    );
    const currency = customer.currencyCode || 'EGP';
    const totals = totalsFromLines(lines, currency);
    const paymentMethod =
      params.paymentTerms?.toLowerCase().includes('cash') || params.paymentTerms === 'نقدي'
        ? 'cash'
        : 'credit';

    const summaryDisplay = {
      title: 'مسودة عرض سعر جديد',
      actionType: AI_ACTION_TYPES.CREATE_QUOTATION,
      customerName: customer.arabicName,
      itemsCount: lines.length,
      totalAmount: totals.total,
      currency,
      lines,
      notes: params.notes,
      paymentTerms: params.paymentTerms,
    };

    const payload = {
      customerId: customer.id,
      branchId: context.branchId,
      description: params.notes,
      date: new Date().toISOString(),
      paymentMethod,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        baseQuantity: line.quantity * line.conversionFactor,
        unitPrice: line.unitPrice,
        total: line.lineTotal,
        taxPercentage: line.taxPercent,
        netTotal: line.lineTotal * (1 + line.taxPercent / 100),
      })),
    };

    const action = await this.pending.create({
      conversationId: context.conversationId,
      companyId: context.companyId,
      userId: context.userId,
      actionType: AI_ACTION_TYPES.CREATE_QUOTATION,
      requiredPermission: this.requiredPermission,
      payload,
      summaryDisplay,
    });

    return {
      actionId: action.id,
      actionType: AI_ACTION_TYPES.CREATE_QUOTATION,
      status: 'PENDING',
      confirmationRequired: true,
      instruction: CONFIRM_INSTRUCTION,
      expiresAt: action.expiresAt.toISOString(),
      summaryDisplay,
      resolvedItems: lines,
      totals,
    };
  }
}
