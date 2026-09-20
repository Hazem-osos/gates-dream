/**
 * email.send — reuses the existing centralized SMTP transport
 * (shared/services/email.service.ts) so SMTP credentials never leave
 * GATES (n8n never sees them). Fails soft (logs only) if SMTP isn't
 * configured, matching emailService's own documented convention — but
 * still marks the AutomationActionRun as SUCCEEDED only when a real send
 * was attempted against a configured transport; if SMTP is unconfigured,
 * this is a permanent (400) configuration problem, not a transient one.
 */
import crypto from 'crypto';
import { emailService } from '../../../shared/services/email.service';
import { SEND_EMAIL_ACTION } from '../catalog/action-catalog';
import { resolveConfigValue } from '../catalog/binding';
import { AutomationActionDispatchError, type ActionExecutionContext, type ActionExecutionResult, type ActionHandler } from './automation-action-dispatch.types';

const RESULT_ENTITY_EMAIL = 'EmailSend';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AutomationActionDispatchError(400, `Config field "${field}" resolved to an empty value`);
  }
  return value.slice(0, maxLength);
}

export const emailActionHandler: ActionHandler = {
  actionType: SEND_EMAIL_ACTION,

  async execute(ctx: ActionExecutionContext): Promise<ActionExecutionResult> {
    const to = requiredString(resolveConfigValue(ctx.config.to, ctx.eventData), 'to', 500);
    const subject = requiredString(resolveConfigValue(ctx.config.subject, ctx.eventData), 'subject', 300);
    const body = requiredString(resolveConfigValue(ctx.config.body, ctx.eventData), 'body', 10_000);

    const recipients = to.split(',').map((address) => address.trim()).filter(Boolean);
    if (recipients.length === 0 || !recipients.every((address) => EMAIL_RE.test(address))) {
      throw new AutomationActionDispatchError(400, 'Config field "to" must contain one or more valid email addresses');
    }

    if (!emailService.isEmailConfigured()) {
      throw new AutomationActionDispatchError(
        400,
        'Email is not configured on this GATES environment (SMTP_HOST unset) — email.send cannot run'
      );
    }

    await emailService.sendEmail({ to: recipients.join(','), subject, text: body });

    return {
      resultEntityType: RESULT_ENTITY_EMAIL,
      // No persisted DB entity for a sent email — a stable synthetic id keyed
      // off this run's own claim key is sufficient for "already sent" checks.
      resultEntityId: crypto
        .createHash('sha256')
        .update(`${ctx.companyId}:${ctx.eventId}:${ctx.ruleId}:${SEND_EMAIL_ACTION}`)
        .digest('hex'),
      resultMetadata: { subject, recipients: recipients.length },
    };
  },
};
