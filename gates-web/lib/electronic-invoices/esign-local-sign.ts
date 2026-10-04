import { GATES_ESIGN_LOCAL_URL } from './esign-agent';

export type AgentSignRequest = {
  sessionId: string;
  documentId: string;
  companyId: string;
  documentType?: string;
  canonicalPayload: string;
  documentHash: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  authorization: string;
  operation: 'ETA_SIGN';
  display?: {
    companyName?: string;
    internalId?: string;
    amount?: string;
    documentType?: string;
  };
};

export type AgentSignSuccess = {
  success: true;
  signingSessionId: string;
  requestId: string;
  documentHash: string;
  certificateThumbprint: string;
  signatureType: 'I';
  signature: string;
};

export type AgentCallError = {
  success: false;
  code:
    | 'AGENT_UNREACHABLE'
    | 'AGENT_NOT_PAIRED'
    | 'TOKEN_NOT_FOUND'
    | 'CERTIFICATE_NOT_FOUND'
    | 'USER_CANCELLED'
    | 'TOKEN_LOGIN_FAILED'
    | 'SIGNING_AUTHORIZATION_INVALID'
    | 'SIGNING_REQUEST_REPLAYED'
    | 'DOCUMENT_HASH_MISMATCH'
    | 'SIGNING_SESSION_EXPIRED'
    | 'ORIGIN_REJECTED'
    | 'AGENT_VERSION_UNSUPPORTED';
  message: string;
};

const AGENT_ERROR_MAP: Record<string, AgentCallError['code']> = {
  AGENT_NOT_PAIRED: 'AGENT_NOT_PAIRED',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_REMOVED: 'TOKEN_NOT_FOUND',
  CERTIFICATE_NOT_FOUND: 'CERTIFICATE_NOT_FOUND',
  CONFIRMATION_REJECTED: 'USER_CANCELLED',
  TOKEN_LOGIN_FAILED: 'TOKEN_LOGIN_FAILED',
  REQUEST_UNAUTHORIZED: 'SIGNING_AUTHORIZATION_INVALID',
  REPLAY_DETECTED: 'SIGNING_REQUEST_REPLAYED',
  PAYLOAD_HASH_MISMATCH: 'DOCUMENT_HASH_MISMATCH',
  REQUEST_EXPIRED: 'SIGNING_SESSION_EXPIRED',
  ORIGIN_REJECTED: 'ORIGIN_REJECTED',
  DEVELOPMENT_MODE_REQUIRED: 'AGENT_VERSION_UNSUPPORTED',
};

function mapAgentError(code: string | undefined): AgentCallError {
  const mapped = code ? AGENT_ERROR_MAP[code] : undefined;
  return {
    success: false,
    code: mapped || 'AGENT_UNREACHABLE',
    message: code || 'AGENT_UNREACHABLE',
  };
}

async function agentFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${GATES_ESIGN_LOCAL_URL}${path}`, {
      ...init,
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function pairLocalEsignAgent(input: {
  pairingSessionId: string;
  companyId: string;
  challenge: string;
  deviceCredential: string;
  expiresAt: string;
}): Promise<{ deviceId: string; proof: string } | AgentCallError> {
  try {
    const response = await agentFetch(
      '/pair',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      15_000
    );
    const body = (await response.json()) as { deviceId?: string; proof?: string; error?: string };
    if (!response.ok || !body.deviceId || !body.proof) return mapAgentError(body.error);
    return { deviceId: body.deviceId, proof: body.proof };
  } catch {
    return { success: false, code: 'AGENT_UNREACHABLE', message: 'AGENT_UNREACHABLE' };
  }
}

export async function signWithLocalEsignAgent(
  request: AgentSignRequest
): Promise<AgentSignSuccess | AgentCallError> {
  try {
    const response = await agentFetch(
      '/sign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      180_000
    );
    const body = (await response.json()) as {
      error?: string;
      sessionId?: string;
      signingSessionId?: string;
      requestId?: string;
      documentHash?: string;
      certificateThumbprint?: string;
      cadesBase64?: string;
      signature?: string;
    };
    const signature = body.signature || body.cadesBase64;
    if (!response.ok || !signature || !body.documentHash) return mapAgentError(body.error);
    return {
      success: true,
      signingSessionId: body.signingSessionId || body.sessionId || request.sessionId,
      requestId: body.requestId || request.nonce,
      documentHash: body.documentHash,
      certificateThumbprint: body.certificateThumbprint || '',
      signatureType: 'I',
      signature,
    };
  } catch {
    return { success: false, code: 'AGENT_UNREACHABLE', message: 'AGENT_UNREACHABLE' };
  }
}

export type LocalTokenPinState = 'saved' | 'missing' | 'unreachable' | 'outdated' | 'rejected';

export async function readLocalTokenPinStatus(): Promise<LocalTokenPinState> {
  try {
    const response = await agentFetch('/token-pin', { method: 'GET' }, 2_500);
    if (response.status === 404) return 'outdated';
    if (!response.ok) return 'unreachable';
    const body = (await response.json()) as { saved?: boolean };
    return body.saved ? 'saved' : 'missing';
  } catch {
    return 'unreachable';
  }
}

export async function saveLocalTokenPin(pin: string): Promise<LocalTokenPinState> {
  try {
    const response = await agentFetch(
      '/token-pin',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      },
      5_000
    );
    if (response.status === 404) return 'outdated';
    if (!response.ok) return 'rejected';
    return 'saved';
  } catch {
    return 'unreachable';
  }
}

export async function clearLocalTokenPin(): Promise<LocalTokenPinState> {
  try {
    const response = await agentFetch('/token-pin', { method: 'DELETE' }, 5_000);
    if (response.status === 404) return 'outdated';
    if (!response.ok) return 'unreachable';
    return 'missing';
  } catch {
    return 'unreachable';
  }
}

export function agentRequestContainsPin(value: unknown): boolean {
  return /pin|رقم\s*سري/i.test(JSON.stringify(value ?? {}));
}
