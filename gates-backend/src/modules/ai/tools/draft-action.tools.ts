import { z } from 'zod';
import {
  AI_ACTION_PERMISSIONS,
  AI_ACTION_TYPES,
  type AiActionType,
  type PreparedActionResult,
} from '../actions/action-types';
import type { AiPendingActionStore } from '../actions/pending-action.store';
import { totalsFromLines, type ResolvedDraftLine } from '../actions/resolve-document-lines';
import { resolveItemPrice } from '../actions/write-catalog';
import type { CatalogItem, WriteCatalogPort } from '../actions/write-catalog.port';
import { isDraftActionType, type ActionType } from '../dto/action-card.dto';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const previewLineSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
});

const summarySchema = z.object({
  partyName: z.string().max(200).optional(),
  warehouseName: z.string().max(200).optional(),
  totalAmount: z.number().nonnegative().optional(),
  itemsCount: z.number().int().nonnegative().optional(),
});

const paramsSchema = z.object({
  actionType: z.enum([
    'DRAFT_SALES_INVOICE',
    'DRAFT_PURCHASE_INVOICE',
    'DRAFT_PAYMENT_VOUCHER',
    'DRAFT_STOCK_ISSUE',
  ]),
  titleAr: z.string().min(1).max(200),
  summary: summarySchema.optional(),
  draftPayload: z.record(z.unknown()).optional(),
  previewLines: z.array(previewLineSchema).max(50).optional(),
  partyName: z.string().max(200).optional(),
  warehouseName: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  isCash: z.boolean().optional(),
  amount: z.number().positive().optional(),
});

type Params = z.infer<typeof paramsSchema>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIRM_INSTRUCTION =
  'Draft only — the document was NOT saved. Include this JSON (actionId, isActionCard, actionType, actionCard) in your reply. Tell the user to click اعتماد كمسودة or فتح للتعديل في الشاشة. Never say the document was created.';

function asUuid(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_RE.test(value) ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readDraftLines(draftPayload?: Record<string, unknown>) {
  const raw = draftPayload?.lines;
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      itemId: asUuid(rec.itemId),
      name: typeof rec.name === 'string' ? rec.name : typeof rec.itemName === 'string' ? rec.itemName : '',
      quantity: asNumber(rec.quantity) ?? 1,
      unitPrice: asNumber(rec.unitPrice ?? rec.price),
    };
  });
}

/**
 * Propose a transaction draft for Human-in-the-Loop confirmation.
 * Resolves Arabic names to catalog IDs. Does NOT insert the business document.
 */
export class ProposeTransactionDraftTool extends BaseAiTool<Params, PreparedActionResult> {
  readonly name = 'propose_transaction_draft';
  readonly description =
    'Propose a Sales Invoice, Purchase Invoice, Payment Voucher, or Stock Issue draft as an interactive action card. Resolve parties/items/warehouses by Arabic name. Never create or post the document — the user must confirm the card.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = AI_ACTION_PERMISSIONS.DRAFT_SALES_INVOICE;

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
    if (!isDraftActionType(params.actionType)) {
      throw new Error('نوع المسودة غير مدعوم');
    }

    const actionType = params.actionType as ActionType;
    const partyName = params.partyName?.trim() || params.summary?.partyName?.trim() || '';
    const warehouseName = params.warehouseName?.trim() || params.summary?.warehouseName?.trim() || '';
    const notes =
      params.notes?.trim() ||
      (typeof params.draftPayload?.description === 'string' ? params.draftPayload.description : '') ||
      '';
    const draft = params.draftPayload ?? {};

