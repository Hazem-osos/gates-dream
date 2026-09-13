import { AppError } from '../../../shared/middleware/error-handler';
import type { EtaClient, EtaSubmissionResponse, EtaTokenResponse } from './eta-api.client';

/**
 * HTTP client for ETA Identity + Document APIs (production / pre-production).
 * Activated when ETA_USE_LIVE_CLIENT=true and credentials are present.
 */
export class LiveEtaClient implements EtaClient {
  private tokenCache = new Map<string, { token: string; exp: number }>();

  private baseUrl(): string {
    const url = process.env.ETA_API_BASE_URL?.trim();
    if (!url) throw new AppError(501, 'ETA_API_BASE_URL is required for live ETA client');
    return url.replace(/\/$/, '');
  }

  private identityUrl(): string {
    return (process.env.ETA_IDENTITY_URL?.trim() || `${this.baseUrl()}/connect/token`).replace(
      /\/$/,
      ''
    );
  }

  async authenticate(clientId: string, clientSecret: string): Promise<EtaTokenResponse> {
    const cached = this.tokenCache.get(clientId);
    if (cached && cached.exp > Date.now()) {
      return { access_token: cached.token, expires_in: Math.floor((cached.exp - Date.now()) / 1000) };
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'InvoicingAPI',
    });

    const response = await fetch(this.identityUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AppError(502, `ETA authentication failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as EtaTokenResponse;
    this.tokenCache.set(clientId, {
      token: json.access_token,
      exp: Date.now() + (json.expires_in - 60) * 1000,
    });
    return json;
  }

  async submitDocument(
    token: string,
    payload: Record<string, unknown>
  ): Promise<EtaSubmissionResponse> {
    const response = await fetch(`${this.baseUrl()}/api/v1/documentsubmissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents: [payload] }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new AppError(502, `ETA submit failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const json = JSON.parse(text) as {
      submissionId?: string;
      acceptedDocuments?: Array<{ uuid: string; longId: string; status: string }>;
    };
    const doc = json.acceptedDocuments?.[0];
    if (!doc) {
      throw new AppError(502, 'ETA submit returned no accepted documents');
    }

    return {
      submissionUuid: json.submissionId ?? doc.uuid,
      documentUuid: doc.uuid,
      longId: doc.longId,
      publicUrl: '',
      dateTimeReceived: new Date().toISOString(),
      status: doc.status === 'Valid' ? 'VALID' : 'INVALID',
    };
  }

  async cancelDocument(token: string, documentUuid: string, reason: string) {
    const response = await fetch(`${this.baseUrl()}/api/v1/documents/state/${documentUuid}/state`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled', reason }),
    });
    return { accepted: response.ok };
  }

  async getDocumentStatus(token: string, documentUuid: string): Promise<EtaSubmissionResponse> {
    const response = await fetch(`${this.baseUrl()}/api/v1/documents/${documentUuid}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new AppError(502, `ETA status failed (${response.status})`);
    }
    const json = (await response.json()) as { uuid: string; longId: string; status: string };
    return {
      submissionUuid: documentUuid,
      documentUuid: json.uuid,
      longId: json.longId,
      publicUrl: '',
      dateTimeReceived: new Date().toISOString(),
      status: json.status === 'Valid' ? 'VALID' : 'INVALID',
    };
  }
}

export const liveEtaClient = new LiveEtaClient();
