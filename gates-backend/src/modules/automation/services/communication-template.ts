/**
 * Safe {{field}} renderer. Only keys declared on the event catalog are
 * substituted. No expressions, no eval, no database access.
 */
import { getEventDefinition } from '../catalog/event-catalog';

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export class CommunicationTemplateError extends Error {
  constructor(
    public readonly code: 'EMAIL_TEMPLATE_INVALID',
    message: string
  ) {
    super(message);
    this.name = 'CommunicationTemplateError';
  }
}

export function renderCommunicationTemplate(
  template: string,
  eventType: string,
  eventData: Record<string, unknown> | undefined
): string {
  const event = getEventDefinition(eventType);
  const allowed = new Set((event?.fields ?? []).map((field) => field.key));
  const missing: string[] = [];
  const rendered = template.replace(TOKEN, (_match, key: string) => {
    if (!allowed.has(key)) {
      missing.push(key);
      return '';
    }
    const value = eventData?.[key];
    if (value == null || value === '') {
      missing.push(key);
      return '';
    }
    if (typeof value === 'object') {
      missing.push(key);
      return '';
    }
    return String(value);
  });
  if (missing.length) {
    throw new CommunicationTemplateError(
      'EMAIL_TEMPLATE_INVALID',
      `Missing or undeclared template variable: ${[...new Set(missing)].join(', ')}`
    );
  }
  return rendered;
}
