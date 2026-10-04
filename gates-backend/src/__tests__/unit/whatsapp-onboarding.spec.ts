import { claimActionType } from '../../modules/automation/services/automation-action-dispatch.service';

jest.mock('../../shared/config/env', () => ({
  env: {
    META_APP_ID: 'app-id',
    META_APP_SECRET: 'app-secret',
    META_EMBEDDED_SIGNUP_CONFIG_ID: 'config',
    META_GRAPH_VERSION: 'v25.0',
  },
}));

jest.mock('../../shared/security/secrets-manager', () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => String(value).replace(/^enc:/, ''),
}));

const rows = new Map<string, Record<string, unknown>>();
const messages: Array<Record<string, unknown>> = [];

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    companyWhatsappConfig: {
      findFirst: jest.fn(async ({ where }: { where: { companyId: string } }) => rows.get(where.companyId) ?? null),
      update: jest.fn(async ({ where, data }: { where: { companyId: string }; data: Record<string, unknown> }) => {
        const next = { ...(rows.get(where.companyId) ?? {}), ...data, updatedAt: new Date() };
        rows.set(where.companyId, next);
        return next;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const next = { id: `cfg-${data.companyId}`, updatedAt: new Date(), ...data };
        rows.set(String(data.companyId), next);
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { companyId: string }; data: Record<string, unknown> }) => {
        const current = rows.get(where.companyId);
        if (current) rows.set(where.companyId, { ...current, ...data, updatedAt: new Date() });
        return { count: current ? 1 : 0 };
      }),
    },
    whatsappOutboundMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        messages.push(data);
        return data;
      }),
    },
  },
}));

import {
  completeWhatsAppOnboarding,
  disconnectWhatsApp,
  isCompanyWhatsappReady,
  listCompanyTemplates,
  sendCompanyTemplate,
  signOnboardingState,
} from '../../modules/whatsapp/whatsapp-connection.service';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function installFetch(handlers: Array<{ match: string; response: Response }>) {
  global.fetch = jest.fn(async (url: string) => {
    const hit = handlers.find((item) => url.includes(item.match));
    if (!hit) throw new Error(`unexpected ${url}`);
    return hit.response;
  }) as typeof fetch;
}

const connectedPhone = {
  id: 'phone-1',
  display_phone_number: '+20 100 000 0000',
  status: 'CONNECTED',
  code_verification_status: 'VERIFIED',
};

function happyMeta() {
  installFetch([
    { match: 'oauth/access_token', response: json({ access_token: 'biz-token' }) },
    {
      match: 'debug_token',
      response: json({
        data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['waba-1'] }] },
      }),
    },
    { match: 'subscribed_apps', response: json({ success: true }) },
    { match: 'phone_numbers', response: json({ data: [connectedPhone] }) },
    { match: 'phone-1?fields', response: json(connectedPhone) },
    {
      match: 'message_templates',
      response: json({
        data: [
          { name: 'invoice_due', language: 'ar', status: 'APPROVED', category: 'UTILITY' },
          { name: 'draft', language: 'ar', status: 'REJECTED', category: 'MARKETING' },
        ],
      }),
    },
    { match: '/messages', response: json({ messages: [{ id: 'wamid.1' }] }) },
  ]);
}

