import { AppError } from '../../../shared/middleware/error-handler';
import { itemService } from '../../inventory/services/item.service';
import {
  AI_ACTION_PERMISSIONS,
  AI_ACTION_TYPES,
  type AiActionLineSummary,
  type AiActionSummaryDisplay,
} from '../actions/action-types';
import { aiPendingActionStore, type AiPendingActionStore } from '../actions/pending-action.store';
import { aiConversationStore, type ConversationActor } from '../services/ai-conversation.store';
import { entityResolverService } from './entity-resolver.service';
import { invoiceOcrService } from './invoice-ocr.service';
import type { ResolvedOcrInvoice, ResolvedOcrLine } from './invoice-ocr.types';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toInvoiceLines(lines: ResolvedOcrLine[]) {
  return lines
    .filter((line) => line.itemId && line.unitId)
    .map((line, index) => ({
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: line.quantity,
      baseQuantity: line.quantity * (line.conversionFactor || 1),
      price: line.unitPrice,
      taxPercent: line.taxPercent,
      lineOrder: index + 1,
    }));
}

function summaryLines(lines: ResolvedOcrLine[]): AiActionLineSummary[] {
  return lines.map((line) => ({
    itemId: line.itemId || '',
    itemName: line.itemName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.total,
    rawItemName: line.rawItemName,
    needsCreation: line.needsCreation,
    matchConfidence: line.matchConfidence,
  }));
}

function buildCard(resolved: ResolvedOcrInvoice) {
  const { extraction, supplier, warehouse, lines } = resolved;
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
  const taxAmount = roundMoney(extraction.taxAmount || 0);
  const total = roundMoney(extraction.totalAmount || subtotal + taxAmount);
  const titleAr = `مسودة فاتورة مشتريات - ${supplier.name}`;
  const unmatched = lines.filter((line) => line.needsCreation).length;
  const warnings = [
    !supplier.matched ? 'المورد غير مطابق في الدليل. راجع الاسم أو الرقم الضريبي قبل الاعتماد.' : '',
    !warehouse ? 'لم يُعثر على مخزن افتراضي. افتح الشاشة واختر المخزن.' : '',
    unmatched ? `${unmatched} صنف يحتاج تعريفاً قبل الاعتماد.` : '',
  ].filter(Boolean);

  const draftPayload = {
    invoiceType: 'purchase' as const,
    date: extraction.date ? `${extraction.date}T00:00:00.000Z` : new Date().toISOString(),
    currencyCode: 'EGP',
    supplierId: supplier.id,
    warehouseId: warehouse?.id,
    paymentMethod: 'credit',
    description: [
      extraction.invoiceNumber ? `فاتورة مورد رقم ${extraction.invoiceNumber}` : 'مستخرجة بالـ OCR',
      extraction.supplierTaxNumber ? `ضريبي: ${extraction.supplierTaxNumber}` : '',
    ]
      .filter(Boolean)
      .join(' — '),
    lines: toInvoiceLines(lines),
  };

  const previewLines = lines.map((line) => ({
    name: line.itemName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.total,
    rawItemName: line.rawItemName,
    needsCreation: line.needsCreation,
    matchConfidence: line.matchConfidence,
  }));

  const summaryDisplay: AiActionSummaryDisplay = {
    title: titleAr,
    actionType: AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE,
    customerName: supplier.name,
    partyName: supplier.name,
    itemsCount: lines.length,
    totalAmount: total,
    subtotal,
    taxAmount,
    netAmount: total,
    currency: 'EGP',
    lines: summaryLines(lines),
    warehouseName: warehouse?.arabicName,
    taxNumber: supplier.taxNumber || extraction.supplierTaxNumber,
    notes: extraction.invoiceNumber,
    stockWarnings: warnings,
    ocr: {
      source: extraction.source,
      invoiceNumber: extraction.invoiceNumber,
      supplierConfidence: supplier.confidence,
      supplierMatched: supplier.matched,
      unmatchedCount: unmatched,
    },
  };

  const actionCard = {
    actionType: AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE,
    titleAr,
    summary: {
      partyName: supplier.name,
      warehouseName: warehouse?.arabicName,
      totalAmount: total,
      itemsCount: lines.length,
      subtotal,
      taxAmount,
      netAmount: total,
      invoiceNumber: extraction.invoiceNumber,
      taxNumber: supplier.taxNumber || extraction.supplierTaxNumber,
      supplierConfidence: supplier.confidence,
      supplierMatched: supplier.matched,
    },
    draftPayload,
    previewLines,
  };

  return { titleAr, draftPayload, summaryDisplay, actionCard, warnings };
}

export class IngestPurchaseInvoiceService {
  constructor(private readonly pending: AiPendingActionStore = aiPendingActionStore) {}

