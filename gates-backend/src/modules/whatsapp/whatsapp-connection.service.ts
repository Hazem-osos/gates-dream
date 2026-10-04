/**
 * Tenant WhatsApp connection. The business token from Embedded Signup is
 * encrypted at rest. API views never include the token or its ciphertext.
 */
import crypto from 'crypto';
import prisma from '../../shared/database/prisma';
import { env } from '../../shared/config/env';
import { decrypt, encrypt } from '../../shared/security/secrets-manager';
import { logger } from '../../shared/logger';
import { MetaApiError, MetaCloudApiProvider } from './meta-cloud.provider';
import { maskWhatsAppRecipient, normalizeWhatsAppRecipient, WhatsAppPhoneError } from './phone';

export class WhatsAppConnectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'WhatsAppConnectionError';
  }
}

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return env.META_APP_SECRET || env.ENCRYPTION_KEY || '';
}

export function platformWhatsAppReady(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_EMBEDDED_SIGNUP_CONFIG_ID);
}

export function signOnboardingState(companyId: string): string {
  const secret = stateSecret();
  if (!secret) throw new WhatsAppConnectionError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp platform is not configured', 400);
  const payload = Buffer.from(JSON.stringify({ companyId, exp: Date.now() + STATE_TTL_MS, n: crypto.randomUUID() })).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function readOnboardingState(state: string, companyId: string): void {
  const secret = stateSecret();
  const [payload, mac] = state.split('.');
  if (!payload || !mac || !secret) {
    throw new WhatsAppConnectionError('INVALID_STATE', 'WhatsApp connection session is invalid', 400);
  }
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new WhatsAppConnectionError('INVALID_STATE', 'WhatsApp connection session is invalid', 400);
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { companyId?: string; exp?: number };
  if (!parsed.exp || parsed.exp < Date.now() || !parsed.companyId) {
    throw new WhatsAppConnectionError('INVALID_STATE', 'WhatsApp connection session is invalid', 400);
  }
  if (parsed.companyId !== companyId) {
    throw new WhatsAppConnectionError('ACCOUNT_MISMATCH', 'WhatsApp connection session does not match this company', 403);
  }
}

export type WhatsAppConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type WhatsAppPublicStatus = {
  connected: boolean;
  connectionState: WhatsAppConnectionState;
  platformReady: boolean;
  phoneNumber: string | null;
  status: string;
  tokenSet: boolean;
  templatesApproved: number | null;
  lastCheckedAt: string | null;
};

function connectionStateOf(row: {
  connectionStatus: string;
  isActive: boolean;
  accessTokenEncrypted: string | null;
  phoneNumberId: string | null;
} | null): WhatsAppConnectionState {
  const raw = (row?.connectionStatus ?? '').toLowerCase();
  if (raw === 'connecting') return 'CONNECTING';
  if (raw === 'error') return 'ERROR';
  if (row?.isActive && raw === 'connected' && row.accessTokenEncrypted && row.phoneNumberId) return 'CONNECTED';
  return 'DISCONNECTED';
}

function publicStatus(
  row: {
    connectionStatus: string;
    isActive: boolean;
    displayPhoneNumber: string | null;
    accessTokenEncrypted: string | null;
    phoneNumberId: string | null;
    updatedAt?: Date;
  } | null,
  templatesApproved: number | null = null
): WhatsAppPublicStatus {
  const connectionState = connectionStateOf(row);
  return {
    connected: connectionState === 'CONNECTED',
    connectionState,
    platformReady: platformWhatsAppReady(),
    phoneNumber: row?.displayPhoneNumber ?? null,
    status:
      connectionState === 'CONNECTED'
        ? 'جاهز للإرسال'
        : connectionState === 'CONNECTING'
          ? 'جارٍ الربط'
          : connectionState === 'ERROR'
            ? 'خطأ في الربط'
            : 'غير متصل',
    tokenSet: Boolean(row?.accessTokenEncrypted),
    templatesApproved,
    lastCheckedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function getWhatsAppPublicStatus(companyId: string): Promise<WhatsAppPublicStatus> {
  const row = await prisma.companyWhatsappConfig.findFirst({ where: { companyId } });
  return publicStatus(row);
}

export async function isCompanyWhatsappReady(companyId: string): Promise<boolean> {
  const status = await getWhatsAppPublicStatus(companyId);
  return status.connected;
}

function provider(): MetaCloudApiProvider {
  return new MetaCloudApiProvider(env.META_GRAPH_VERSION || 'v25.0');
}

type StoredCredential = { token: string; pin?: string };

function packCredential(token: string, pin: string): string {
  return encrypt(JSON.stringify({ token, pin }));
}

function unpackCredential(raw: string): StoredCredential {
  const plain = decrypt(raw);
  if (plain.startsWith('{')) {
    const parsed = JSON.parse(plain) as { token?: string; pin?: string };
    if (parsed.token) return { token: parsed.token, pin: parsed.pin };
  }
  return { token: plain };
}

function registrationPin(existing?: string): string {
  if (existing && /^\d{6}$/.test(existing)) return existing;
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function mapMetaFailure(error: unknown): never {
  if (error instanceof MetaApiError) {
    const code =
      error.code === 'WHATSAPP_CODE_EXPIRED'
        ? 'CODE_EXPIRED'
        : error.code === 'WHATSAPP_AUTH_FAILED'
          ? 'META_AUTH_FAILED'
          : error.code;
    throw new WhatsAppConnectionError(code, error.message, error.transient ? 503 : 400);
  }
  throw error;
}

type ConnectionFields = {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  accessToken?: string;
  accessTokenEncrypted?: string | null;
  webhookVerifyToken?: string;
  connectedAt?: Date | null;
  disconnectedAt?: Date | null;
};

async function markConnection(
  companyId: string,
  status: 'connecting' | 'error' | 'connected' | 'disconnected',
  extra: ConnectionFields = {}
) {
  const existing = await prisma.companyWhatsappConfig.findFirst({ where: { companyId } });
  const data = { connectionStatus: status, isActive: status === 'connected', ...extra };
  if (existing) {
    await prisma.companyWhatsappConfig.update({ where: { companyId }, data });
  } else if (status !== 'disconnected') {
    await prisma.companyWhatsappConfig.create({
      data: {
        companyId,
        accessToken: '',
        webhookVerifyToken: 'managed-by-platform',
        connectionStatus: status,
        isActive: status === 'connected',
        ...extra,
      },
    });
  }
}

export async function completeWhatsAppOnboarding(input: {
  companyId: string;
  state: string;
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  finishEvent?: string;
}): Promise<WhatsAppPublicStatus> {
  if (!platformWhatsAppReady()) {
    throw new WhatsAppConnectionError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp platform is not configured', 400);
  }
  readOnboardingState(input.state, input.companyId);
  await markConnection(input.companyId, 'connecting');
  const meta = provider();
  const existing = await prisma.companyWhatsappConfig.findFirst({ where: { companyId: input.companyId } });
  let previousPin: string | undefined;
  if (existing?.accessTokenEncrypted) {
    try {
      previousPin = unpackCredential(existing.accessTokenEncrypted).pin;
    } catch {
      previousPin = undefined;
    }
  }
  try {
    const token = await meta.exchangeCode({
      appId: env.META_APP_ID as string,
      appSecret: env.META_APP_SECRET as string,
      code: input.code,
    });
    const wabaIds = await meta.authorizedWabaIds({
      token,
      appId: env.META_APP_ID as string,
      appSecret: env.META_APP_SECRET as string,
    });
    const wabaId = input.wabaId?.trim();
    if (wabaId && !wabaIds.includes(wabaId)) {
      throw new WhatsAppConnectionError('ACCOUNT_MISMATCH', 'WhatsApp account does not match the authorization', 403);
    }
    const resolvedWaba = wabaId || (wabaIds.length === 1 ? wabaIds[0] : '');
    if (!resolvedWaba) {
      throw new WhatsAppConnectionError('ACCOUNT_MISMATCH', 'WhatsApp account could not be verified', 403);
    }
    await meta.subscribeApp(resolvedWaba, token);
    const phones = await meta.listPhoneNumbers(resolvedWaba, token);
    const claimedPhone = input.phoneNumberId?.trim();
    if (claimedPhone && !phones.some((phone) => phone.id === claimedPhone)) {
      throw new WhatsAppConnectionError('PHONE_MISMATCH', 'WhatsApp phone does not belong to this account', 403);
    }
    const phone = claimedPhone
      ? phones.find((row) => row.id === claimedPhone)
      : phones.length === 1
        ? phones[0]
        : undefined;
    if (!phone) {
      throw new WhatsAppConnectionError('PHONE_MISMATCH', 'WhatsApp phone could not be verified', 403);
    }
    let current = await meta.getPhone(phone.id, token);
    const pin = registrationPin(previousPin);
    const ready = (current.status ?? '').toUpperCase() === 'CONNECTED';
    if (!ready) {
      if ((current.codeVerificationStatus ?? '').toUpperCase() === 'NOT_VERIFIED') {
        throw new WhatsAppConnectionError('WHATSAPP_PHONE_NOT_READY', 'WhatsApp phone is not verified yet', 400);
      }
      if (input.finishEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        throw new WhatsAppConnectionError('WHATSAPP_PHONE_NOT_READY', 'WhatsApp phone is not ready to send', 400);
      }
      const registered = await meta.registerPhone(phone.id, token, pin);
      current = await meta.getPhone(phone.id, token);
      if ((current.status ?? '').toUpperCase() !== 'CONNECTED' && registered !== 'already') {
        throw new WhatsAppConnectionError('WHATSAPP_PHONE_NOT_READY', 'WhatsApp phone is not ready to send', 400);
      }
      if ((current.status ?? '').toUpperCase() !== 'CONNECTED') {
        throw new WhatsAppConnectionError('WHATSAPP_PHONE_NOT_READY', 'WhatsApp phone is not ready to send', 400);
      }
    }
    await markConnection(input.companyId, 'connected', {
      wabaId: resolvedWaba,
      phoneNumberId: phone.id,
      displayPhoneNumber: current.displayPhoneNumber ?? phone.displayPhoneNumber,
      accessToken: 'encrypted',
      accessTokenEncrypted: packCredential(token, pin),
      webhookVerifyToken: 'managed-by-platform',
      connectedAt: new Date(),
      disconnectedAt: null,
    });
    return getWhatsAppPublicStatus(input.companyId);
  } catch (error) {
    await markConnection(input.companyId, 'error').catch(() => undefined);
    logger.error(
      { companyId: input.companyId, code: error instanceof WhatsAppConnectionError || error instanceof MetaApiError ? error.code : 'META_AUTH_FAILED' },
      'WhatsApp onboarding failed'
    );
    if (error instanceof WhatsAppConnectionError) throw error;
    throw mapMetaFailure(error);
  }
}

export async function disconnectWhatsApp(companyId: string): Promise<WhatsAppPublicStatus> {
  await prisma.companyWhatsappConfig.updateMany({
    where: { companyId },
    data: {
      isActive: false,
      connectionStatus: 'disconnected',
      accessTokenEncrypted: null,
      accessToken: '',
      disconnectedAt: new Date(),
    },
  });
  return getWhatsAppPublicStatus(companyId);
}

async function loadToken(companyId: string): Promise<{ token: string; wabaId: string; phoneNumberId: string; configId: string }> {
  const row = await prisma.companyWhatsappConfig.findFirst({ where: { companyId, isActive: true, connectionStatus: 'connected' } });
  if (!row?.accessTokenEncrypted || !row.wabaId || !row.phoneNumberId) {
    throw new WhatsAppConnectionError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp Business is not connected', 400);
  }
  try {
    return {
      token: unpackCredential(row.accessTokenEncrypted).token,
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      configId: row.id,
    };
  } catch {
    logger.error({ companyId, code: 'WHATSAPP_AUTH_FAILED' }, 'WhatsApp credential could not be decrypted');
    throw new WhatsAppConnectionError('WHATSAPP_AUTH_FAILED', 'WhatsApp credentials could not be read', 400);
  }
}

export type WhatsAppTemplateView = {
  name: string;
  language: string;
  category: string | null;
  status: string;
  usable: boolean;
};

function templateUsable(status: string): boolean {
  return status.toUpperCase() === 'APPROVED';
}

export async function listCompanyTemplates(companyId: string, options?: { usableOnly?: boolean }): Promise<WhatsAppTemplateView[]> {
  const loaded = await loadToken(companyId);
  const rows = await provider().listTemplates(loaded.wabaId, loaded.token);
  const views = rows.map((row) => ({
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    usable: templateUsable(row.status),
  }));
  return options?.usableOnly ? views.filter((row) => row.usable) : views;
}

export async function sendCompanyTemplate(input: {
  companyId: string;
  to: string;
  templateName: string;
  language: string;
  bodyParameters: string[];
}): Promise<{ provider: 'meta'; messageId: string; recipient: string; status: 'ACCEPTED' }> {
  let to: string;
  try {
    to = normalizeWhatsAppRecipient(input.to);
  } catch (error) {
    if (error instanceof WhatsAppPhoneError) {
      throw new WhatsAppConnectionError('WHATSAPP_INVALID_RECIPIENT', error.message, 400);
    }
    throw error;
  }
  const loaded = await loadToken(input.companyId);
  const templates = await listCompanyTemplates(input.companyId, { usableOnly: true });
  const allowed = templates.some(
    (row) => row.name === input.templateName && row.language === input.language
  );
  if (!allowed) {
    throw new WhatsAppConnectionError('WHATSAPP_TEMPLATE_NOT_FOUND', 'WhatsApp template is not approved for this company', 400);
  }
  try {
    const sent = await provider().sendTemplate({
      phoneNumberId: loaded.phoneNumberId,
      token: loaded.token,
      to,
      templateName: input.templateName,
      language: input.language,
      bodyParameters: input.bodyParameters,
    });
    await prisma.whatsappOutboundMessage.create({
      data: {
        companyId: input.companyId,
        configId: loaded.configId,
        metaMessageId: sent.messageId,
        recipientMasked: maskWhatsAppRecipient(to),
        templateName: input.templateName,
        templateLanguage: input.language,
        status: 'ACCEPTED',
      },
    });
    return { provider: 'meta', messageId: sent.messageId, recipient: maskWhatsAppRecipient(to), status: 'ACCEPTED' };
  } catch (error) {
    if (error instanceof MetaApiError) {
      throw new WhatsAppConnectionError(error.code, error.message, error.transient ? 503 : 400);
    }
    throw error;
  }
}
