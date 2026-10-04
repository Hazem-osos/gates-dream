/**
 * whatsapp.send — GATES sends a Meta-approved template from the company's
 * connected WhatsApp Business account. Manual wa.me sharing is a different
 * feature and is not used here.
 */
import crypto from 'crypto';
import { resolveConfigValue } from '../catalog/binding';
import { SEND_WHATSAPP_ACTION } from '../catalog/action-catalog';
import { renderCommunicationTemplate, CommunicationTemplateError } from './communication-template';
import { sendCompanyTemplate, WhatsAppConnectionError } from '../../whatsapp/whatsapp-connection.service';
import { normalizeWhatsAppRecipient, WhatsAppPhoneError } from '../../whatsapp/phone';
import prisma from '../../../shared/database/prisma';
import {
  AutomationActionDispatchError,
  type ActionExecutionContext,
  type ActionExecutionResult,
  type ActionHandler,
} from './automation-action-dispatch.types';

async function resolvePhone(ctx: ActionExecutionContext): Promise<string> {
  const source = ctx.config.recipientSource;
  if (source === 'customer' || source === 'supplier' || source === 'user') {
    const idKey = source === 'customer' ? 'customerId' : source === 'supplier' ? 'supplierId' : 'userId';
    const entityId = ctx.eventData?.[idKey];
    if (typeof entityId !== 'string' || !entityId) {
      throw new AutomationActionDispatchError(400, 'Recipient phone is missing', 'WHATSAPP_INVALID_RECIPIENT');
    }
    const where = { id: entityId, companyId: ctx.companyId };
    const row =
      source === 'customer'
        ? await prisma.customer.findFirst({ where, select: { mobile: true, phone1: true } })
        : source === 'supplier'
          ? await prisma.supplier.findFirst({ where, select: { mobile: true, phone1: true } })
          : await prisma.user.findFirst({ where, select: { phone: true } });
    const phone = row && 'phone' in row ? row.phone : row && 'mobile' in row ? row.mobile || row.phone1 : null;
    if (!phone) throw new AutomationActionDispatchError(400, 'Recipient phone is missing', 'WHATSAPP_INVALID_RECIPIENT');
    return phone;
  }
  const raw = resolveConfigValue(ctx.config.to, ctx.eventData);
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AutomationActionDispatchError(400, 'Recipient phone is missing', 'WHATSAPP_INVALID_RECIPIENT');
  }
  return raw;
}

function parameterValues(raw: unknown, eventType: string, eventData: Record<string, unknown> | undefined): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw.split(',').map((part) => {
    const token = part.trim();
    if (!token) throw new CommunicationTemplateError('EMAIL_TEMPLATE_INVALID', 'Empty template parameter');
    if (token.includes('{{')) return renderCommunicationTemplate(token, eventType, eventData);
    return token;
  });
}

export const whatsappActionHandler: ActionHandler = {
  actionType: SEND_WHATSAPP_ACTION,

  async execute(ctx: ActionExecutionContext): Promise<ActionExecutionResult> {
    const templateName = resolveConfigValue(ctx.config.templateName, ctx.eventData);
    const language = resolveConfigValue(ctx.config.templateLanguage, ctx.eventData) || 'ar';
    if (typeof templateName !== 'string' || !templateName.trim()) {
      throw new AutomationActionDispatchError(400, 'WhatsApp template is missing', 'WHATSAPP_TEMPLATE_NOT_FOUND');
    }
    let phone: string;
    try {
      phone = normalizeWhatsAppRecipient(await resolvePhone(ctx));
    } catch (error) {
      if (error instanceof WhatsAppPhoneError || error instanceof AutomationActionDispatchError) {
        if (error instanceof AutomationActionDispatchError) throw error;
        throw new AutomationActionDispatchError(400, error.message, 'WHATSAPP_INVALID_RECIPIENT');
      }
      throw error;
    }
    let parameters: string[];
    try {
      parameters = parameterValues(ctx.config.parameters, ctx.eventType, ctx.eventData);
    } catch (error) {
      if (error instanceof CommunicationTemplateError) {
        throw new AutomationActionDispatchError(400, error.message, 'WHATSAPP_TEMPLATE_PARAMETER_MISMATCH');
      }
      throw error;
    }
    try {
      const sent = await sendCompanyTemplate({
        companyId: ctx.companyId,
        to: phone,
        templateName,
        language: String(language),
        bodyParameters: parameters,
      });
      return {
        resultEntityType: 'WhatsappMessage',
        resultEntityId: crypto.randomUUID(),
        resultMetadata: {
          provider: sent.provider,
          messageId: sent.messageId,
          recipient: sent.recipient,
          template: templateName,
          status: sent.status,
        },
      };
    } catch (error) {
      if (error instanceof WhatsAppConnectionError) {
        throw new AutomationActionDispatchError(error.statusCode, error.message, error.code);
      }
      throw error;
    }
  },
};