  async ingest(
    actor: ConversationActor,
    input: {
      conversationId?: string;
      fileName: string;
      mimeType: string;
      buffer: Buffer;
      caption?: string;
    }
  ) {
    const conversation = input.conversationId
      ? await aiConversationStore.requireConversation(input.conversationId, actor)
      : await aiConversationStore.createConversation(actor, 'فاتورة مشتريات من صورة');

    const extraction = await invoiceOcrService.extract({
      buffer: input.buffer,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
    if (!extraction.lines.length) {
      throw new AppError(422, 'لم يُعثر على بنود في الفاتورة. أعد تصوير الورقة بوضوح.');
    }

    const resolved = await entityResolverService.resolve(actor.companyId, extraction);
    const built = buildCard(resolved);
    const action = await this.pending.create({
      conversationId: conversation.id,
      companyId: actor.companyId,
      userId: actor.userId,
      actionType: AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE,
      requiredPermission: AI_ACTION_PERMISSIONS.DRAFT_PURCHASE_INVOICE,
      payload: {
        ...built.draftPayload,
        actionCard: built.actionCard,
        ocrLines: resolved.lines,
      },
      summaryDisplay: built.summaryDisplay,
    });

    const caption = input.caption?.trim() || `مرفق فاتورة: ${input.fileName}`;
    await aiConversationStore.appendMessage(conversation.id, 'user', caption);
    await aiConversationStore.appendMessage(
      conversation.id,
      'assistant',
      [
        `استخرجت فاتورة المشتريات${extraction.invoiceNumber ? ` رقم ${extraction.invoiceNumber}` : ''} من المرفق.`,
        supplierLine(resolved),
        'راجع المطابقة ثم اضغط اعتماد فاتورة مشتريات مسودة.',
        '',
        '```json',
        JSON.stringify({
          actionId: action.id,
          isActionCard: true,
          actionType: AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE,
          actionCard: built.actionCard,
        }),
        '```',
      ].join('\n')
    );

    return {
      conversationId: conversation.id,
      action,
      extraction,
      supplier: resolved.supplier,
      lines: resolved.lines,
    };
  }

  async createMissingItem(
    actor: ConversationActor,
    actionId: string,
    lineIndex: number
  ) {
    const row = await this.pending.requireOwned(actionId, actor);
    if (row.status !== 'PENDING') throw new AppError(409, 'هذا الإجراء لم يعد معلقاً');
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const ocrLines = Array.isArray(payload.ocrLines) ? [...payload.ocrLines] : [];
    const line = ocrLines[lineIndex] as ResolvedOcrLine | undefined;
    if (!line?.rawItemName) throw new AppError(400, 'سطر الصنف غير موجود');

    const created = await itemService.createItem(actor.companyId, {
      arabicName: line.rawItemName,
      priceRetail: line.unitPrice,
      beginningCostPrice: line.unitPrice,
    });
    const unit = await entityResolverService.ensureItemUnit(actor.companyId, created.id);
    const nextLine: ResolvedOcrLine = {
      ...line,
      itemId: created.id,
      itemName: created.arabicName || line.rawItemName,
      unitId: unit.unitId,
      conversionFactor: unit.conversionFactor,
      needsCreation: false,
      matchConfidence: 100,
    };
    ocrLines[lineIndex] = nextLine;

    const resolved: ResolvedOcrInvoice = {
      extraction: {
        supplierName: String((row.summaryDisplay as { partyName?: string })?.partyName ?? ''),
        supplierTaxNumber: String((row.summaryDisplay as { taxNumber?: string })?.taxNumber ?? ''),
        invoiceNumber: String((row.summaryDisplay as { notes?: string })?.notes ?? ''),
        lines: [],
        totalAmount: Number((row.summaryDisplay as { totalAmount?: number })?.totalAmount ?? 0),
        taxAmount: Number((row.summaryDisplay as { taxAmount?: number })?.taxAmount ?? 0),
        source: 'vision',
      },
      supplier: {
        id: typeof payload.supplierId === 'string' ? payload.supplierId : undefined,
        name: String((row.summaryDisplay as { partyName?: string })?.partyName ?? ''),
        taxNumber: String((row.summaryDisplay as { taxNumber?: string })?.taxNumber ?? ''),
        confidence: 100,
        matched: Boolean(payload.supplierId),
      },
      warehouse: typeof payload.warehouseId === 'string'
        ? { id: payload.warehouseId, arabicName: String((row.summaryDisplay as { warehouseName?: string })?.warehouseName ?? '') }
        : undefined,
      lines: ocrLines as ResolvedOcrLine[],
    };
    const built = buildCard(resolved);
    return this.pending.updateDraft(actionId, {
      payload: { ...built.draftPayload, actionCard: built.actionCard, ocrLines },
      summaryDisplay: built.summaryDisplay,
    });
  }
}

function supplierLine(resolved: ResolvedOcrInvoice): string {
  const { supplier } = resolved;
  if (supplier.matched) {
    return `المورد المطابق: ${supplier.name} (ثقة ${supplier.confidence}%).`;
  }
  return `المورد المستخرج «${supplier.name}» غير موجود في الدليل.`;
}

export const ingestPurchaseInvoiceService = new IngestPurchaseInvoiceService();