describe('WhatsApp embedded signup', () => {
  beforeEach(() => {
    rows.clear();
    messages.length = 0;
  });

  it('completes signup only after the authorized phone is connected', async () => {
    happyMeta();
    const state = signOnboardingState(COMPANY);
    const status = await completeWhatsAppOnboarding({
      companyId: COMPANY,
      state,
      code: 'short-code',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    });
    expect(status.connectionState).toBe('CONNECTED');
    expect(status.connected).toBe(true);
    expect(status.phoneNumber).toContain('+20');
    expect(rows.get(COMPANY)?.accessToken).toBe('encrypted');
    expect(String(rows.get(COMPANY)?.accessTokenEncrypted).startsWith('enc:')).toBe(true);
    const called = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(called.some((url) => url.includes('/register'))).toBe(false);
  });

  it('registers a verified phone that is not connected yet', async () => {
    const pending = { ...connectedPhone, status: 'PENDING' };
    let phoneReads = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('oauth/access_token')) return json({ access_token: 'biz-token' });
      if (url.includes('debug_token')) {
        return json({ data: { granular_scopes: [{ scope: 'whatsapp_business_messaging', target_ids: ['waba-1'] }] } });
      }
      if (url.includes('subscribed_apps')) return json({ success: true });
      if (url.includes('phone_numbers')) return json({ data: [pending] });
      if (url.includes('/register')) return json({ success: true });
      if (url.includes('phone-1')) {
        phoneReads += 1;
        return json(phoneReads === 1 ? pending : connectedPhone);
      }
      throw new Error(url);
    }) as typeof fetch;
    const status = await completeWhatsAppOnboarding({
      companyId: COMPANY,
      state: signOnboardingState(COMPANY),
      code: 'short-code',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    });
    expect(status.connectionState).toBe('CONNECTED');
    expect((global.fetch as jest.Mock).mock.calls.some((call) => String(call[0]).includes('/register'))).toBe(true);
  });

  it('does not connect when registration fails', async () => {
    const pending = { ...connectedPhone, status: 'PENDING' };
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('oauth/access_token')) return json({ access_token: 'biz-token' });
      if (url.includes('debug_token')) {
        return json({ data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['waba-1'] }] } });
      }
      if (url.includes('subscribed_apps')) return json({ success: true });
      if (url.includes('phone_numbers')) return json({ data: [pending] });
      if (url.includes('/register')) return json({ error: { code: 133005, message: 'pin mismatch secret' } }, 400);
      if (url.includes('phone-1')) return json(pending);
      throw new Error(url);
    }) as typeof fetch;
    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: signOnboardingState(COMPANY),
        code: 'short-code',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'WHATSAPP_PHONE_REGISTRATION_FAILED' });
    expect(rows.get(COMPANY)?.connectionStatus).toBe('error');
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(false);
  });

  it('rejects a foreign state, a foreign WABA, a foreign phone, and an expired code', async () => {
    happyMeta();
    await expect(
      completeWhatsAppOnboarding({
        companyId: OTHER,
        state: signOnboardingState(COMPANY),
        code: 'short-code',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });

    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: 'not-a-state',
        code: 'short-code',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });

    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: signOnboardingState(COMPANY),
        code: 'short-code',
        wabaId: 'waba-other',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });

    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: signOnboardingState(COMPANY),
        code: 'short-code',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-other',
      })
    ).rejects.toMatchObject({ code: 'PHONE_MISMATCH' });

    installFetch([
      { match: 'oauth/access_token', response: json({ error: { code: 100, message: 'authorization code has expired' } }, 400) },
    ]);
    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: signOnboardingState(COMPANY),
        code: 'expired',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('keeps approved templates inside the tenant and retains messages after disconnect', async () => {
    happyMeta();
    await completeWhatsAppOnboarding({
      companyId: COMPANY,
      state: signOnboardingState(COMPANY),
      code: 'short-code',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    });
    const all = await listCompanyTemplates(COMPANY);
    expect(all.map((row) => row.status).sort()).toEqual(['APPROVED', 'REJECTED']);
    expect(all.find((row) => row.name === 'draft')?.usable).toBe(false);
    const usable = await listCompanyTemplates(COMPANY, { usableOnly: true });
    expect(usable).toEqual([expect.objectContaining({ name: 'invoice_due', usable: true })]);
    await expect(
      sendCompanyTemplate({
        companyId: COMPANY,
        to: '01001234567',
        templateName: 'draft',
        language: 'ar',
        bodyParameters: [],
      })
    ).rejects.toMatchObject({ code: 'WHATSAPP_TEMPLATE_NOT_FOUND' });
    await sendCompanyTemplate({
      companyId: COMPANY,
      to: '01001234567',
      templateName: 'invoice_due',
      language: 'ar',
      bodyParameters: ['Hazem'],
    });
    expect(messages).toHaveLength(1);
    await disconnectWhatsApp(COMPANY);
    expect(messages).toHaveLength(1);
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(false);
    expect(rows.get(COMPANY)?.accessTokenEncrypted).toBeNull();
  });

  it('treats an already registered phone as ready and replaces the credential on reconnect', async () => {
    const pending = { ...connectedPhone, status: 'PENDING' };
    let phoneReads = 0;
    let exchanges = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('oauth/access_token')) {
        exchanges += 1;
        return json({ access_token: exchanges === 1 ? 'biz-token' : 'biz-token-2' });
      }
      if (url.includes('debug_token')) {
        return json({ data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['waba-1'] }] } });
      }
      if (url.includes('subscribed_apps')) return json({ success: true });
      if (url.includes('phone_numbers')) return json({ data: [pending] });
      if (url.includes('/register')) return json({ error: { message: 'Phone number already registered', code: 100 } }, 400);
      if (url.includes('phone-1')) {
        phoneReads += 1;
        return json(phoneReads === 1 ? pending : connectedPhone);
      }
      throw new Error(url);
    }) as typeof fetch;
    const first = await completeWhatsAppOnboarding({
      companyId: COMPANY,
      state: signOnboardingState(COMPANY),
      code: 'short-code',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    });
    expect(first.connectionState).toBe('CONNECTED');
    const stored = String(rows.get(COMPANY)?.accessTokenEncrypted);
    phoneReads = 0;
    const second = await completeWhatsAppOnboarding({
      companyId: COMPANY,
      state: signOnboardingState(COMPANY),
      code: 'next-code',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    });
    expect(second.connectionState).toBe('CONNECTED');
    expect(String(rows.get(COMPANY)?.accessTokenEncrypted)).not.toBe(stored);
  });

  it('keeps send disabled until the connection is connected', async () => {
    rows.set(COMPANY, { connectionStatus: 'disconnected', isActive: false, accessTokenEncrypted: null, phoneNumberId: null });
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(false);
    rows.set(COMPANY, { connectionStatus: 'connecting', isActive: false, accessTokenEncrypted: 'enc:x', phoneNumberId: 'phone-1' });
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(false);
    rows.set(COMPANY, { connectionStatus: 'error', isActive: false, accessTokenEncrypted: 'enc:x', phoneNumberId: 'phone-1' });
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(false);
    rows.set(COMPANY, {
      connectionStatus: 'connected',
      isActive: true,
      accessTokenEncrypted: 'enc:{"token":"t"}',
      phoneNumberId: 'phone-1',
    });
    await expect(isCompanyWhatsappReady(COMPANY)).resolves.toBe(true);
  });

  it('fails closed when Meta is temporarily unavailable', async () => {
    installFetch([{ match: 'oauth/access_token', response: json({ error: { code: 1, message: 'temporary' } }, 500) }]);
    await expect(
      completeWhatsAppOnboarding({
        companyId: COMPANY,
        state: signOnboardingState(COMPANY),
        code: 'short-code',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
      })
    ).rejects.toMatchObject({ code: 'WHATSAPP_SEND_FAILED', statusCode: 503 });
    expect(rows.get(COMPANY)?.connectionStatus).toBe('error');
  });

  it('gives two WhatsApp actions in one rule different idempotency keys', () => {
    expect(claimActionType('whatsapp.send', 0)).toBe('whatsapp.send');
    expect(claimActionType('whatsapp.send', 1)).toBe('whatsapp.send#1');
    expect(claimActionType('whatsapp.send', 0)).not.toBe(claimActionType('whatsapp.send', 1));
  });
});
