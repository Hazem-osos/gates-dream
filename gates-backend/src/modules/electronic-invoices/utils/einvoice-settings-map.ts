import { parseEnabledSalesProfileIds } from './enabled-sales-profiles';

const MASK = '***';

export type EinvoiceSettingsInput = {
  clientId?: string | null;
  clientSecret?: string | null;
  tokenPin?: string | null;
  environment?: string | null;
  issuerTaxId?: string | null;
  issuerName?: string | null;
  activityCode?: string | null;
  apiBaseUrl?: string | null;
  enabledSalesProfileIds?: string[] | null;
  issuerAddress?: unknown;
  username?: string | null;
  password1?: string | null;
  password2?: string | null;
  tokenAPI?: string | null;
  invoiceAPI?: string | null;
  certThumbPrint?: string | null;
};

export type EinvoiceSettingsRow = {
  clientId?: string | null;
  clientSecret?: string | null;
  tokenPin?: string | null;
  environment?: string | null;
  issuerTaxId?: string | null;
  issuerName?: string | null;
  activityCode?: string | null;
  apiBaseUrl?: string | null;
  enabledSalesProfileIds?: unknown;
  issuerAddress?: unknown;
};

export type EinvoiceSettingsPatch = {
  clientId?: string;
  clientSecret?: string;
  tokenPin?: string;
  environment?: string;
  issuerTaxId?: string | null;
  issuerName?: string | null;
  activityCode?: string | null;
  apiBaseUrl?: string;
  enabledSalesProfileIds?: string[];
  issuerAddress?: Record<string, unknown>;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function firstText(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const next = text(value);
    if (next) return next;
  }
  return undefined;
}

function firstUnmaskedSecret(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (!isMaskedSecret(value)) return text(value);
  }
  return undefined;
}

export function isMaskedSecret(value: unknown): boolean {
  const next = text(value);
  return !next || next === MASK;
}

export function extrasFromIssuerAddress(address: unknown): {
  invoiceAPI: string;
  certThumbPrint: string;
} {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    return { invoiceAPI: '', certThumbPrint: '' };
  }
  const rec = address as Record<string, unknown>;
  return {
    invoiceAPI: text(rec.invoiceAPI),
    certThumbPrint: text(rec.certThumbPrint),
  };
}

export function mergeIssuerAddressExtras(
  existing: unknown,
  extras: { invoiceAPI?: string; certThumbPrint?: string }
): Record<string, unknown> | undefined {
  if (extras.invoiceAPI === undefined && extras.certThumbPrint === undefined) return undefined;
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (extras.invoiceAPI !== undefined) base.invoiceAPI = extras.invoiceAPI;
  if (extras.certThumbPrint !== undefined) base.certThumbPrint = extras.certThumbPrint;
  return base;
}

export function buildEinvoiceSettingsPatch(
  input: EinvoiceSettingsInput,
  existing?: EinvoiceSettingsRow | null
): EinvoiceSettingsPatch {
  const patch: EinvoiceSettingsPatch = {};
  const clientId = firstText(input.clientId, input.username);
  if (clientId !== undefined) patch.clientId = clientId;

  const secret = firstUnmaskedSecret(input.password1, input.clientSecret);
  if (secret !== undefined) patch.clientSecret = secret;

  const pin = firstUnmaskedSecret(input.password2, input.tokenPin);
  if (pin !== undefined) patch.tokenPin = pin;

  const apiBaseUrl = firstText(input.apiBaseUrl, input.tokenAPI);
  if (apiBaseUrl !== undefined) patch.apiBaseUrl = apiBaseUrl;

  if (input.environment != null && text(input.environment)) {
    patch.environment = text(input.environment);
  }
  if (input.issuerTaxId !== undefined) patch.issuerTaxId = text(input.issuerTaxId) || null;
  if (input.issuerName !== undefined) patch.issuerName = text(input.issuerName) || null;
  if (input.activityCode !== undefined) patch.activityCode = text(input.activityCode) || null;
  if (input.enabledSalesProfileIds !== undefined) {
    patch.enabledSalesProfileIds = parseEnabledSalesProfileIds(input.enabledSalesProfileIds);
  }

  const extras: { invoiceAPI?: string; certThumbPrint?: string } = {};
  if (input.invoiceAPI !== undefined) extras.invoiceAPI = text(input.invoiceAPI);
  if (input.certThumbPrint !== undefined) extras.certThumbPrint = text(input.certThumbPrint);
  const address = mergeIssuerAddressExtras(existing?.issuerAddress, extras);
  if (address) patch.issuerAddress = address;

  return patch;
}

export function toPublicEinvoiceSettings(companyId: string, row: EinvoiceSettingsRow | null) {
  const extras = extrasFromIssuerAddress(row?.issuerAddress);
  const enabled = parseEnabledSalesProfileIds(row?.enabledSalesProfileIds);
  return {
    companyId,
    taxAuthority: 'ETA' as const,
    clientId: row?.clientId ?? undefined,
    clientSecret: row?.clientSecret ? MASK : undefined,
    tokenPin: row?.tokenPin ? MASK : undefined,
    environment: (row?.environment as 'PRE_PRODUCTION' | 'PRODUCTION') || 'PRE_PRODUCTION',
    issuerTaxId: row?.issuerTaxId ?? undefined,
    issuerName: row?.issuerName ?? undefined,
    activityCode: row?.activityCode ?? undefined,
    apiBaseUrl: row?.apiBaseUrl ?? undefined,
    autoSubmit: false,
    defaultTaxRate: 14,
    invoicePrefix: 'INV',
    returnPrefix: 'RET',
    amendmentPrefix: 'AMEND',
    enabledSalesProfileIds: enabled,
    username: row?.clientId ?? '',
    password1: row?.clientSecret ? MASK : '',
    password2: row?.tokenPin ? MASK : '',
    tokenAPI: row?.apiBaseUrl ?? '',
    invoiceAPI: extras.invoiceAPI,
    certThumbPrint: extras.certThumbPrint,
    password1Set: Boolean(row?.clientSecret),
    password2Set: Boolean(row?.tokenPin),
  };
}
