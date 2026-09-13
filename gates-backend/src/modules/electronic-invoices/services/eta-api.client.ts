import { randomUUID } from 'crypto';

export interface EtaTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface EtaSubmissionResponse {
  submissionUuid: string;
  documentUuid: string;
  longId: string;
  publicUrl: string;
  dateTimeReceived: string;
  status: 'VALID' | 'INVALID';
  validationErrors?: Array<{ property: string; message: string }>;
}

export interface EtaClient {
  authenticate(clientId: string, clientSecret: string): Promise<EtaTokenResponse>;
  submitDocument(
    token: string,
    payload: Record<string, unknown>
  ): Promise<EtaSubmissionResponse>;
  cancelDocument(token: string, documentUuid: string, reason: string): Promise<{ accepted: boolean }>;
  getDocumentStatus(token: string, documentUuid: string): Promise<EtaSubmissionResponse>;
}

/** In-memory mock for integration tests and PRE_PRODUCTION without network. */
export class MockEtaClient implements EtaClient {
  private tokens = new Map<string, { exp: number }>();
  private docs = new Map<string, EtaSubmissionResponse>();

  async authenticate(clientId: string, _clientSecret: string): Promise<EtaTokenResponse> {
    const token = `mock-token-${clientId}`;
    this.tokens.set(token, { exp: Date.now() + 3600_000 });
    return { access_token: token, expires_in: 3600 };
  }

  async submitDocument(
    _token: string,
    payload: Record<string, unknown>
  ): Promise<EtaSubmissionResponse> {
    const documentUuid = randomUUID();
    const submissionUuid = randomUUID();
    const resp: EtaSubmissionResponse = {
      submissionUuid,
      documentUuid,
      longId: documentUuid.replace(/-/g, '').slice(0, 16),
      publicUrl: `https://mock.eta.gov.eg/doc/${documentUuid}`,
      dateTimeReceived: new Date().toISOString(),
      status: 'VALID',
    };
    this.docs.set(documentUuid, resp);
    if (payload.internalID === 'FORCE-INVALID') {
      resp.status = 'INVALID';
      resp.validationErrors = [{ property: 'receiver.id', message: 'Invalid tax ID' }];
    }
    return resp;
  }

  async cancelDocument(_token: string, documentUuid: string, _reason: string) {
    const doc = this.docs.get(documentUuid);
    if (!doc) return { accepted: false };
    return { accepted: true };
  }

  async getDocumentStatus(_token: string, documentUuid: string): Promise<EtaSubmissionResponse> {
    const doc = this.docs.get(documentUuid);
    if (!doc) {
      return {
        submissionUuid: randomUUID(),
        documentUuid,
        longId: 'unknown',
        publicUrl: '',
        dateTimeReceived: new Date().toISOString(),
        status: 'INVALID',
        validationErrors: [{ property: 'uuid', message: 'Document not found' }],
      };
    }
    return doc;
  }
}

export const mockEtaClient = new MockEtaClient();