    if (actionType === 'DRAFT_PAYMENT_VOUCHER') {
      return this.preparePayment(params, context, partyName, notes, draft);
    }
    if (actionType === 'DRAFT_STOCK_ISSUE') {
      return this.prepareStockIssue(params, context, warehouseName, notes, draft);
    }
    if (actionType === 'DRAFT_PURCHASE_INVOICE') {
      return this.preparePurchase(params, context, partyName, warehouseName, notes, draft);
    }
    return this.prepareSales(params, context, partyName, warehouseName, notes, draft);
  }

  private async prepareSales(
    params: Params,
    context: SecurityContext,
    partyName: string,
    warehouseName: string,
    notes: string,
    draft: Record<string, unknown>
  ) {
    const customer = await this.resolveCustomer(context.companyId, asUuid(draft.customerId), partyName);
    const warehouse = await this.resolveWarehouse(context.companyId, asUuid(draft.warehouseId), warehouseName);
    const { lines, warnings } = await this.resolveNamedLines(
      context.companyId,
      warehouse.id,
      params,
      draft,
      customer.priceTier
    );
    if (!lines.length) throw new Error('أضف صنفاً واحداً على الأقل للمسودة');

    const currency = customer.currencyCode || 'EGP';
    const totals = totalsFromLines(lines, currency);
    const isCash = params.isCash === true || draft.paymentMethod === 'cash';
    const titleAr = params.titleAr.trim() || `مسودة فاتورة مبيعات - ${customer.arabicName}`;
    const draftPayload = {
      invoiceType: 'sales' as const,
      date: new Date().toISOString(),
      currencyCode: currency,
      customerId: customer.id,
      warehouseId: warehouse.id,
      paymentMethod: isCash ? 'cash' : 'credit',
      description: notes || undefined,
      lines: this.toInvoiceLines(lines),
    };
    return this.persistCard({
      context,
      actionType: AI_ACTION_TYPES.DRAFT_SALES_INVOICE,
      titleAr,
      partyName: customer.arabicName,
      warehouseName: warehouse.arabicName,
      notes,
      isCash,
      lines,
      totals,
      draftPayload,
      warnings,
    });
  }

  private async preparePurchase(
    params: Params,
    context: SecurityContext,
    partyName: string,
    warehouseName: string,
    notes: string,
    draft: Record<string, unknown>
  ) {
    const supplier = await this.resolveSupplier(context.companyId, asUuid(draft.supplierId), partyName);
    const warehouse = await this.resolveWarehouse(context.companyId, asUuid(draft.warehouseId), warehouseName);
    const { lines, warnings } = await this.resolveNamedLines(
      context.companyId,
      warehouse.id,
      params,
      draft,
      null
    );
    if (!lines.length) throw new Error('أضف صنفاً واحداً على الأقل للمسودة');

    const currency = supplier.currencyCode || 'EGP';
    const totals = totalsFromLines(lines, currency);
    const titleAr = params.titleAr.trim() || `مسودة فاتورة مشتريات - ${supplier.arabicName}`;
    const draftPayload = {
      invoiceType: 'purchase' as const,
      date: new Date().toISOString(),
      currencyCode: currency,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      paymentMethod: 'credit',
      description: notes || undefined,
      lines: this.toInvoiceLines(lines),
    };
    return this.persistCard({
      context,
      actionType: AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE,
      titleAr,
      partyName: supplier.arabicName,
      warehouseName: warehouse.arabicName,
      notes,
      lines,
      totals,
      draftPayload,
      warnings,
    });
  }

  private async prepareStockIssue(
    params: Params,
    context: SecurityContext,
    warehouseName: string,
    notes: string,
    draft: Record<string, unknown>
  ) {
    const warehouse = await this.resolveWarehouse(context.companyId, asUuid(draft.warehouseId), warehouseName);
    const { lines, warnings } = await this.resolveNamedLines(
      context.companyId,
      warehouse.id,
      params,
      draft,
      null
    );
    if (!lines.length) throw new Error('أضف صنفاً واحداً على الأقل للمسودة');

    const totals = totalsFromLines(lines, 'EGP');
    const titleAr = params.titleAr.trim() || `مسودة إذن صرف - ${warehouse.arabicName}`;
    const draftPayload = {
      date: new Date().toISOString(),
      warehouseId: warehouse.id,
      description: notes || undefined,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.lineTotal,
      })),
    };
    return this.persistCard({
      context,
      actionType: AI_ACTION_TYPES.DRAFT_STOCK_ISSUE,
      titleAr,
      warehouseName: warehouse.arabicName,
      notes,
      lines,
      totals,
      draftPayload,
      warnings,
    });
  }

  private async preparePayment(
    params: Params,
    context: SecurityContext,
    partyName: string,
    notes: string,
    draft: Record<string, unknown>
  ) {
    const supplier = partyName || asUuid(draft.supplierId)
      ? await this.resolveSupplier(context.companyId, asUuid(draft.supplierId), partyName)
      : null;
    const amount =
      asNumber(params.amount) ??
      asNumber(draft.amount) ??
      asNumber(params.summary?.totalAmount) ??
      asNumber(params.previewLines?.[0]?.total);
    if (!amount || amount <= 0) {
      throw new Error('حدد مبلغ سند الصرف');
    }
    const safe = await this.catalog.findDefaultSafe(context.companyId);
    const titleAr = params.titleAr.trim() || `مسودة سند صرف${supplier ? ` - ${supplier.arabicName}` : ''}`;
    const totals = { subtotal: amount, tax: 0, total: amount, currency: 'EGP' };
    const previewName = supplier?.arabicName || partyName || 'سند صرف';
    const draftPayload = {
      transactionKind: 'PAYMENT' as const,
      date: new Date().toISOString(),
      amount,
      currencyCode: 'EGP',
      supplierId: supplier?.id,
      description: notes || titleAr,
      safeId: asUuid(draft.safeId) ?? safe?.id,
    };
    return this.persistCard({
      context,
      actionType: AI_ACTION_TYPES.DRAFT_PAYMENT_VOUCHER,
      titleAr,
      partyName: supplier?.arabicName || partyName,
      notes,
      lines: [
        {
          itemId: supplier?.id || 'payment',
          itemName: previewName,
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
          unitId: '',
          conversionFactor: 1,
          taxPercent: 0,
          isService: true,
        },
      ],
      totals,
      draftPayload,
      warnings: safe ? [] : ['لم يُعثر على خزينة افتراضية. اختر الخزينة من الشاشة قبل الاعتماد.'],
    });
  }

  private async resolveCustomer(companyId: string, id: string | undefined, name: string) {
    if (id) {
      const byId = await this.catalog.findCustomer(companyId, id);
      if (byId) return byId;
    }
    if (name) {
      const byName = await this.catalog.findCustomerByName(companyId, name);
      if (byName) return byName;
    }
    throw new Error(name ? `العميل «${name}» غير موجود في هذه الشركة` : 'حدد العميل للمسودة');
  }

  private async resolveSupplier(companyId: string, id: string | undefined, name: string) {
    if (id) {
      const byId = await this.catalog.findSupplier(companyId, id);
      if (byId) return byId;
    }
    if (name) {
      const byName = await this.catalog.findSupplierByName(companyId, name);
      if (byName) return byName;
    }
    throw new Error(name ? `المورد «${name}» غير موجود في هذه الشركة` : 'حدد المورد للمسودة');
  }

  private async resolveWarehouse(companyId: string, id: string | undefined, name: string) {
    if (id) {
      const byId = await this.catalog.findWarehouse(companyId, id);
      if (byId) return byId;
    }
    if (name) {
      const byName = await this.catalog.findWarehouseByName(companyId, name);
      if (byName) return byName;
    }
    throw new Error(name ? `المخزن «${name}» غير موجود في هذه الشركة` : 'حدد المخزن للمسودة');
  }

  private async resolveNamedLines(
    companyId: string,
    warehouseId: string,
    params: Params,
    draft: Record<string, unknown>,
    priceTier: string | null
  ): Promise<{ lines: ResolvedDraftLine[]; warnings: string[] }> {
    const fromPreview = (params.previewLines ?? []).map((line) => ({
      itemId: undefined as string | undefined,
      name: line.name,
      quantity: line.quantity ?? (line.total && line.unitPrice ? line.total / line.unitPrice : 1),
      unitPrice: line.unitPrice,
    }));
    const fromDraft = readDraftLines(draft);
    const inputs = fromPreview.length ? fromPreview : fromDraft;
    if (!inputs.length) return { lines: [], warnings: [] };

    const lines: ResolvedDraftLine[] = [];
    const warnings: string[] = [];

    for (const input of inputs) {
      let item: CatalogItem | null = null;
      if (input.itemId) {
        const found = await this.catalog.findItems(companyId, [input.itemId]);
        item = found[0] ?? null;
      }
      if (!item && input.name) {
        item = await this.catalog.findItemByName(companyId, input.name);
      }
      if (!item) {
        throw new Error(`الصنف «${input.name || input.itemId}» غير موجود في هذه الشركة`);
      }
      if (!item.unitId) {
        throw new Error(`الصنف «${item.arabicName}» بلا وحدة قياس`);
      }
      const quantity = input.quantity > 0 ? input.quantity : 1;
      const unitPrice = resolveItemPrice(item, priceTier, input.unitPrice);
      const taxPercent = item.isTaxExempt ? 0 : item.defaultTaxPercent ?? 0;
      const line: ResolvedDraftLine = {
        itemId: item.id,
        itemName: item.arabicName,
        quantity,
        unitPrice,
        lineTotal: roundMoney(quantity * unitPrice),
        unitId: item.unitId,
        conversionFactor: item.conversionFactor,
        taxPercent,
        isService: item.isService,
      };
      if (!item.isService) {
        const available = await this.catalog.getWarehouseQty(companyId, warehouseId, item.id);
        line.availableQty = available;
        if (available < quantity) {
          warnings.push(
            `الكمية غير كافية للصنف «${item.arabicName}». المتاح: ${available} — المطلوب: ${quantity}`
          );
        }
      }
      lines.push(line);
    }

    return { lines, warnings };
  }

  private toInvoiceLines(lines: ResolvedDraftLine[]) {
    return lines.map((line, index) => ({
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: line.quantity,
      baseQuantity: line.quantity * line.conversionFactor,
      price: line.unitPrice,
      taxPercent: line.taxPercent,
      lineOrder: index + 1,
    }));
  }

  private async persistCard(input: {
    context: SecurityContext;
    actionType: AiActionType;
    titleAr: string;
    partyName?: string;
    warehouseName?: string;
    notes?: string;
    isCash?: boolean;
    lines: ResolvedDraftLine[];
    totals: { subtotal: number; tax: number; total: number; currency: string };
    draftPayload: Record<string, unknown>;
    warnings: string[];
  }): Promise<PreparedActionResult> {
    const previewLines = input.lines.map((line) => ({
      name: line.itemName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.lineTotal,
    }));
    const summaryDisplay = {
      title: input.titleAr,
      actionType: input.actionType,
      customerName: input.partyName,
      partyName: input.partyName,
      itemsCount: input.lines.length,
      totalAmount: input.totals.total,
      subtotal: input.totals.subtotal,
      taxAmount: input.totals.tax,
      netAmount: input.totals.total,
      currency: input.totals.currency,
      lines: input.lines,
      notes: input.notes,
      warehouseName: input.warehouseName,
      isCash: input.isCash,
      stockWarnings: input.warnings,
    };
    const actionCard = {
      actionType: input.actionType,
      titleAr: input.titleAr,
      summary: {
        partyName: input.partyName,
        warehouseName: input.warehouseName,
        totalAmount: input.totals.total,
        itemsCount: input.lines.length,
        subtotal: input.totals.subtotal,
        taxAmount: input.totals.tax,
        netAmount: input.totals.total,
      },
      draftPayload: input.draftPayload,
      previewLines,
    };

    const action = await this.pending.create({
      conversationId: input.context.conversationId as string,
      companyId: input.context.companyId,
      userId: input.context.userId,
      actionType: input.actionType,
      requiredPermission: AI_ACTION_PERMISSIONS[input.actionType],
      payload: {
        ...input.draftPayload,
        actionCard,
      },
      summaryDisplay,
    });

    return {
      actionId: action.id,
      actionType: input.actionType,
      status: 'PENDING',
      confirmationRequired: true,
      isActionCard: true,
      instruction: CONFIRM_INSTRUCTION,
      expiresAt: action.expiresAt.toISOString(),
      summaryDisplay,
      resolvedItems: input.lines,
      totals: input.totals,
      actionCard,
    };
  }
}
