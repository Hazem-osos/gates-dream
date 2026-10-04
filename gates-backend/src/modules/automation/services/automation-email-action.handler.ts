/**
 * email.send — GATES sends through the company's SMTP settings.
 * n8n only decides when; it never receives host, username, or password.
 * The AutomationActionRun claim (company + event + rule + action type,
 * plus actionIndex when the caller sends one) is what stops a replay
 * from sending the same message again. SMTP itself cannot promise
 * exactly-once if the server accepted the message and the HTTP response
 * was lost; the claim still blocks a second send on retry.
 */
import crypto from 'crypto';
import { resolveConfigValue } from '../catalog/binding';
import { CompanyEmailError, sendCompanyEmail } from '../../company/services/company-email.service';
import { renderCommunicationTemplate, CommunicationTemplateError } from './communication-template';
import { RecipientResolutionError, resolveEmailRecipient } from './communication-recipient';
import { SEND_EMAIL_ACTION } from '../catalog/action-catalog';
import {
  AutomationActionDispatchError,
  type ActionExecutionContext,
  type ActionExecutionResult,
  type ActionHandler,
} from './automation-action-dispatch.types';

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AutomationActionDispatchError(400, `Config field "${field}" resolved to an empty value`, 'EMAIL_TEMPLATE_INVALID');
  }
  return value.slice(0, maxLength);
}

export const emailActionHandler: ActionHandler = {
  actionType: SEND_EMAIL_ACTION,

  async execute(ctx: ActionExecutionContext): Promise<ActionExecutionResult> {
    let recipient: string;
    try {
      recipient = await resolveEmailRecipient({
        companyId: ctx.companyId,
        eventData: ctx.eventData,
        config: ctx.config,
      });
    } catch (error) {
      if (error instanceof RecipientResolutionError) {
        throw new AutomationActionDispatchError(400, error.message, error.code);
      }
      throw error;
    }

    const subjectRaw = requiredText(resolveConfigValue(ctx.config.subject, ctx.eventData), 'subject', 300);
    const bodyRaw = requiredText(resolveConfigValue(ctx.config.body, ctx.eventData), 'body', 10_000);
    let subject: string;
    let body: string;
    try {
      subject = renderCommunicationTemplate(subjectRaw, ctx.eventType, ctx.eventData);
      body = renderCommunicationTemplate(bodyRaw, ctx.eventType, ctx.eventData);
    } catch (error) {
      if (error instanceof CommunicationTemplateError) {
        throw new AutomationActionDispatchError(400, error.message, error.code);
      }
      throw error;
    }

    try {
      const sent = await sendCompanyEmail(ctx.companyId, { to: recipient, subject, text: body });
      return {
        resultEntityType: 'EmailSend',
        resultEntityId: crypto.randomUUID(),
        resultMetadata: {
          provider: sent.provider,
          messageId: sent.messageId,
          recipient: sent.recipient,
          subject,
        },
      };
    } catch (error) {
      if (error instanceof CompanyEmailError) {
        throw new AutomationActionDispatchError(error.transient ? 503 : 400, error.message, error.code);
      }
      throw error;
    }
  },
};
