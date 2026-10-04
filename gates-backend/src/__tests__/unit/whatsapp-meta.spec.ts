import crypto from 'crypto';
import { classifyMetaError } from '../../modules/whatsapp/meta-cloud.provider';
import { maskWhatsAppRecipient, normalizeWhatsAppRecipient } from '../../modules/whatsapp/phone';

describe('WhatsApp phone and Meta errors', () => {
  it('normalizes Egyptian mobiles and rejects ambiguous local numbers', () => {
    expect(normalizeWhatsAppRecipient('0100 123 4567')).toBe('201001234567');
    expect(normalizeWhatsAppRecipient('+20 100 123 4567')).toBe('201001234567');
    expect(() => normalizeWhatsAppRecipient('12345')).toThrow();
    expect(maskWhatsAppRecipient('201001234567')).toBe('201******567');
  });

  it('maps Meta failures to permanent and transient codes without echoing secrets', () => {
    expect(classifyMetaError(401, { error: { code: 190, message: 'token EAAGSECRET' } }).code).toBe('WHATSAPP_AUTH_FAILED');
    expect(classifyMetaError(401, { error: { code: 190, message: 'token EAAGSECRET' } }).message).not.toMatch(/EAA/);
    expect(classifyMetaError(400, { error: { code: 132000 } }).transient).toBe(false);
    expect(classifyMetaError(429, { error: { code: 130429 } }).transient).toBe(true);
    expect(classifyMetaError(500, { error: { code: 1 } }).transient).toBe(true);
  });

  it('rejects a webhook signature that was not signed with the app secret', () => {
    const body = Buffer.from('{"entry":[]}');
    const good = `sha256=${crypto.createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
    const bad = `sha256=${crypto.createHmac('sha256', 'other').update(body).digest('hex')}`;
    const check = (header: string, secret: string) => {
      const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
      const left = Buffer.from(header);
      const right = Buffer.from(expected);
      return left.length === right.length && crypto.timingSafeEqual(left, right);
    };
    expect(check(good, 'app-secret')).toBe(true);
    expect(check(bad, 'app-secret')).toBe(false);
  });
});
