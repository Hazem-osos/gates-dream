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
import { requiredUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const lineSchema = z.object({
  itemId: requiredUuid,
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

const paramsSchema = z.object({
  customerId: requiredUuid,
  warehouseId: requiredUuid,
  isCash: z.boolean(),
  items: z.array(lineSchema).min(1).max(50),
  notes: z.string().max(1000).optional(),
  paymentTerms: z.string().max(200).optional(),
});

type Params = z.infer<typeof paramsSchema>;

const CONFIRM_INSTRUCTION =
  'Draft only. Ask the user to confirm the card in the UI (تأكيد وإنشاء). Do not say the invoice was created.';

export class PrepareCreateSalesInvoiceTool extends BaseAiTool<Params, PreparedActionResult> {
  readonly name = 'prepareCreateSalesInvoice';
  readonly description =
    'Prepare a sales invoice draft for user confirmation. Checks stock. Never posts or creates the invoice.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = AI_ACTION_PERMISSIONS.CREATE_INVOICE;

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

    const warehouse = await this.catalog.findWarehouse(context.companyId, params.warehouseId);
    if (!warehouse) {
      throw new Error('المخزن غير موجود في هذه الشركة');
    }

    const { customer, lines } = await resolveCustomerAndLines(
      this.catalog,
      context.companyId,
      params.customerId,
      params.items
    );

    for (const line of lines) {
      if (line.isService) continue;
      const available = await this.catalog.getWarehouseQty(
        context.companyId,
        params.warehouseId,
        line.itemId
      );
      line.availableQty = available;
      if (available < line.quantity) {
        throw new Error(
          `الكمية غير كافية للصنف «${line.itemName}». المتاح: ${available} — المطلوب: ${line.quantity}`
        );
      }
    }

    const currency = customer.currencyCode || 'EGP';
    const totals = totalsFromLines(lines, currency);
    const summaryDisplay = {
      title: 'مسودة فاتورة مبيعات جديدة',
      actionType: AI_ACTION_TYPES.CREATE_INVOICE,
      customerName: customer.arabicName,
      itemsCount: lines.length,
      totalAmount: totals.total,
      currency,
      lines,
      notes: params.notes,
      paymentTerms: params.paymentTerms,
      warehouseName: warehouse.arabicName,
      isCash: params.isCash,
    };

    const payload = {
      invoiceType: 'sales' as const,
      date: new Date().toISOString(),
      currencyCode: currency,
      customerId: customer.id,
      warehouseId: warehouse.id,
      paymentMethod: params.isCash ? 'cash' : 'credit',
      description: params.notes,
      lines: lines.map((line, index) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        baseQuantity: line.quantity * line.conversionFactor,
        price: line.unitPrice,
        taxPercent: line.taxPercent,
        lineOrder: index + 1,
      })),
    };

    const action = await this.pending.create({
      conversationId: context.conversationId,
      companyId: context.companyId,
      userId: context.userId,
      actionType: AI_ACTION_TYPES.CREATE_INVOICE,
      requiredPermission: this.requiredPermission,
      payload,
      summaryDisplay,
    });

    return {
      actionId: action.id,
      actionType: AI_ACTION_TYPES.CREATE_INVOICE,
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
