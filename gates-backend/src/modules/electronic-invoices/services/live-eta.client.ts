import { AppError } from '../../../shared/middleware/error-handler';
import { resolveEtaEndpoints, type EtaEndpoints } from '../utils/eta-endpoints';
import { attachEtaHttpMeta } from '../utils/esign-submit-diagnostics';
import type { EtaClient, EtaSubmissionResponse, EtaTokenResponse } from './eta-api.client';

/**
 * HTTP client for ETA Identity + Document APIs (production / pre-production).
 * Activated when ETA_USE_LIVE_CLIENT=true and credentials are present.
 */
type EtaSubmitBody = {
  submissionId?: string;
  acceptedDocuments?: Array<{ uuid?: string; longId?: string; status?: string }>;
  rejectedDocuments?: Array<{
    error?: { message?: string; details?: Array<{ message?: string }> };
  }>;
};

export function interpretEtaSubmission(body: unknown, shareBaseUrl: string): EtaSubmissionResponse {
  const json = (body ?? {}) as EtaSubmitBody;
  const accepted = json.acceptedDocuments?.[0];
  if (!accepted?.uuid) {
    const rejected = json.rejectedDocuments?.[0];
    const details = rejected?.error?.details?.map((row) => row.message).filter(Boolean) ?? [];
    const message =
      details.join(' — ') ||
      rejected?.error?.message ||
      'مصلحة الضرائب رفضت الفاتورة';
    return {
      submissionUuid: json.submissionId ?? '',
      documentUuid: '',
      longId: '',
      publicUrl: '',
      dateTimeReceived: new Date().toISOString(),
      status: 'INVALID',
      validationErrors: [{ property: 'document', message }],
    };
  }

  const raw = String(accepted.status ?? '').toLowerCase();
  const status = raw === 'valid' ? 'VALID' : raw === 'invalid' ? 'INVALID' : 'SUBMITTED';
  const longId = accepted.longId ?? '';
  return {
    submissionUuid: json.submissionId ?? accepted.uuid,
    documentUuid: accepted.uuid,
    longId,
    publicUrl: longId ? `${shareBaseUrl}/documents/${accepted.uuid}/share/${longId}` : '',
    dateTimeReceived: new Date().toISOString(),
    status,
  };
}

export class LiveEtaClient implements EtaClient {
  private tokenCache = new Map<string, { token: string; exp: number }>();

  private endpoints(override?: EtaEndpoints): EtaEndpoints {
    return override ?? resolveEtaEndpoints({});
  }

  async authenticate(
    clientId: string,
    clientSecret: string,
    endpoints?: EtaEndpoints
  ): Promise<EtaTokenResponse> {
    const target = this.endpoints(endpoints);
    const cacheKey = `${target.identityUrl}:${clientId}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      return { access_token: cached.token, expires_in: Math.floor((cached.exp - Date.now()) / 1000) };
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'InvoicingAPI',
    });

    const response = await fetch(target.identityUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new AppError(502, `ETA authentication failed (${response.status}): ${text.slice(0, 200)}`);
      attachEtaHttpMeta(error, response.status, text);
      throw error;
    }

    const json = (await response.json()) as EtaTokenResponse;
    this.tokenCache.set(cacheKey, {
      token: json.access_token,
      exp: Date.now() + (json.expires_in - 60) * 1000,
    });
    return json;
  }

  async submitDocument(
    token: string,
    payload: Record<string, unknown>,
    endpoints?: EtaEndpoints
  ): Promise<EtaSubmissionResponse> {
    const target = this.endpoints(endpoints);
    const response = await fetch(`${target.apiBaseUrl}/api/v1/documentsubmissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents: [payload] }),
    });

    const text = await response.text();
    if (!response.ok) {
      const error = new AppError(502, `ETA submit failed (${response.status}): ${text.slice(0, 300)}`);
      attachEtaHttpMeta(error, response.status, text);
      throw error;
    }

    return interpretEtaSubmission(JSON.parse(text) as unknown, target.shareBaseUrl);
  }

  async cancelDocument(
    token: string,
    documentUuid: string,
    reason: string,
    endpoints?: EtaEndpoints
  ) {
    const target = this.endpoints(endpoints);
    const response = await fetch(`${target.apiBaseUrl}/api/v1/documents/state/${documentUuid}/state`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled', reason }),
    });
    return { accepted: response.ok };
  }

  async getDocumentStatus(
    token: string,
    documentUuid: string,
    endpoints?: EtaEndpoints
  ): Promise<EtaSubmissionResponse> {
    const target = this.endpoints(endpoints);
    const response = await fetch(`${target.apiBaseUrl}/api/v1/documents/${documentUuid}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new AppError(502, `ETA status failed (${response.status})`);
    }
    const json = (await response.json()) as { uuid: string; longId: string; status: string };
    const raw = String(json.status ?? '').toLowerCase();
    const status = raw === 'valid' ? 'VALID' : raw === 'invalid' ? 'INVALID' : 'SUBMITTED';
    return {
      submissionUuid: documentUuid,
      documentUuid: json.uuid,
      longId: json.longId,
      publicUrl: json.longId
        ? `${target.shareBaseUrl}/documents/${json.uuid}/share/${json.longId}`
        : '',
      dateTimeReceived: new Date().toISOString(),
      status,
    };
  }
}

export const liveEtaClient = new LiveEtaClient();
