import { AiActionStatus } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { customerService } from '../../accounting/services/customer.service';
import { invoiceService } from '../../inventory/services/invoice.service';
import { issueService } from '../../inventory/services/issue.service';
import { priceQuoteService } from '../../inventory/services/price-quote.service';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import type { ConversationActor } from '../services/ai-conversation.store';
import type { SecurityContext } from '../tools/types';
import { AI_ACTION_TYPES } from './action-types';
import { aiPendingActionStore, type AiPendingActionStore } from './pending-action.store';
import { conversationOwnerWhere } from '../services/ai-conversation.store';
import prisma from '../../../shared/database/prisma';

function hasPermission(context: SecurityContext, required: string): boolean {
  const granted = context.permissions ?? [];
  if (granted.includes(required) || granted.includes('*') || granted.includes('*:*')) return true;
  if (required === 'INVOICE_CREATE') return hasPermission(context, 'invoice:edit');
  if (required === 'CUSTOMER_CREATE') return hasPermission(context, 'customer:edit');
  const [resource] = required.split(':');
  return Boolean(resource && granted.includes(`${resource}:*`));
}

function entityHref(actionType: string, id: string): string | null {
  if (actionType === AI_ACTION_TYPES.CREATE_INVOICE || actionType === AI_ACTION_TYPES.DRAFT_SALES_INVOICE) {
    return `/inventory/operations/sales-invoice?invoiceId=${id}`;
  }
  if (actionType === AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE) {
    return `/inventory/operations/final-purchase-invoice?invoiceId=${id}`;
  }
  if (actionType === AI_ACTION_TYPES.DRAFT_STOCK_ISSUE) {
    return `/inventory/operations/issue?id=${id}`;
  }
  if (actionType === AI_ACTION_TYPES.DRAFT_PAYMENT_VOUCHER) {
    return `/accounting/operations/treasury/payment?id=${id}`;
  }
  if (actionType === AI_ACTION_TYPES.CREATE_QUOTATION) {
    return `/inventory/operations/price-quote`;
  }
  if (actionType === AI_ACTION_TYPES.CREATE_CUSTOMER) {
    return `/accounting/cards/customer`;
  }
  return null;
}

function unwrapDraftPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const card = payload.actionCard;
  if (card && typeof card === 'object') {
    const draft = (card as { draftPayload?: unknown }).draftPayload;
    if (draft && typeof draft === 'object') return draft as Record<string, unknown>;
  }
  return payload;
}

export class AiActionExecutionService {
  constructor(private readonly store: AiPendingActionStore = aiPendingActionStore) {}

