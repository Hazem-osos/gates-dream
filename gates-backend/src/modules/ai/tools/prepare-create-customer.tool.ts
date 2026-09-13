import { z } from 'zod';
import {
  AI_ACTION_PERMISSIONS,
  AI_ACTION_TYPES,
  type PreparedActionResult,
} from '../actions/action-types';
import type { AiPendingActionStore } from '../actions/pending-action.store';
import type { WriteCatalogPort } from '../actions/write-catalog.port';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  nameAr: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  taxNumber: z.string().trim().max(60).optional(),
  creditLimit: z.number().nonnegative().optional(),
});

type Params = z.infer<typeof paramsSchema>;

const CONFIRM_INSTRUCTION =
  'Draft only. Ask the user to confirm the card in the UI (تأكيد وإنشاء). Do not say the customer was created.';

export class PrepareCreateCustomerTool extends BaseAiTool<Params, PreparedActionResult> {
  readonly name = 'prepareCreateCustomer';
  readonly description =
    'Prepare a customer card draft for user confirmation. Checks duplicate phone/tax. Never creates the customer.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = AI_ACTION_PERMISSIONS.CREATE_CUSTOMER;

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

    const duplicate = await this.catalog.findDuplicateCustomer(context.companyId, {
      phone: params.phone,
      taxNumber: params.taxNumber,
    });
    if (duplicate) {
      const field = duplicate.field === 'phone' ? 'رقم الهاتف' : 'الرقم الضريبي';
      throw new Error(`عميل موجود مسبقاً بنفس ${field}: ${duplicate.arabicName}`);
    }

    const summaryDisplay = {
      title: 'مسودة عميل جديد',
      actionType: AI_ACTION_TYPES.CREATE_CUSTOMER,
      customerName: params.nameAr,
      itemsCount: 0,
      totalAmount: 0,
      currency: 'EGP',
      phone: params.phone,
      taxNumber: params.taxNumber,
      creditLimit: params.creditLimit,
    };

    const payload = {
      arabicName: params.nameAr,
      phone1: params.phone,
      mobile: params.phone,
      taxAuthority: params.taxNumber,
      taxData: Boolean(params.taxNumber),
      creditLimit: params.creditLimit ?? null,
    };

    const action = await this.pending.create({
      conversationId: context.conversationId,
      companyId: context.companyId,
      userId: context.userId,
      actionType: AI_ACTION_TYPES.CREATE_CUSTOMER,
      requiredPermission: this.requiredPermission,
      payload,
      summaryDisplay,
    });

    return {
      actionId: action.id,
      actionType: AI_ACTION_TYPES.CREATE_CUSTOMER,
      status: 'PENDING',
      confirmationRequired: true,
      instruction: CONFIRM_INSTRUCTION,
      expiresAt: action.expiresAt.toISOString(),
      summaryDisplay,
    };
  }
}
