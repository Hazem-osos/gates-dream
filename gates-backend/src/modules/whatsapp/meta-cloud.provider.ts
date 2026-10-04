/**
 * Meta WhatsApp Cloud API. All Graph calls go through this provider.
 * Tokens are passed in by the caller and are never logged.
 */
export type MetaFetch = (url: string, init?: RequestInit) => Promise<Response>;

export class MetaApiError extends Error {
  constructor(
    public readonly code:
      | 'WHATSAPP_AUTH_FAILED'
      | 'WHATSAPP_PERMISSION_DENIED'
      | 'WHATSAPP_INVALID_RECIPIENT'
      | 'WHATSAPP_TEMPLATE_NOT_FOUND'
      | 'WHATSAPP_TEMPLATE_INVALID'
      | 'WHATSAPP_TEMPLATE_PARAMETER_MISMATCH'
      | 'WHATSAPP_PHONE_NOT_REGISTERED'
      | 'WHATSAPP_PHONE_NOT_READY'
      | 'WHATSAPP_PHONE_REGISTRATION_FAILED'
      | 'WHATSAPP_CODE_EXPIRED'
      | 'WHATSAPP_RATE_LIMITED'
      | 'WHATSAPP_SEND_FAILED',
    message: string,
    public readonly transient: boolean
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

export function classifyMetaError(status: number, body: unknown): MetaApiError {
  const error = body && typeof body === 'object' ? (body as { error?: { code?: number; message?: string } }).error : undefined;
  const metaCode = error?.code;
  const message = 'WhatsApp provider rejected the request';
  if (metaCode === 100 && /expir/i.test(String(error?.message ?? ''))) {
    return new MetaApiError('WHATSAPP_CODE_EXPIRED', message, false);
  }
  if (status === 401 || metaCode === 190) return new MetaApiError('WHATSAPP_AUTH_FAILED', message, false);
  if (status === 403 || metaCode === 10 || metaCode === 200) return new MetaApiError('WHATSAPP_PERMISSION_DENIED', message, false);
  if (metaCode === 132001 || metaCode === 132015) return new MetaApiError('WHATSAPP_TEMPLATE_NOT_FOUND', message, false);
  if (metaCode === 132000 || metaCode === 132012) return new MetaApiError('WHATSAPP_TEMPLATE_PARAMETER_MISMATCH', message, false);
  if (metaCode === 132005 || metaCode === 132007) return new MetaApiError('WHATSAPP_TEMPLATE_INVALID', message, false);
  if (metaCode === 133010) return new MetaApiError('WHATSAPP_PHONE_NOT_REGISTERED', message, false);
  if (metaCode === 133005 || metaCode === 133006 || metaCode === 133008 || metaCode === 133009) {
    return new MetaApiError('WHATSAPP_PHONE_REGISTRATION_FAILED', message, false);
  }
  if (metaCode === 131026 || metaCode === 131047) return new MetaApiError('WHATSAPP_INVALID_RECIPIENT', message, false);
  if (status === 429 || metaCode === 4 || metaCode === 80007 || metaCode === 130429) {
    return new MetaApiError('WHATSAPP_RATE_LIMITED', message, true);
  }
  if (status >= 500 || metaCode === 1 || metaCode === 2) return new MetaApiError('WHATSAPP_SEND_FAILED', message, true);
  return new MetaApiError('WHATSAPP_SEND_FAILED', message, false);
}

export class MetaCloudApiProvider {
  constructor(
    private readonly graphVersion: string,
    private readonly fetchImpl: MetaFetch = fetch
  ) {}

  private url(path: string): string {
    return `https://graph.facebook.com/${this.graphVersion}/${path.replace(/^\//, '')}`;
  }

  async exchangeCode(input: { appId: string; appSecret: string; code: string }): Promise<string> {
    const params = new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      code: input.code,
    });
    const response = await this.fetchImpl(`${this.url('oauth/access_token')}?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const token = body && typeof body === 'object' ? (body as { access_token?: string }).access_token : undefined;
    if (!token) throw new MetaApiError('WHATSAPP_AUTH_FAILED', 'WhatsApp authorization did not return a token', false);
    return token;
  }

  async authorizedWabaIds(input: { token: string; appId: string; appSecret: string }): Promise<string[]> {
    const params = new URLSearchParams({
      input_token: input.token,
      access_token: `${input.appId}|${input.appSecret}`,
    });
    const response = await this.fetchImpl(`${this.url('debug_token')}?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const scopes =
      body && typeof body === 'object'
        ? (body as { data?: { granular_scopes?: Array<{ scope?: string; target_ids?: string[] }> } }).data?.granular_scopes
        : undefined;
    const ids = new Set<string>();
    for (const scope of scopes ?? []) {
      if (scope.scope !== 'whatsapp_business_management' && scope.scope !== 'whatsapp_business_messaging') continue;
      for (const id of scope.target_ids ?? []) ids.add(id);
    }
    return [...ids];
  }

  async listPhoneNumbers(
    wabaId: string,
    token: string
  ): Promise<Array<{ id: string; displayPhoneNumber: string | null; status: string | null; codeVerificationStatus: string | null }>> {
    const response = await this.fetchImpl(
      this.url(`${wabaId}/phone_numbers?fields=id,display_phone_number,status,code_verification_status`),
      { headers: { authorization: `Bearer ${token}` } }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const data =
      body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: Array<Record<string, string | undefined>> }).data
        : [];
    return data
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id as string,
        displayPhoneNumber: row.display_phone_number ?? null,
        status: row.status ?? null,
        codeVerificationStatus: row.code_verification_status ?? null,
      }));
  }

  async getPhone(
    phoneNumberId: string,
    token: string
  ): Promise<{ displayPhoneNumber: string | null; status: string | null; codeVerificationStatus: string | null }> {
    const response = await this.fetchImpl(
      this.url(`${phoneNumberId}?fields=display_phone_number,status,code_verification_status`),
      { headers: { authorization: `Bearer ${token}` } }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const row = body && typeof body === 'object' ? (body as Record<string, string | undefined>) : {};
    return {
      displayPhoneNumber: row.display_phone_number ?? null,
      status: row.status ?? null,
      codeVerificationStatus: row.code_verification_status ?? null,
    };
  }

  async registerPhone(phoneNumberId: string, token: string, pin: string): Promise<'registered' | 'already'> {
    const response = await this.fetchImpl(this.url(`${phoneNumberId}/register`), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return 'registered';
    const message =
      body && typeof body === 'object' ? String((body as { error?: { message?: string } }).error?.message ?? '') : '';
    if (/already registered/i.test(message)) return 'already';
    const classified = classifyMetaError(response.status, body);
    if (classified.code === 'WHATSAPP_PHONE_NOT_REGISTERED' || classified.code === 'WHATSAPP_SEND_FAILED') {
      throw new MetaApiError('WHATSAPP_PHONE_REGISTRATION_FAILED', classified.message, classified.transient);
    }
    throw classified;
  }

  async subscribeApp(wabaId: string, token: string): Promise<void> {
    const response = await this.fetchImpl(this.url(`${wabaId}/subscribed_apps`), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
  }

  async getDisplayPhone(phoneNumberId: string, token: string): Promise<string | null> {
    const response = await this.fetchImpl(this.url(`${phoneNumberId}?fields=display_phone_number`), {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const display = body && typeof body === 'object' ? (body as { display_phone_number?: string }).display_phone_number : undefined;
    return display ?? null;
  }

  async listTemplates(wabaId: string, token: string): Promise<Array<{ name: string; language: string; status: string; category: string | null }>> {
    const response = await this.fetchImpl(this.url(`${wabaId}/message_templates?limit=100`), {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const data = body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: Array<{ name?: string; language?: string; status?: string; category?: string }> }).data
      : [];
    return data
      .filter((row) => row.name && row.language)
      .map((row) => ({
        name: row.name as string,
        language: row.language as string,
        status: row.status ?? 'UNKNOWN',
        category: row.category ?? null,
      }));
  }

  async sendTemplate(input: {
    phoneNumberId: string;
    token: string;
    to: string;
    templateName: string;
    language: string;
    bodyParameters: string[];
  }): Promise<{ messageId: string }> {
    const response = await this.fetchImpl(this.url(`${input.phoneNumberId}/messages`), {
      method: 'POST',
      headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.language },
          components: input.bodyParameters.length
            ? [{ type: 'body', parameters: input.bodyParameters.map((text) => ({ type: 'text', text })) }]
            : undefined,
        },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyMetaError(response.status, body);
    const messageId =
      body && typeof body === 'object' && Array.isArray((body as { messages?: Array<{ id?: string }> }).messages)
        ? (body as { messages: Array<{ id?: string }> }).messages[0]?.id
        : undefined;
    if (!messageId) throw new MetaApiError('WHATSAPP_SEND_FAILED', 'WhatsApp did not accept the message', true);
    return { messageId };
  }
}