  async listForConversation(conversationId: string, actor: ConversationActor) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, ...conversationOwnerWhere(actor) },
      select: { id: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');
    return this.store.listForConversation(conversationId, actor);
  }

  async getAction(actionId: string, actor: ConversationActor) {
    return this.store.requireOwned(actionId, actor);
  }

  async acknowledge(
    actionId: string,
    actor: ConversationActor,
    input: { resultingEntityId: string; documentNumber?: string }
  ) {
    const row = await this.store.requireOwned(actionId, actor);
    if (row.status !== AiActionStatus.PENDING) {
      throw new AppError(409, 'هذا الإجراء لم يعد معلقاً');
    }
    const updated = await this.store.markExecuted(actionId, input.resultingEntityId);
    await prisma.aiAuditLog.create({
      data: {
        userId: actor.userId,
        companyId: actor.companyId,
        action: 'action.acknowledge',
        metadata: {
          actionId,
          actionType: row.actionType,
          resultingEntityId: input.resultingEntityId,
          documentNumber: input.documentNumber,
        },
        ipAddress: actor.ipAddress?.slice(0, 45),
      },
    });
    return {
      ...updated,
      openUrl: entityHref(row.actionType, input.resultingEntityId),
      documentNumber: input.documentNumber,
    };
  }

  async reject(actionId: string, actor: ConversationActor) {
    const row = await this.store.requireOwned(actionId, actor);
    if (row.status !== AiActionStatus.PENDING) {
      throw new AppError(409, 'لا يمكن إلغاء هذا الإجراء');
    }
    const updated = await this.store.markRejected(actionId);
    await prisma.aiAuditLog.create({
      data: {
        userId: actor.userId,
        companyId: actor.companyId,
        action: 'action.reject',
        metadata: { actionId, actionType: row.actionType },
        ipAddress: actor.ipAddress?.slice(0, 45),
      },
    });
    return updated;
  }

  async confirm(actionId: string, actor: ConversationActor, security: SecurityContext) {
    const row = await this.store.requireOwned(actionId, actor);
    if (row.userId !== security.userId || row.companyId !== security.companyId) {
      throw new AppError(404, 'Action not found');
    }
    if (!hasPermission(security, row.requiredPermission)) {
      throw new AppError(403, 'لا صلاحية لتنفيذ هذا الإجراء');
    }
    if (row.status !== AiActionStatus.PENDING) {
      throw new AppError(409, 'هذا الإجراء لم يعد معلقاً');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.store.markExpired(actionId);
      throw new AppError(410, 'انتهت صلاحية المسودة. اطلب من المساعد المالى إعدادها من جديد.');
    }

    const conversation = await prisma.aiConversation.findFirst({
      where: { id: row.conversationId, ...conversationOwnerWhere(actor) },
      select: { id: true },
    });
    if (!conversation) throw new AppError(404, 'Action not found');

    try {
      const created = await this.executePayload(row.actionType, actor.companyId, row.payload);
      const updated = await this.store.markExecuted(actionId, created.id);
      await prisma.aiAuditLog.create({
        data: {
          userId: actor.userId,
          companyId: actor.companyId,
          action: 'action.confirm',
          metadata: {
            actionId,
            actionType: row.actionType,
            resultingEntityId: created.id,
            documentNumber: created.number,
            latencyMs: 0,
          },
          ipAddress: actor.ipAddress?.slice(0, 45),
        },
      });
      return {
        ...updated,
        openUrl: entityHref(row.actionType, created.id),
        documentNumber: created.number,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل إنشاء المستند';
      await this.store.markFailed(actionId, message);
      await prisma.aiAuditLog.create({
        data: {
          userId: actor.userId,
          companyId: actor.companyId,
          action: 'action.confirm.failed',
          metadata: { actionId, actionType: row.actionType, error: message },
          ipAddress: actor.ipAddress?.slice(0, 45),
        },
      });
      throw new AppError(422, message);
    }
  }

  private async executePayload(
    actionType: string,
    companyId: string,
    payload: unknown
  ): Promise<{ id: string; number?: string }> {
    const data = unwrapDraftPayload((payload ?? {}) as Record<string, unknown>);
    if (actionType === AI_ACTION_TYPES.CREATE_QUOTATION) {
      const quote = await priceQuoteService.createPriceQuote(companyId, {
        companyId,
        customerId: String(data.customerId),
        date: String(data.date ?? new Date().toISOString()),
        description: typeof data.description === 'string' ? data.description : undefined,
        branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
        paymentMethod: data.paymentMethod === 'cash' ? 'cash' : 'credit',
        lines: Array.isArray(data.lines) ? (data.lines as never) : [],
      });
      return { id: quote.id, number: (quote as { quoteNumber?: string }).quoteNumber };
    }
    if (
      actionType === AI_ACTION_TYPES.CREATE_INVOICE ||
      actionType === AI_ACTION_TYPES.DRAFT_SALES_INVOICE ||
      actionType === AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE
    ) {
      const invoiceType =
        actionType === AI_ACTION_TYPES.DRAFT_PURCHASE_INVOICE
          ? 'purchase'
          : data.invoiceType === 'purchase'
            ? 'purchase'
            : 'sales';
      const invoice = await invoiceService.createInvoice(companyId, {
        invoiceType,
        date: new Date(String(data.date ?? new Date().toISOString())),
        currencyCode: String(data.currencyCode ?? 'EGP'),
        customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
        supplierId: typeof data.supplierId === 'string' ? data.supplierId : undefined,
        warehouseId: String(data.warehouseId),
        paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : 'credit',
        description: typeof data.description === 'string' ? data.description : undefined,
        lines: Array.isArray(data.lines) ? (data.lines as never) : [],
      });
      if (!invoice?.id) throw new Error('فشل إنشاء الفاتورة');
      return {
        id: invoice.id,
        number: (invoice as { invoiceNumber?: string }).invoiceNumber,
      };
    }
    if (actionType === AI_ACTION_TYPES.DRAFT_STOCK_ISSUE) {
      const issue = await issueService.createIssue(companyId, {
        companyId,
        date: String(data.date ?? new Date().toISOString()),
        warehouseId: String(data.warehouseId),
        description: typeof data.description === 'string' ? data.description : undefined,
        lines: Array.isArray(data.lines) ? (data.lines as never) : [],
      });
      if (!issue?.id) throw new Error('فشل إنشاء إذن الصرف');
      return {
        id: issue.id,
        number: (issue as { serial?: string; serialNumber?: string }).serial
          ?? (issue as { serialNumber?: string }).serialNumber,
      };
    }
    if (actionType === AI_ACTION_TYPES.DRAFT_PAYMENT_VOUCHER) {
      const voucher = await cashTransactionService.create(
        companyId,
        undefined,
        undefined,
        {
          transactionKind: 'PAYMENT',
          date: new Date(String(data.date ?? new Date().toISOString())),
          amount: Number(data.amount),
          currencyCode: String(data.currencyCode ?? 'EGP'),
          supplierId: typeof data.supplierId === 'string' ? data.supplierId : undefined,
          customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
          description: typeof data.description === 'string' ? data.description : undefined,
          safeId: typeof data.safeId === 'string' ? data.safeId : undefined,
        }
      );
      return {
        id: voucher.id,
        number: (voucher as { voucherNumber?: string }).voucherNumber,
      };
    }
    if (actionType === AI_ACTION_TYPES.CREATE_CUSTOMER) {
      const customer = await customerService.createCustomer(companyId, {
        arabicName: String(data.arabicName),
        phone1: typeof data.phone1 === 'string' ? data.phone1 : undefined,
        mobile: typeof data.mobile === 'string' ? data.mobile : undefined,
        taxAuthority: typeof data.taxAuthority === 'string' ? data.taxAuthority : undefined,
        taxData: Boolean(data.taxData),
        creditLimit: typeof data.creditLimit === 'number' ? data.creditLimit : undefined,
      });
      return { id: customer.id, number: customer.arabicName };
    }
    throw new Error(`Unsupported action type: ${actionType}`);
  }
}

export const aiActionExecutionService = new AiActionExecutionService();
