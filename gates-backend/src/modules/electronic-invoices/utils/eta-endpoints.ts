export type EtaEndpoints = {
  apiBaseUrl: string;
  identityUrl: string;
  shareBaseUrl: string;
};

const PREPROD: EtaEndpoints = {
  apiBaseUrl: 'https://api.preprod.invoicing.eta.gov.eg',
  identityUrl: 'https://id.preprod.eta.gov.eg/connect/token',
  shareBaseUrl: 'https://preprod.invoicing.eta.gov.eg',
};

const PRODUCTION: EtaEndpoints = {
  apiBaseUrl: 'https://api.invoicing.eta.gov.eg',
  identityUrl: 'https://id.eta.gov.eg/connect/token',
  shareBaseUrl: 'https://invoicing.eta.gov.eg',
};

function clean(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function asIdentityUrl(url: string): string {
  const cleaned = clean(url);
  if (cleaned.toLowerCase().includes('/connect/token')) return cleaned;
  return `${cleaned}/connect/token`;
}

function isIdentityUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('/connect/token') || (lower.includes('://id.') && lower.includes('eta.gov.eg'));
}

/**
 * Company settings win over the process environment. Empty settings fall back
 * to the official pre-production or production hosts.
 */
export function resolveEtaEndpoints(input: {
  environment?: string | null;
  tokenUrl?: string | null;
  invoiceUrl?: string | null;
}): EtaEndpoints {
  const production = String(input.environment ?? '').trim().toUpperCase() === 'PRODUCTION';
  const defaults = production ? PRODUCTION : PREPROD;
  let apiBaseUrl = clean(process.env.ETA_API_BASE_URL?.trim() || defaults.apiBaseUrl);
  let identityUrl = asIdentityUrl(process.env.ETA_IDENTITY_URL?.trim() || defaults.identityUrl);

  const tokenUrl = input.tokenUrl?.trim();
  if (tokenUrl) {
    if (isIdentityUrl(tokenUrl)) identityUrl = asIdentityUrl(tokenUrl);
    else apiBaseUrl = clean(tokenUrl);
  }

  const invoiceUrl = input.invoiceUrl?.trim();
  if (invoiceUrl) {
    if (isIdentityUrl(invoiceUrl)) identityUrl = asIdentityUrl(invoiceUrl);
    else apiBaseUrl = clean(invoiceUrl);
  }

  const shareBaseUrl = apiBaseUrl.includes('preprod')
    ? PREPROD.shareBaseUrl
    : apiBaseUrl.includes('invoicing.eta.gov.eg')
      ? PRODUCTION.shareBaseUrl
      : defaults.shareBaseUrl;

  return { apiBaseUrl, identityUrl, shareBaseUrl };
}
