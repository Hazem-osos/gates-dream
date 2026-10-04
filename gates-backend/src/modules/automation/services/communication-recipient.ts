/**
 * Resolves an automation email recipient inside the caller's company.
 * Manual addresses and event-bound strings are validated. Entity sources
 * load the email from that company's customer, supplier, or user row.
 */
import prisma from '../../../shared/database/prisma';
import { resolveConfigValue } from '../catalog/binding';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientSource = 'manual' | 'customer' | 'supplier' | 'user';

export class RecipientResolutionError extends Error {
  constructor(
    public readonly code: 'EMAIL_RECIPIENT_MISSING' | 'EMAIL_RECIPIENT_INVALID',
    message: string
  ) {
    super(message);
    this.name = 'RecipientResolutionError';
  }
}

export function assertEmailAddress(value: string): string {
  const email = value.trim();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    throw new RecipientResolutionError('EMAIL_RECIPIENT_INVALID', 'Recipient email is invalid');
  }
  return email;
}

export async function resolveEmailRecipient(input: {
  companyId: string;
  eventData?: Record<string, unknown>;
  config: Record<string, unknown>;
}): Promise<string> {
  const sourceRaw = input.config.recipientSource;
  const source: RecipientSource =
    sourceRaw === 'customer' || sourceRaw === 'supplier' || sourceRaw === 'user' || sourceRaw === 'manual'
      ? sourceRaw
      : 'manual';

  if (source === 'manual') {
    const resolved = resolveConfigValue(input.config.to, input.eventData);
    if (typeof resolved !== 'string' || !resolved.trim()) {
      throw new RecipientResolutionError('EMAIL_RECIPIENT_MISSING', 'Recipient email is missing');
    }
    return assertEmailAddress(resolved);
  }

  const idKey = source === 'customer' ? 'customerId' : source === 'supplier' ? 'supplierId' : 'userId';
  const entityId = input.eventData?.[idKey];
  if (typeof entityId !== 'string' || !entityId.trim()) {
    throw new RecipientResolutionError(
      'EMAIL_RECIPIENT_MISSING',
      `Event payload has no ${idKey} for recipient source "${source}"`
    );
  }

  const where = { id: entityId, companyId: input.companyId };
  const row =
    source === 'customer'
      ? await prisma.customer.findFirst({ where, select: { email: true } })
      : source === 'supplier'
        ? await prisma.supplier.findFirst({ where, select: { email: true } })
        : await prisma.user.findFirst({ where, select: { email: true } });

  if (!row?.email) {
    throw new RecipientResolutionError('EMAIL_RECIPIENT_MISSING', 'Recipient email is missing');
  }
  return assertEmailAddress(row.email);
}
