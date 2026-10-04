import { AppError } from '../../../shared/middleware/error-handler';
import type { EsignSubmitDiagnostics } from './esign-submit-diagnostics';

export class EsignFlowError extends AppError {
  public readonly code: string;
  public diagnostics?: EsignSubmitDiagnostics;

  constructor(statusCode: number, code: string, message: string, diagnostics?: EsignSubmitDiagnostics) {
    super(statusCode, message);
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export const ESIGN_CODES = {
  AGENT_NOT_PAIRED: 'AGENT_NOT_PAIRED',
  AGENT_VERSION_UNSUPPORTED: 'AGENT_VERSION_UNSUPPORTED',
  SIGNING_SESSION_EXPIRED: 'SIGNING_SESSION_EXPIRED',
  SIGNING_AUTHORIZATION_INVALID: 'SIGNING_AUTHORIZATION_INVALID',
  SIGNING_REQUEST_REPLAYED: 'SIGNING_REQUEST_REPLAYED',
  DOCUMENT_HASH_MISMATCH: 'DOCUMENT_HASH_MISMATCH',
  CADES_VERIFICATION_FAILED: 'CADES_VERIFICATION_FAILED',
  ETA_SUBMISSION_FAILED: 'ETA_SUBMISSION_FAILED',
  PAIRING_EXPIRED: 'PAIRING_EXPIRED',
  PAIRING_INVALID: 'PAIRING_INVALID',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
} as const;
